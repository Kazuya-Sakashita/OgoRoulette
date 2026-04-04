# ISSUE-056: X（Twitter）ログインには Supabase ダッシュボード設定が必要（デプロイ前作業）

## ステータス
✅ 完了 — Twitter Developer Portal OAuth 2.0 設定・Supabase ダッシュボード Twitter プロバイダー有効化 済み（2026-04-05）

## 概要
X ログインのフロントエンド実装は完了したが、実際に動作させるには Supabase ダッシュボードと Twitter Developer Portal での設定が必要。

## 背景
ISSUE-052 でフロントエンド実装（`provider: "twitter"`）は完了。Supabase は Twitter を組み込みプロバイダーとして提供しているため、設定さえ入れれば追加コードは不要。

## 必要な作業

### 1. Twitter Developer Portal
1. https://developer.twitter.com/ でアプリを作成 / 既存アプリを利用
2. App Settings → Authentication settings → OAuth 2.0 を有効化
3. Callback URL に以下を追加:
   ```
   https://[your-supabase-project-ref].supabase.co/auth/v1/callback
   ```
4. Client ID と Client Secret を取得

### 2. Supabase ダッシュボード
1. Authentication → Providers → Twitter/X
2. 「Enable Sign in with Twitter」をオン
3. Client ID / Client Secret を入力
4. Save

### 3. `.env.local` の `X_CLIENT_ID` について
現在 `.env.local` に `X_CLIENT_ID` が存在するが、Supabase ネイティブ OAuth では Next.js 側に Client ID/Secret を設定する必要はない（Supabase ダッシュボードに設定）。この環境変数は削除してよい。

### 4. `app/auth/callback/route.ts` の Twitter ユーザーメタデータ対応
Twitter の `user_metadata` は以下:
```
full_name: "表示名"
user_name: "@handle"
avatar_url: "https://..."
```
現在の profile upsert は `full_name || name` を使用しており Twitter でも動作する。

## 確認コマンド
```bash
# ローカルで Twitter ログインをテストする場合（Supabase redirect URL に localhost を追加）
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback
```

## 優先度
🔴 Critical（デプロイブロッカー）— 設定なしでは X ログインが `OAuth error` になる

## 影響範囲
- Supabase ダッシュボード設定のみ
- コード変更なし
