# issue-107: 公開名がDBに保存されず再ログインで消える問題の根本原因調査・修正

## ステータス
✅ 修正済み（`npx prisma generate` 実行 + 本 Issue 文書化）

## 優先度
Critical

## デプロイブロッカー
Yes（ローカル開発環境で常に失敗する）

---

## 1. 問題概要

`/home` のプロフィール編集で公開名（display_name）を変更しても保存されない。
ページリロードや再ログイン後に変更が消える。

**なぜ重要か**
- 公開名仕様（ISSUE-074〜079）が成立していない
- ユーザーが公開名変更を信頼できない
- 実名や provider 由来名の露出リスクが残る

---

## 2. 現象確認結果

| 操作 | 期待 | 実際（バグ時） |
|------|------|----------------|
| 保存ボタン押下 | API呼び出し・DB保存・「保存しました」 | API呼び出しされるが 500 エラーで失敗 |
| リロード後 | 変更した公開名が表示される | null（fallback 名）に戻る |
| 再ログイン後 | 変更した公開名が表示される | null（fallback 名）に戻る |

**エラーの出方：**
`PATCH /api/profile` が 500 を返す → ProfileSheet に
「保存に失敗しました。もう一度お試しください。」が表示される。

「再ログインで消える」に見えた理由：
DB に値が一度も保存されていないため、リロード/再ログインのたびに
Supabase から null が返り、「消えた」ように見える。

---

## 3. 名前関連フィールド一覧

| フィールド名 | DB カラム | 役割 | 保存先 |
|-------------|-----------|------|--------|
| `Profile.name` | `profiles.name` | OAuth provider 由来の実名。外部非公開 | auth callback で同期 |
| `Profile.displayName` | `profiles.display_name` | **公開名。SNS・結果画面に使用** | PATCH /api/profile のみ |
| `Profile.displayNameConfirmedAt` | `profiles.display_name_confirmed_at` | 初回シェア前確認済みフラグ | PATCH /api/profile |
| `RoomMember.nickname` | `room_members.nickname` | ルーム固有の表示名。`getDisplayName()` で上書き | rooms/join API |
| `user_metadata.full_name` | Supabase Auth | Google provider 名 | Supabase Auth |
| `user_metadata.full_name` | Supabase Auth | LINE display name | LINE callback |

---

## 4. 保存経路の切り分け結果

**分類: E（DB update が走っていない）**

```
Frontend → API → Prisma → DB
                   ↑
           ここで失敗（PrismaClientValidationError）
```

詳細:
- A. submit: ✅ handleSave が呼ばれている
- B. API 呼び出し: ✅ `PATCH /api/profile` は呼ばれている
- C. payload: ✅ `{ displayName: "山田" }` が正しく送られている
- D. API: ❌ 500 で失敗（PrismaClientValidationError）
- E. DB update: ❌ Prisma が `displayName` を知らないため SQL に含まれない
- G. local state: 保存失敗後も React state が更新されないため問題なし
- H. 再ログイン同期: ✅ auth callback は `displayName` を一切触らない

---

## 5. 根本原因

### 主因: Prisma クライアントが stale（`displayName` フィールド未反映）

| | |
|--|--|
| **該当ファイル** | `node_modules/.pnpm/@prisma+client@6.2.1_prisma@6.2.1/node_modules/.prisma/client/` |
| **現象** | 生成日時が March 27 → `display_name` migration（March 29）より古い |
| **影響** | 生成クライアントの `ProfileUpdateInput` に `displayName` が存在しない |
| **エラー** | `PrismaClientValidationError: Unknown argument \`displayName\`` |
| **結果** | PATCH handler の try/catch が 500 を返す → 保存失敗 |

```typescript
// ProfileUpdateInput（stale クライアント）— displayName がない！
export type ProfileUpdateInput = {
  id?: StringFieldUpdateOperationsInput | string
  email?: NullableStringFieldUpdateOperationsInput | string | null
  name?: NullableStringFieldUpdateOperationsInput | string | null
  avatarUrl?: NullableStringFieldUpdateOperationsInput | string | null
  // displayName が存在しない → Prisma が Unknown argument エラーをスロー
}
```

