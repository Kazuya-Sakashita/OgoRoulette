# ISSUE-090: ルーム参加時のメンバー表示が公開名ではなく本名になっている問題を修正する

**ステータス:** ✅ 実装済み（commit: 55bb60e）
**優先度:** Critical
**デプロイブロッカー:** 解消済み

---

## 1. 問題概要

### 何が起きているか

ルームに**参加**（join）する際、`RoomMember.nickname` に
`user.user_metadata.name || user.user_metadata.full_name`（プロバイダ由来名）が
保存されている。ルーム**作成**（create）時は `getDisplayName()` が使われており正しいが、
**参加時だけ別ロジック**になっており本名が混入する。

### なぜ危険か

- ルームのメンバー一覧は画面共有・スクリーンショットで全員に見える
- 「公開名を設定した」ユーザーでも、参加者として入ると本名が表示される
- ルーム作成者とルーム参加者で表示名の責務が分断されている
- `getDisplayName()` の設計方針（provider_name は外部公開しない）が参加フローで無視されている

---

## 2. 現状確認結果

### どの画面で何の名前が表示されているか

| 画面 | 表示元 | 本名露出 |
|---|---|---|
| ルーム待機画面（`/room/[code]`）| `member.nickname \|\| member.profile?.name` | ❌ **あり** |
| ルームプレイ画面（`/room/[code]/play`）| `member.nickname \|\| member.profile?.name` | ❌ **あり** |

### 本名露出の有無

- **ルーム作成者（host）**: ✅ 安全。`getDisplayName()` を使っている
- **ルーム参加者（joiner）**: ❌ 危険。`user_metadata.name || full_name` を使っている

### 具体的な差異

```ts
// app/api/rooms/route.ts:153（ルーム作成時）— ✅ 正しい
const resolvedNickname = getDisplayName({ id: profile.id, displayName: profile.displayName })

// app/api/rooms/join/route.ts:74-78（ルーム参加時）— ❌ 危険
const resolvedNickname =
  user.user_metadata?.name ||
  user.user_metadata?.full_name ||
  user.user_metadata?.display_name ||
  "LINEユーザー"
```

同じ `nickname` フィールドに保存されているが、設定ロジックが全く異なる。

---

## 3. 名前関連フィールド一覧

| フィールド | 場所 | 役割 | 公開表示 |
|---|---|---|---|
| `user.user_metadata.name` | Supabase Auth | OAuthプロバイダ由来名 | ❌ 禁止 |
| `user.user_metadata.full_name` | Supabase Auth | OAuthプロバイダ由来フルネーム | ❌ 禁止 |
| `user.email` | Supabase Auth | メールアドレス | ❌ 禁止 |
| `Profile.name` | DB | プロバイダ由来名（内部保持用）| ❌ 禁止（スキーマコメントに明記） |
| `Profile.displayName` | DB | ユーザーが設定した公開名 | ✅ 安全 |
| `RoomMember.nickname` | DB | ルーム参加時の表示名スナップショット | ⚠️ 設定ロジックによる |
| `getDisplayName(profile)` | lib | displayName \|\| "ユーザー"+id末尾4文字 | ✅ 安全 |

---

## 4. 画面別の表示名参照表

| 画面 | 参照元 | 安全か |
|---|---|---|
| **home 挨拶** | `profile.displayName`（ISSUE-088 修正済み）| ✅ |
| **home ルーム作成** | `getDisplayName(profile)` → `nickname` に保存 | ✅ |
| **room 待機画面** メンバーリスト | `member.nickname \|\| member.profile?.name` | ❌ **要修正** |
| **room play** ルーレット参加者 | `member.nickname \|\| member.profile?.name` | ❌ **要修正** |
| **result** 奢り者表示 | URL パラメータ（share-service 経由の displayName）| ✅ |
| **history** 参加者一覧 | `participant.name`（session 保存時の name）| ⚠️ 後述 |
| **profile** | `profile.displayName` | ✅ |
| **SNS シェア** | `getDisplayName(profile)` | ✅ |

---

## 5. 根本原因候補

