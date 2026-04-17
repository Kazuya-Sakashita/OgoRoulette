# ISSUE-258: Security(Medium) — LINE OAuth metadata 更新が non-blocking でプロフィール不整合リスク（✅ 修正済み）

## ステータス
🔲 TODO

## 優先度
**Medium / セキュリティ（データ整合性）**

## カテゴリ
Security / Authentication / Data Integrity / LINE OAuth

---

## 概要

LINE OAuth コールバック（`/api/auth/line/callback`）において、
既存ユーザーの Supabase Auth metadata 更新が **fire-and-forget（non-blocking）** で実行される。
この更新が失敗した場合、次回ログイン時のプロフィール表示名が古いまま残り、
ユーザーが LINE 側で displayName を変更してもアプリに反映されない状態が続く。

---

## 問題

```typescript
// app/api/auth/line/callback/route.ts:159-164
// メタデータを最新の LINE プロフィールに更新（non-blocking）
supabaseAdmin.auth.admin
  .updateUserById(supabaseUserId, { user_metadata: lineUserMeta })
  .then(({ error }) => {
    if (error) console.warn("[LINE callback] step=user_update WARN", { message: error.message })
  })
// ← await していないため、次の処理（Prisma profile.upsert）が古い metadata で動く
```

### 処理の流れ

```
1. LINE プロフィール取得（blocking）
2. Supabase Auth ユーザー存在確認（blocking）
3. ✗ metadata 更新（non-blocking = 並行実行・結果無視）
4. magic link 生成（blocking）  ← 3の結果に関わらず続行
5. Supabase セッション確立（blocking）  ← 古い metadata のまま
6. Prisma profile.upsert（blocking）  ← セッションの古い metadata を使用
```

---

## 悪用シナリオ

直接的な悪用は難しいが、以下のデータ不整合が発生する：

1. LINE でプロフィール名を変更（例: 「田中」→「田中次郎」）
2. LINE でログイン → metadata 更新が失敗（ネットワークエラー等）
3. アプリの displayName が「田中」のまま残る
4. 当選発表画面・シェア画面で古い名前が表示され続ける

より深刻なケース：
- `console.warn` のみでエラーを握りつぶすため、問題が継続的に発生しても気づかない
- 本番ログで `[LINE callback] step=user_update WARN` が出続けても運用監視が難しい

---

## 影響

- **セキュリティ影響**: 低（認証自体は成功する）
- **データ整合性影響**: 中（プロフィール情報が古いまま残る）
- **UX 影響**: 中（名前が更新されない → シェア時に意図しない名前が使われる）

---

## 対応方針

```typescript
// 案A: blocking に変更（推奨）
const { error: updateError } = await supabaseAdmin.auth.admin
  .updateUserById(supabaseUserId, { user_metadata: lineUserMeta })
if (updateError) {
  // エラーでもログイン自体は継続（metadata 更新失敗は non-critical）
  console.warn("[LINE callback] step=user_update WARN", { message: updateError.message })
}

// 案B: セッション確立後に Prisma profile.upsert で最新の LINE data を使う
// → profile.upsert に lineProfile から直接 name/avatarUrl を渡す
```

---

## 完了条件

- [ ] `updateUserById` を `await` で blocking に変更
- [ ] エラー時もログイン処理を継続する（catch で握りつぶさない）
- [ ] LINE でプロフィール名を変更した場合、次回ログイン時にアプリ側も更新されることを確認

## 注意点

- `await` 化してもログイン処理自体はエラーで中断しない（エラーは warn として記録のみ）
- 変更後、LINE OAuth フローが正常に動作することを本番環境で確認

## 関連ファイル
- `app/api/auth/line/callback/route.ts`
