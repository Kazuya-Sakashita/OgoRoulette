# ISSUE-257: Security(High) — セキュリティヘッダ完全欠落

## ステータス
🔲 TODO

## 優先度
**High / セキュリティ**

## カテゴリ
Security / Security Misconfiguration / Headers

---

## 概要

`next.config.mjs` に `headers()` 関数が存在せず、主要なセキュリティヘッダが一切設定されていない。
OgoRoulette は「誰が奢るか」を決める金銭的判断を伴うアプリであるため、
Clickjacking 攻撃の影響が特に深刻になりうる。

---

## 問題

```javascript
// next.config.mjs — headers() が存在しない
const nextConfig = {
  images: { ... },
  async redirects() { ... },
  // ❌ async headers() { } がない
}
```

### 欠落しているヘッダ

| ヘッダ | 役割 | 欠落による影響 |
|--------|------|--------------|
| `X-Frame-Options: DENY` | Clickjacking 防止 | 悪意ある iframe に埋め込まれる |
| `X-Content-Type-Options: nosniff` | MIME スニッフィング防止 | スクリプトとして誤解釈される可能性 |
| `Referrer-Policy: strict-origin-when-cross-origin` | Referrer 漏洩防止 | シェアリンク（ref=share）が外部に漏れる |
| `Permissions-Policy` | ブラウザ機能制限 | カメラ・マイク等が意図せず有効 |
| `Content-Security-Policy` | XSS 多層防御 | 将来の XSS 脆弱性の影響が拡大 |

---

## 悪用シナリオ

### Clickjacking 攻撃

1. 攻撃者が `https://ogo-roulette.vercel.app/home` を `opacity: 0` の iframe で自身のサイトに埋め込む
2. ユーザーを騙して「クリックゲーム」を実行させる
3. 透明な iframe 上のクリックが SPIN ボタンや「今は保存しない」ボタンに当たる
4. ユーザーが意図せずルーレットを実行したり、ログイン誘導モーダルを閉じたりする

```html
<!-- 攻撃者のサイト -->
<iframe src="https://ogo-roulette.vercel.app/home"
        style="opacity:0; position:absolute; top:0; left:0; width:100%; height:100%;"
        sandbox="allow-scripts allow-same-origin allow-forms">
</iframe>
<div style="position:relative; z-index:10;">クリックゲームに参加しよう！</div>
```

---

## 影響

- **現在の影響**: Clickjacking による意図しないスピン実行・操作誘導
- **将来の影響**: CSP なしで XSS が発生した場合、スクリプト実行を防ぐ手段がない
- **Referrer 漏洩**: `?ref=share&winner=` を含む URL が外部サービスの Referrer ログに記録される

---

## 対応方針

```javascript
// next.config.mjs に追加
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()',
        },
      ],
    },
  ]
},
```

### CSP は段階的に追加（別タスク推奨）

CSP の設定は Next.js の動的 script nonce が必要で複雑なため、上記4ヘッダを先に追加し、
CSP は別 ISSUE として対応する。

---

## 完了条件

- [ ] `X-Frame-Options: DENY` が全レスポンスに付与される
- [ ] `X-Content-Type-Options: nosniff` が全レスポンスに付与される
- [ ] `Referrer-Policy` が設定される
- [ ] `Permissions-Policy` が設定される
- [ ] `curl -I https://ogo-roulette.vercel.app/` でヘッダが確認できる
- [ ] ブラウザで iframe への埋め込みが拒否されることを確認

## 注意点

- `X-Frame-Options: SAMEORIGIN` ではなく `DENY` を使用する（同一オリジン埋め込みも不要）
- CSP の設定は next.js の `<Script>` や インライン style タグ等と競合しやすいため慎重に
- Vercel は HSTS を自動設定するため、`Strict-Transport-Security` は不要

## 関連ファイル
- `next.config.mjs`

## Priority
**P1** — 金銭的判断を伴うアプリでの Clickjacking 防止は必須