### 最有力: **G（ルーム参加時だけ別 DTO・別ロジックを使っている）**

| 分類 | 該当 | 根拠 |
|---|---|---|
| A. UI側で古い `name` を参照 | ⚠️ 副次的 | `profile?.name` フォールバックが残っている |
| B. API が公開名を返していない | ❌ | API は `displayName` を返している |
| C. adapter が本名優先 | ❌ | adapter 層なし |
| D. state / cache 不整合 | ❌ | polling で常に最新取得 |
| E. 参加時に古い名前をスナップショット保存 | ✅ **主因（保存時）** | join route が `user_metadata` を使用 |
| F. 既存データ移行不整合 | ⚠️ 副次的 | 既存の参加者は誤った nickname が DB に保存済み |
| **G. 参加時だけ別 DTO・別ロジック** | ✅ **主因** | join route に `getDisplayName()` が未使用 |
| H. 複合要因 | ✅ | E + G + A の複合 |

### 該当ファイルと処理

```
app/api/rooms/join/route.ts:74-105
  → resolvedNickname の設定で user_metadata を直接参照
  → getDisplayName() を import していない
  → profile の displayName を DB から取得していない

app/room/[code]/page.tsx:395-401
  → Member interface に profile.displayName がない
  → 表示に getDisplayName() を使っていない
  → profile.name（プロバイダ由来名）がフォールバックになっている

app/room/[code]/play/page.tsx:85
  → 同様の問題（member.nickname || member.profile?.name）
```

---

## 6. 変更計画

### 最小変更（参加時 nickname を公開名に統一）

**`app/api/rooms/join/route.ts`** を修正:

```ts
// Before（危険）
const resolvedNickname =
  user.user_metadata?.name ||
  user.user_metadata?.full_name ||
  user.user_metadata?.display_name ||
  "LINEユーザー"

await prisma.profile.upsert({
  where: { id: user.id },
  update: {},
  create: {
    id: user.id,
    email: user.email,
    name: resolvedNickname,
    avatarUrl: user.user_metadata?.avatar_url
  }
})
// nickname: resolvedNickname （プロバイダ名）

// After（安全）
const providerName =
  user.user_metadata?.name ||
  user.user_metadata?.full_name ||
  user.user_metadata?.display_name ||
  "ユーザー"

const profile = await prisma.profile.upsert({
  where: { id: user.id },
  update: {},
  create: {
    id: user.id,
    email: user.email,
    name: providerName,       // Profile.name は内部保持用
    avatarUrl: user.user_metadata?.avatar_url
  },
  select: { id: true, displayName: true }  // displayName を取得
})

const resolvedNickname = getDisplayName({ id: profile.id, displayName: profile.displayName })
// nickname: resolvedNickname（公開名）
```

変更ファイル: `app/api/rooms/join/route.ts`

---

### 安全変更（推奨：表示層も修正して二重防護）

**`app/room/[code]/page.tsx`** も修正:

```ts
// Before — Member interface
profile: {
  id: string
  name: string | null
  avatarUrl: string | null
} | null

// After — displayName を追加
profile: {
  id: string
  name: string | null
  displayName: string | null  // 追加
  avatarUrl: string | null
} | null
```

```tsx
// Before — 表示
{member.nickname || member.profile?.name || "ゲスト"}

// After — getDisplayName を使う
{member.nickname || (member.profile ? getDisplayName(member.profile) : "ゲスト")}
```

同様に `app/room/[code]/play/page.tsx:85` も修正。

変更ファイル: `app/room/[code]/page.tsx`, `app/room/[code]/play/page.tsx`

---

### 理想変更（既存データへの対応）

既存の参加者（すでに誤った nickname が DB に保存されているユーザー）への対応:

**選択肢A: 再参加時に上書き**
参加 API で `existingMember` がいた場合でも、nickname が古い（profile.displayName と異なる）なら更新する。

