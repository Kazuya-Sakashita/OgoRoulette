# ISSUE-246: Security(High) — Open Redirect リスク：NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL（✅ 修正済み）

## ステータス
🔲 TODO

## 優先度
**High / セキュリティ**

## カテゴリ
Security / Open Redirect / OAuth / Environment Variables

---

## 概要

`lib/auth.ts` が `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` 環境変数を優先して
OAuth リダイレクト URL に使用している。
`NEXT_PUBLIC_` 接頭辞のため **ブラウザ側のバンドルに埋め込まれる**。
本番環境に誤ってこの変数が設定された場合、
OAuth コールバックが攻撃者のサーバーに送信される Open Redirect / セッション乗っ取りが発生する。

---

## 問題

```typescript
// lib/auth.ts:19-23
export function buildOAuthRedirectUrl(returnTo?: string | null): string {
  if (process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL) {
    return process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL  // ← 無条件で使用
  }
  // ...
}
```

### 問題点

1. **環境チェックがない**: 変数が設定されていれば本番・開発問わず使用される
2. **クライアントバンドルに含まれる**: `NEXT_PUBLIC_` のため `next build` でクライアントサイドに露出
3. **Supabase ホワイトリストを迂回できる**: 任意の URL を設定すれば OAuth callback を奪取可能

### 悪用シナリオ

1. 開発者が誤って本番の `.env` または Vercel 環境変数に
   `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=https://attacker.com/callback` を設定
2. ユーザーが Google/LINE ログインを開始
3. OAuth コールバックが `attacker.com` に送られ、アクセストークンが漏洩

---

## 原因

開発用の設定が実行環境によるガードなしに本番コードパスに影響する設計。

---

## 影響

- **悪用可能性**: 設定ミスが必要（直接攻撃は不可）
- **発生時の影響**: 全ユーザーのOAuthセッション乗っ取り（Critical 級）
- **露出**: ビルド成果物（JavaScript バンドル）に含まれる

---

## 対応方針

### 案A: 環境変数自体を廃止（推奨）

```typescript
// lib/auth.ts: NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL を参照しない
export function buildOAuthRedirectUrl(returnTo?: string | null): string {
  const base = `${window.location.origin}/auth/callback`
  // ... returnTo の safe redirect のみ
}
```

開発時は Supabase ダッシュボードの Redirect URLs に `http://localhost:3000/auth/callback` を追加する。

### 案B: NODE_ENV チェックを追加（次善策）

```typescript
if (
  process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL &&
  process.env.NODE_ENV === "development"
) {
  return process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
}
```

ただし `NEXT_PUBLIC_` はバンドルに含まれるため、案A の廃止が最善。

---

## 完了条件

- [ ] `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` の参照を削除 or `NODE_ENV` ガードを追加
- [ ] `.env.example` にこの変数の危険性を明記するコメントを追加
- [ ] ローカル開発の代替手順をドキュメント化（Supabase ダッシュボードに localhost を追加）

## 注意点

- この変数を `.env.local` で使用している開発者がいる場合は、移行方法を案内する

## 関連ファイル
- `lib/auth.ts`
- `.env.example`
