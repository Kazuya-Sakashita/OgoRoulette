# ISSUE-038 — LINE ログイン "already registered" エラー

## ステータス

✅ 完了

## 概要

LINE でログインしようとすると `/api/auth/line/callback` が `/auth/error` にリダイレクトされ、ログインできない。

## 再現条件

1. LINE でログインを試みる（初回）
2. `verifyOtp` などのステップで何らかの理由で失敗 → `/auth/error` にリダイレクト
3. Supabase Auth にはユーザーが作成済み（`createUser` は成功していた）だが、Prisma `profile` は作成されていない
4. LINE で再度ログインを試みる
5. エラー: `step=user_create FAILED` / message: `A user with this email address has already been registered`

## 根本原因

`app/api/auth/line/callback/route.ts` の既存ユーザー確認に **Prisma `profile` テーブル** を使用していた。

```typescript
// 旧実装（バグあり）
const existingProfile = await prisma.profile.findUnique({
  where: { email: lineEmail },
  select: { id: true },
})

if (existingProfile) {
  // 既存ユーザーパス
} else {
  // createUser → 既に存在する場合は "already registered" でクラッシュ ← ここで死ぬ
}
```

**問題**: Supabase Auth と Prisma `profile` は独立したストレージ。
途中失敗状態（Supabase Auth にユーザーあり、Prisma profile なし）では:
- `prisma.profile.findUnique` → `null`（profile がない）
- `else` ブランチで `createUser` → **"already registered"** エラー
- `/auth/error` へリダイレクト

## 修正内容

**楽観的 create → already-exists フォールバック** パターンに変更。

```typescript
// 新実装（修正済み）
const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
  email: lineEmail,
  email_confirm: true,
  user_metadata: lineUserMeta,
})

if (createError) {
  const isAlreadyExists =
    createError.message.includes("already been registered") ||
    createError.message.includes("already registered")

  if (!isAlreadyExists) {
    // 予期しないエラー → /auth/error
    return NextResponse.redirect(`${origin}/auth/error`)
  }

  // Supabase Auth に既存ユーザー → generateLink でユーザー ID + トークンを同時取得
  const { data: existingLinkData } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink", email: lineEmail
  })
  supabaseUserId = existingLinkData.user.id
  hashedToken = existingLinkData.properties.hashed_token
  // メタデータ更新（non-blocking）
} else {
  supabaseUserId = createData.user.id
  // generateLink でセッション用トークン取得
}
// verifyOtp で hashedToken を使ってセッション確立
```

変更点:
1. `prisma.profile.findUnique` による存在確認を完全に削除
2. `createUser` を楽観的に実行
3. `"already registered"` の場合は `generateLink` でフォールバック（既存ユーザー ID + トークンを取得）
4. 新規/既存共通の `hashedToken` 変数で `verifyOtp` を呼ぶ

## テスト

`app/api/auth/line/callback/route.test.ts` を新規作成（10ケース）:
- 新規ユーザー正常ログイン
- 既存ユーザー再ログイン（"already registered" フォールバック）
- "already been registered" バリエーション
- 中途失敗状態（ISSUE-038 バグ再現）からの回復
- state 不一致、createUser 予期しないエラー、generateLink 失敗、verifyOtp 失敗、LINE トークン取得失敗

## 影響範囲

- `app/api/auth/line/callback/route.ts` のみ
- Google OAuth・ゲストフローは無関係
- Prisma `profile.upsert`（ステップ 6）は変更なし

## 関連ファイル

- `app/api/auth/line/callback/route.ts`
- `app/api/auth/line/callback/route.test.ts`
