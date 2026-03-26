# ISSUE-032: next.config の images.unoptimized:true で画像最適化が無効化されモバイル通信が重い

## 概要

`next.config.mjs` に `images: { unoptimized: true }` が設定されており、Next.js の画像最適化（WebP 変換・サイズ最適化・遅延読み込み）が完全に無効。Google アカウントのアバター画像（最大 1MB 超の JPEG）がフルサイズで配信され、モバイル接続では表示が遅い。

## 背景

`unoptimized: true` は通常、Turbopack/SSG の一時的なワークアラウンドとして設定される。しかしそのまま本番に出るとモバイルユーザーへの影響が大きい。

## 問題点

- 現在何が起きているか: `next/image` の最適化が一切機能しない
- ユーザー影響: パーティー会場の 4G/5G 回線でアバター画像の読み込みが遅い。ページ全体のパフォーマンスが低下
- 技術的影響: Lighthouse Performance スコアが低下

## 原因

```javascript
// next.config.mjs（推定）
images: { unoptimized: true }
```

Turbopack 開発時の互換性問題のワークアラウンドとして追加されたが、本番用の設定に移行されていない。

## 修正方針

`unoptimized: true` を削除し、外部画像ドメインを `remotePatterns` で明示的に許可する:

```javascript
images: {
  remotePatterns: [
    { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google アバター
    { protocol: "https", hostname: "*.supabase.co" }, // Supabase Storage
  ],
},
```

## タスク

- [ ] `next.config.mjs` の `unoptimized: true` を削除
- [ ] 使用している外部画像ドメインを `remotePatterns` に追加
- [ ] `bun run build` でビルドエラーがないことを確認
- [ ] 動作確認: 本番ビルドでアバター画像が表示されること

## 受け入れ条件

- `next/image` の WebP 変換・サイズ最適化が有効になる
- 外部ドメインからの画像が正しく表示される
- Lighthouse Performance スコアが改善される

## 優先度

Medium

## デプロイブロッカー

No（機能的には動作する）。ただしモバイルパフォーマンスへの影響があるため早期対応推奨
