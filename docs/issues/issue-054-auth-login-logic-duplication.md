# ISSUE-054: Google / LINE ログインロジックが2ページに重複実装されている

## ステータス
✅ 完了（`lib/auth.ts` による共通化）

## 概要
`app/page.tsx`（ウェルカムページ）と `app/auth/login/page.tsx`（ログインページ）に、Google / LINE の OAuth 開始処理がほぼ同じコードで重複していた。

## 背景
アプリはウェルカムページ（`/`）とログインページ（`/auth/login`）の両方にログインボタンを持つ。機能追加や修正のたびに2箇所を更新する必要があり、ISSUE-053のように実装差異が生まれていた。

## 問題点

### 重複コード（Before）
```typescript
// app/page.tsx
const handleGoogleLogin = async () => {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
        `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeReturn)}`,
    },
  })
}

// app/auth/login/page.tsx（別実装、returnTo なし）
const handleSocialLogin = async (provider: "google") => {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
        `${window.location.origin}/auth/callback`,  // ← ?next= がない
    },
  })
}
```

### リスク
- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` フォールバックの有無が異なっていた
- returnTo の有無が異なっていた
- 将来のプロバイダー追加時に2箇所を修正し忘れるリスク

## 修正内容（After）

### `lib/auth.ts` に共通ロジックを集約
```typescript
export function buildOAuthRedirectUrl(returnTo?: string | null): string { ... }
export function startLineAuth(returnTo?: string | null): void { ... }
export async function startSupabaseOAuth(provider, returnTo?): Promise<void> { ... }
```

両ページから `lib/auth.ts` をインポートし、重複を排除した。

## 優先度
🟡 Medium — 機能影響なし。技術負債・保守性

## 影響範囲
- `lib/auth.ts`: 新規（単一責任の場所）
- `app/page.tsx`: `handleGoogleLogin` / `handleLineLogin` を `lib/auth.ts` 経由に変更
- `app/auth/login/page.tsx`: 同上
