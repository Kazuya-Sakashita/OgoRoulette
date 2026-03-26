# ISSUE-028: auth/callback の open redirect 脆弱性 — OAuth後に任意ドメインへリダイレクト可能

## 概要

`app/auth/callback/route.ts` が本番環境でリダイレクト先を `x-forwarded-host` ヘッダーから構築している。攻撃者がこのヘッダーを偽造できる環境下では、OAuth 認証後にユーザーを任意のドメイン（フィッシングサイト等）へリダイレクトできる。

## 背景

OAuth コールバックは「認証後にどこへ戻るか」を制御する。`x-forwarded-host` はリバースプロキシが設定するヘッダーだが、一部の環境（CDN 設定次第）ではクライアントが偽造可能。認証後のリダイレクト先として外部ドメインを指定できると、セッションが第三者に渡る可能性がある。

## 問題点

- 現在何が起きているか:

```typescript
// app/auth/callback/route.ts
} else if (forwardedHost) {
  return NextResponse.redirect(`https://${forwardedHost}${next}`)
}
```

`forwardedHost` の値が検証されていない。`next` パラメーターも外部 URL を含む任意の値を受け付ける。

- ユーザー影響: Google ログイン後にフィッシングサイトへリダイレクトされる可能性。セッション情報が盗用されるリスク
- 技術的影響: OWASP Top 10 の CWE-601（URL Redirection to Untrusted Site）に該当

## 原因

`x-forwarded-host` の信頼と `next` パラメーターの無検証。

## 修正方針

1. `next` パラメーターを相対パス（`/` で始まる）に限定するバリデーションを追加
2. `x-forwarded-host` の代わりに `NEXT_PUBLIC_SITE_URL` 環境変数で origin を固定する
3. または Supabase 推奨の `getURL()` ヘルパーを使ってサイト URL を決定する

```typescript
// next パラメーターを相対パスに限定
const safeNext = next.startsWith("/") ? next : "/home"

// origin を環境変数から固定
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? origin
return NextResponse.redirect(`${siteUrl}${safeNext}`)
```

## タスク

- [ ] `app/auth/callback/route.ts` の `next` パラメーター検証を追加（相対パスのみ許可）
- [ ] `x-forwarded-host` を使ったリダイレクト構築を廃止し、環境変数またはリクエスト origin を使用
- [ ] 動作確認: 正常な Google OAuth フローでリダイレクトが成功すること
- [ ] 動作確認: 不正な `next` パラメーター（`//evil.com` 等）でリダイレクトされないこと
- [ ] 回帰確認: ローカル開発環境でのコールバックが機能すること

## 受け入れ条件

- `next` に外部 URL を指定してもアプリ内パスにリダイレクトされる
- OAuth 後のリダイレクト先が自サイトの origin のみに限定される
- ローカル開発が引き続き動作する

## 優先度

High（セキュリティ脆弱性）

## デプロイブロッカー

Yes — OAuth フローを持つアプリの open redirect は公開前に必ず修正すべきセキュリティ問題
