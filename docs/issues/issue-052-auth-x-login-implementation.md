# ISSUE-052: X（Twitter）ログインの実装

## ステータス
✅ 完了

## 概要
ログインページに「Xで続ける」ボタンが存在するが `handleComingSoon()` で「近日公開予定」トースト表示のみだった。Supabase ネイティブ Twitter OAuth を使って実装した。

## 背景
X は Supabase の組み込み OAuth プロバイダー（`provider: "twitter"`）として提供されている。Google と同様の `signInWithOAuth` フローが使用でき、既存の `app/auth/callback/route.ts` がそのままコールバックとして機能する。カスタム実装は不要。

## 問題点
- `handleSocialLogin` の型が `provider: "google"` に制限されており `"twitter"` を受け付けない
- X ボタンの `onClick` が `handleComingSoon("X")` になっており実際の OAuth を開始しない
- 「近日公開予定」ディバイダーが表示されており完成済み機能に見えない

## 修正内容

### `lib/auth.ts`（新規作成）
```typescript
export type SupabaseOAuthProvider = "google" | "twitter"

export async function startSupabaseOAuth(
  provider: SupabaseOAuthProvider,
  returnTo?: string | null
): Promise<void> { ... }
```

### `app/auth/login/page.tsx`
```tsx
// Before
const handleSocialLogin = async (provider: "google") => { ... }
<button onClick={() => handleComingSoon("X")} ...>

// After
const handleSocialLogin = async (provider: SupabaseOAuthProvider) => {
  await startSupabaseOAuth(provider, returnTo)
}
<button onClick={() => handleSocialLogin("twitter")} ...>
```

X ボタンのスタイルを `bg-black text-white` に変更し、active なボタンとして表示する。

## Supabase ダッシュボード設定（ユーザーが実施）
1. Supabase ダッシュボード → Authentication → Providers → Twitter/X
2. Twitter Developer Portal でアプリを作成し Client ID / Client Secret を取得
3. Supabase に設定
4. Redirect URL: `https://[your-supabase-project].supabase.co/auth/v1/callback`

## Twitter ユーザーメタデータ
Twitter の `user_metadata` は以下のキーを持つ:
- `full_name`: 表示名
- `user_name`: @handle
- `avatar_url`: プロフィール画像

既存の `app/auth/callback/route.ts` の profile upsert は `full_name || name` で対応済み。追加変更不要。

## 優先度
🟠 High — ユーザー向け機能（既存ボタン UI があるのに動かない）

## 影響範囲
- `lib/auth.ts`: 新規
- `app/auth/login/page.tsx`: X ボタン実装・型修正
- `app/auth/callback/route.ts`: 変更なし（Google と同一フロー）
