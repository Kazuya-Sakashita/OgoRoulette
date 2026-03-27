# ISSUE-035: NEXT_PUBLIC_SITE_URL と NEXT_PUBLIC_APP_URL の変数名不整合

## 概要

ISSUE-028 の open redirect 修正で `NEXT_PUBLIC_SITE_URL` を導入したが、既存コードは `NEXT_PUBLIC_APP_URL` を使用している。2種類の変数名が混在し、片方だけ設定した場合に期待動作しない。

## 背景

`auth/callback/route.ts` の open redirect 修正時に `NEXT_PUBLIC_SITE_URL ?? origin` を使うコードを追加した。
しかし `NEXT_PUBLIC_APP_URL` は以下で既に使われている：
- `app/api/auth/line/start/route.ts`
- `app/api/auth/line/callback/route.ts`
- `app/result/page.tsx`

## 問題点

- 現在何が起きているか: 本番 `.env` に `NEXT_PUBLIC_APP_URL` のみ設定した場合、`auth/callback` はそれを使わず `origin` (リクエスト URL) にフォールバックする
- ユーザー影響: Vercel では `origin` が正しく解決されるため多くの場合は問題ないが、CDN・プロキシ環境では間違ったドメインにリダイレクトされる可能性がある
- 技術的影響: 運用者がどちらの変数名を設定すべきか分からず設定漏れが起きやすい

## 原因

ISSUE-028 修正時に既存の `NEXT_PUBLIC_APP_URL` を参照せず、新規変数名 `NEXT_PUBLIC_SITE_URL` を使用した。

## 修正方針

`app/auth/callback/route.ts` の変数名を `NEXT_PUBLIC_APP_URL` に統一する：

```typescript
// 修正前
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? origin

// 修正後
const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin
```

## タスク

- [ ] `app/auth/callback/route.ts` を `NEXT_PUBLIC_APP_URL` に修正
- [ ] `.env.example` に `NEXT_PUBLIC_APP_URL` の説明コメントを追加
- [ ] 動作確認（Google OAuth ログイン → /home へのリダイレクト）

## 受け入れ条件

- `NEXT_PUBLIC_APP_URL` のみ設定すれば OAuth コールバックが正しくリダイレクトされる
- `NEXT_PUBLIC_SITE_URL` 変数名への参照が削除されている

## 優先度

Medium

## デプロイブロッカー

Yes（CDN/プロキシ環境では本番事故になりうる。Vercel 直接デプロイなら許容できるが、変数名の混乱は修正すべき）