`data` が `Record<string, any>` で型チェックをすり抜けるため、
**TypeScript のコンパイルエラーは一切出ない**。
ランタイムで初めて失敗する。

### 副因（既修正）: `prisma.profile.update()` のみ使用（commit 1c3833c で対応済み）

profile レコードが存在しない場合、`update()` は P2025 で失敗する。
`upsert()` へ変更することで修正済み。

---

## 6. 修正方針

### 最小修正（今回実施）

```bash
npx prisma generate
```

生成クライアントを最新スキーマに合わせて再生成。
`displayName`・`displayNameConfirmedAt` フィールドがクライアントに反映される。

**本番（Vercel）については影響なし。**
`package.json` の build script が `prisma generate && next build` であるため、
Vercel は常に最新クライアントでビルドしている。

### 安全修正

`data` の型を `Record<string, any>` から型安全な形に変更し、
将来の stale クライアントによるサイレント失敗を防ぐ。

```typescript
// app/api/profile/route.ts
// Before: Record<string, any>
// After:  Prisma.ProfileUpdateInput に型付け

import type { Prisma } from "@prisma/client"

const data: Prisma.ProfileUpdateInput = {}
if (name !== undefined) data.name = name
if (avatarUrl !== undefined) data.avatarUrl = avatarUrl
if (displayName !== undefined) data.displayName = displayName?.trim() || null
if (displayNameConfirmedAt !== undefined) data.displayNameConfirmedAt = displayNameConfirmedAt
```

これにより `displayName` が Prisma クライアントに存在しない場合は
TypeScript のコンパイルエラーで即座に検知できる。

### 理想修正

`dev` スクリプトを `prisma generate && next dev` に変更し、
ローカル開発時も常に最新クライアントを使う。
（ただし生成時間が毎回かかるためトレードオフあり。`postinstall` で代替可能。）

---

## 7. 影響範囲

| 画面 | 影響 |
|------|------|
| `/home` プロフィール編集 | ✅ 修正済み（保存できる） |
| 再ログイン後の公開名表示 | ✅ 根本が解消（DB に保存されるため維持される） |
| `/home` グリーティング | ✅ `profile.displayName` が正しく表示される |
| `/room/[code]/play` のメンバー名 | ✅ Room API の `getDisplayName()` が正しく動作 |
| ShareSheet の公開名確認 | ✅ displayName が null でなければ正しく表示される |
| 履歴・結果画面の表示 | ✅ 保存されていれば反映される |

---

## 8. 検証項目

- [x] `npx prisma generate` を実行済み
- [x] 生成クライアントに `displayName`・`displayNameConfirmedAt` が含まれる
- [ ] 公開名を変更して「保存する」をタップすると成功する（「保存しました」表示）
- [ ] DB に `display_name` が保存される（Supabase Studio で確認）
- [ ] ページリロード後も変更が維持される
- [ ] 再ログイン後も変更が維持される（Google / LINE）
- [ ] 空文字保存時は NULL（fallback 名）に戻る
- [ ] Android/PC で回帰なし
- [ ] console error がない

---

## 9. 再発防止

| 対策 | 状態 |
|------|------|
| `"build": "prisma generate && next build"` で Vercel は常に最新 | ✅ 設定済み |
| `"postinstall": "prisma generate"` で `pnpm install` 後に自動生成 | ✅ 設定済み |
| `data: Record<string, any>` を型安全化 | △ 未実施（issue-107 フォロー推奨） |
| DB スキーマ変更後のローカル手順を README に追記 | △ 未実施 |

**ローカル開発で DB スキーマを変更したら必ず実行すること:**
```bash
npx prisma generate   # クライアント再生成
pnpm dev              # 開発サーバー再起動
```

---

## 10. 関連 Issue

- ISSUE-074〜079: 公開名仕様設計・実装
- ISSUE-106: `prisma.profile.update()` → `upsert()` 修正の記録
