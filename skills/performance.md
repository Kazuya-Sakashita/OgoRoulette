# Performance — パフォーマンス最適化

## 現状の既知問題

| 問題 | 状態 | 対策 |
|---|---|---|
| Google Fonts CDN（render-blocking） | ⚠️ 未対応 | ISSUE-208: `next/font/google` 移行 |
| `translateY(100vh)` in globals.css:232 | ⚠️ 軽微 | `100dvh` に変更 |
| コンポーネントテストなし | ⚠️ 未対応 | ISSUE-209 |

## 解決済み

- **ChunkLoadError（ISSUE-152）:** SW Tombstone でキャッシュ全削除 + sessionStorage で3回/30秒リロード制限
- **rate-limit（ISSUE-201）:** Vercel KV をプライマリ、インメモリをフォールバック
- **RouletteWheel:** `next/dynamic` で動的インポート済み（初回 JS バンドル削減）
- **PrismBurst @keyframes 蓄積（ISSUE-204）:** `keyframe` 再利用で DOM 汚染を防止

## フォント対応（暫定）

```tsx
// app/layout.tsx — Turbopack 互換性問題のため CDN から直接読み込み
// 問題: next/font/google が古い Turbopack バージョンで動作しなかった
// 現状: Next.js 16.1.6 で next/font/google が正式対応済み → 移行可能
<link href="https://fonts.googleapis.com/css2?family=Inter..." rel="stylesheet" />
```

## next.config.mjs の画像設定

```js
// 許可リモートパターン
// - lh3.googleusercontent.com（Google アバター）
// - profile.line-sc.com / obs.line-apps.com / **.line-scdn.net（LINE アバター）
```

## Lighthouse 目標

| 指標 | 現状推定 | 目標 |
|---|---|---|
| Performance | 70〜75 | 85+ |
| Accessibility | 92 | 95+ |
| Best Practices | 100 | 100 |
| SEO | 100 | 100 |
