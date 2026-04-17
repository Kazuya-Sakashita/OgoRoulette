# ISSUE-263: Security(Medium) — CSP（Content Security Policy）未設定（✅ 修正済み）

## ステータス
✅ 修正済み（2026-04-17）— next.config.mjs に Content-Security-Policy ヘッダを追加

## 優先度
**Medium / セキュリティ（将来対応）**

## カテゴリ
Security / Security Headers / XSS Defense-in-Depth

---

## 概要

`next.config.mjs` に `X-Frame-Options` 等の主要セキュリティヘッダは追加済み（ISSUE-257）だが、
CSP（Content Security Policy）は Next.js の動的スクリプト（runtime / Framer Motion 等）と
競合しやすいため、別途対応として保留となっている。
現時点では入力サニタイズ・React 自動エスケープで XSS を上流で防止しているため実害はないが、
CSP は XSS が発生した場合の最終防衛ラインとして機能するため、段階的に導入すべきである。

---

## 問題

```javascript
// next.config.mjs — CSP のコメント
// CSP は Next.js の動的スクリプト（runtime / Framer Motion）と競合するため別途対応
```

現状の XSS 対策:
- ✅ sanitizeName() で制御文字除去
- ✅ React JSX が自動エスケープ
- ✅ dangerouslySetInnerHTML は固定 JSON-LD のみ
- ❌ CSP がないため、XSS が発生した場合に実行を防ぐ手段がない

---

## なぜ Medium か

- 現在 XSS 脆弱性は存在しない
- CSP がなくても現状は安全
- ただし将来のコード追加（`dangerouslySetInnerHTML` の誤用等）で XSS が発生した場合、CSP があれば被害を最小化できる
- 「今は安全」でも「将来にわたって安全」を保証するには CSP が必要

---

## 対応方針

### Phase 1: Report-Only モードで導入（開発負担小）

```javascript
// next.config.mjs
{
  key: "Content-Security-Policy-Report-Only",
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Next.js runtime のため一時的に緩め
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://profile.line-sc.com https://obs.line-apps.com https://*.line-scdn.net",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
  ].join("; "),
},
```

### Phase 2: Strict CSP への移行

Next.js 16 の `nonce` 機能を使って `'unsafe-inline'` を排除する。

```typescript
// middleware.ts で nonce を生成して headers に付与
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
const cspHeader = `
  default-src 'self';
  script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
  style-src 'self' 'nonce-${nonce}';
  img-src 'self' data: blob: https://lh3.googleusercontent.com ...;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co;
  frame-ancestors 'none';
`
```

---

## 完了条件

- [ ] Phase 1: `Content-Security-Policy-Report-Only` を本番で有効化し、違反レポートを収集
- [ ] 違反レポートを分析して必要なディレクティブを特定
- [ ] Phase 2: `Content-Security-Policy` を本番で有効化（違反が0件になってから）
- [ ] `frame-ancestors 'none'` を CSP で設定（`X-Frame-Options` と重複するが冗長防御として有効）

## 注意点

- Framer Motion はインライン style を多用するため `style-src 'unsafe-inline'` が必要
- Next.js の Image コンポーネントは `data:` URI を使うため `img-src` に `data:` が必要
- Supabase Realtime は WebSocket を使うため `connect-src` に `wss://*.supabase.co` が必要
- Report-Only → 本番適用の移行は慎重に行う（誤設定でアプリが壊れる）

## 関連ファイル
- `next.config.mjs`
- `middleware.ts`（nonce 生成の場合）