```ts
const existingMember = room.members.find(m => m.profileId === user.id)
if (existingMember) {
  // nickname が最新の公開名と異なる場合は更新
  if (existingMember.nickname !== resolvedNickname) {
    await prisma.roomMember.update({
      where: { id: existingMember.id },
      data: { nickname: resolvedNickname }
    })
  }
  return NextResponse.json({ message: "Already a member", ... })
}
```

**選択肢B: ルーム取得 API で nickname を動的に上書き**
`/api/rooms/[code]` の GET レスポンスで、profileId があるメンバーは
`profile.displayName` を nickname として上書きして返す。

```ts
// GET /api/rooms/[code] のレスポンス加工
const membersWithSafeNames = room.members.map(m => ({
  ...m,
  nickname: m.profileId
    ? getDisplayName({ id: m.profile!.id, displayName: m.profile!.displayName })
    : m.nickname  // ゲストは nickname をそのまま使う
}))
```

選択肢B の方が既存データへの影響が小さく推奨。

---

## 7. 実装時の注意点

### 何を触ると他画面に副作用が出るか

| 変更箇所 | 副作用 |
|---|---|
| `join/route.ts` の nickname 設定 | 新規参加者のみ影響。既存参加者は変わらない |
| `room/[code]/page.tsx` の表示ロジック | room 待機画面のみ影響。play/result には影響なし |
| `room/[code]/route.ts` レスポンス加工 | room ページ全体に影響（既存 + 新規参加者） |

### キャッシュと既存データの注意点

- `RoomMember.nickname` はルーム参加時点のスナップショット
- 公開名を後から変更しても、既存ルームの nickname は更新されない
- 理想変更（選択肢B）を採用すれば、nickname に古い本名が保存されていても表示時に上書きできる

### provider 由来名が再混入しないために統一すべきこと

1. **join route** に `getDisplayName()` を必ず使う（今回の修正）
2. **`user_metadata` からの直接参照** を UI・API 全体で禁止（`lib/display-name.ts` の設計方針に明記）
3. `Profile.name` を表示に使っている箇所（`profile?.name` のフォールバック）をすべて除去

---

## 8. 検証項目

- [ ] ルーム参加時のメンバー表示が公開名になる
- [ ] displayName 未設定ユーザーが "ユーザーXXXX" と表示される（本名ではない）
- [ ] ルーム作成者（host）の表示名が従来通り公開名になっている
- [ ] ゲスト参加者の表示名が自分で入力した名前のまま
- [ ] owner roulette（play 画面）でも公開名が表示される
- [ ] result でも公開名のみが使われる
- [ ] プロフィール変更後にルームに再参加すると新しい公開名が反映される
- [ ] 既存参加者の表示名が適切にフォールバックされる（選択肢B採用時）
- [ ] Android Chrome での表示に回帰なし

---

## 9. Issue化候補

| Issue | タイトル | 優先度 | ブロッカー |
|---|---|---|---|
| **ISSUE-090**（本 Issue） | ルーム参加時の nickname を公開名に統一（join route 修正 + 表示層修正） | Critical | Yes |

### 実装タスク

1. `app/api/rooms/join/route.ts`
   - `getDisplayName` を import
   - profile upsert で `select: { id, displayName }` を追加
   - `resolvedNickname` を `getDisplayName(profile)` に変更

2. `app/room/[code]/page.tsx`
   - Member interface に `profile.displayName: string | null` を追加
   - `import { getDisplayName } from "@/lib/display-name"` を追加
   - 表示箇所 3カ所を `nickname || getDisplayName(profile) || "ゲスト"` に変更

3. `app/room/[code]/play/page.tsx`
   - 同様に `profile.name` フォールバックを除去

4. （理想変更）`app/api/rooms/[code]/route.ts`
   - GET レスポンスで profileId 持ちメンバーの nickname を `getDisplayName()` で上書き

## 受け入れ条件

- ルーム参加時のメンバー表示が公開名になる
- `user.user_metadata.full_name` が UI に出ない
- `Profile.name`（プロバイダ由来名）が表示フォールバックにならない
- ゲスト参加者は自分で入力した名前がそのまま表示される
- ルーム作成側・参加側で表示名ロジックが統一される
