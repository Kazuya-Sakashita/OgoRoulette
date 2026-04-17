# ISSUE-289: Security — CSP により Vercel Analytics とフォントがブロックされていた（✅ 修正済み）

## ステータス
✅ 修正済み（2026-04-18）— next.config.mjs の CSP ディレクティブを更新

## 優先度
**Medium / セキュリティ / 可観測性**

## カテゴリ
Security / CSP / Vercel Analytics / Font

---

## 問題

ISSUE-263 で追加した `Content-Security-Policy` ヘッダーが以下の 2 つをブロックしていた。

### 1. Vercel Analytics スクリプトのブロック

`app/layout.tsx` で `<Analytics />` コンポーネント（`@vercel/analytics/next`）を使用しているが、
外部スクリプト URL が `script-src` に含まれていなかった。

```
ブロックされたスクリプト: https://va.vercel-scripts.com/v1/script.js
ブロックされたデータ送信先: https://vitals.vercel-insights.com
```

現状の `script-src 'self' 'unsafe-inline' 'unsafe-eval'` は外部ドメインのスクリプトを許可しない。

### 2. フォントのブロック

`next/font/google` は ISSUE-208 でビルド時セルフホスト済み（`/_next/static/media/`）だが、
`font-src` ディレクティブが未設定のため `default-src 'self'` にフォールバックしていた。
Next.js が CSS `@font-face` 内でフォントを `data:` URI として埋め込むケースでブロックが発生した。

---

## 原因

ISSUE-263 の CSP 追加時（Report-Only フェーズをスキップして直接適用）に、
Vercel Analytics と `next/font` の要件を考慮していなかった。
ISSUE-280 の「CSP 本番未検証」で懸念した通り、本番での動作確認が不十分だった。

---

## 修正内容

`next.config.mjs` の `Content-Security-Policy` ヘッダーを以下の通り変更。

```javascript
// 変更前
"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
"connect-src 'self' https://*.supabase.co wss://*.supabase.co",
// font-src なし（default-src 'self' にフォールバック）

// 変更後
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
"font-src 'self' data:",
"connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com",
```

### 追加したドメインとリスク評価

| ディレクティブ | 追加内容 | リスク |
|------------|---------|--------|
| `script-src` | `https://va.vercel-scripts.com` | Vercel 管理ドメイン。低 |
| `connect-src` | `https://vitals.vercel-insights.com` | 閲覧統計データのみ送信。低 |
| `font-src`（新規） | `'self' data:` | セルフホストフォント + data: URI。フォント限定で低 |

- `unsafe-inline` / `unsafe-eval` の範囲は拡大せず
- ワイルドカードドメイン（`*`）は追加せず
- `object-src 'none'` / `base-uri 'self'` は維持

---

## 関連 ISSUE

- ISSUE-263: CSP 追加（元の実装 ISSUE）
- ISSUE-280: CSP 本番未検証（この問題を予測していた ISSUE）
