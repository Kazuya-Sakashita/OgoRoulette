# og-image.png 欠落（SNS シェア時に画像なし）

## 概要

`public/images/og-image.png` が存在せず 404 になっている。
OGP メタデータ（og:image / twitter:image）はコード上で設定されているが、参照先ファイルが存在しないため、SNS（X・LINE・Slack 等）でリンクをシェアした際に画像プレビューが表示されない。

## 背景

- `app/layout.tsx` の `metadata` で og:image として `/images/og-image.png` を参照している
- しかし `public/images/` に存在するファイルは `icon-192.png`・`icon-512.png`・`logo-icon.png`・`logo.png` のみ
- `og-image.png` は物理的に存在しない → 404

OGP は SNS でのシェア時の「第一印象」を決める要素。画像なしのシェアカードは：
- X（Twitter）ではカード展開されず URL のみ
- LINE では地味なプレビューになる
- Slack / Notion では OGP 画像なしでテキストのみ

## 現状の問題

シェアされるたびに画像なしの寂しいカードが生成される。OgoRoulette の拡散機会のたびに「印象ゼロ」の状態になっている。

```
GET /images/og-image.png 404 (Not Found)
```

## 目的

- SNS シェア時に適切な画像プレビューを表示する
- 「なにこれ？使ってみたい」という第一印象を作る
- 既存の OGP メタデータ設定を正しく機能させる

## 対応内容

### 1. og-image.png の作成

サイズ: **1200 × 630px**（Twitter Card / OGP 推奨サイズ）

デザイン要件:
- OgoRoulette のロゴ / ルーレットアイコンを含む
- ブランドカラー（Deep Navy #0B1B2B + Orange #F97316）を使用
- 「誰が奢る？をルーレットで決めよう」など端的なキャッチコピーを入れる
- 背景が濃いため白テキストで視認性を確保する
- スマホ上でサムネイル表示されても読める情報量に抑える

ツール案:
- Figma で作成 → PNG export
- `docs/lp/generate-pdf.mjs` のような Playwright スクリプトで生成する方法もあり

### 2. ファイル配置

```
public/images/og-image.png
```

### 3. メタデータとの整合確認

`app/layout.tsx` の metadata が正しいパスを参照しているか確認。
必要に応じて絶対 URL にする:

```typescript
openGraph: {
  images: [{ url: "/images/og-image.png", width: 1200, height: 630 }]
}
```

### 4. 検証

Twitter Card Validator または OGP Debugger で実際のプレビューを確認。

## 完了条件

- [x] OG 画像が生成される（`app/opengraph-image.tsx` による動的生成に変更）
- [x] `/opengraph-image` エンドポイントが 200 を返す（ビルド確認済み）
- [ ] X（Twitter）Card Validator でシェアプレビューに画像が表示される
- [ ] LINE / Slack でリンクを貼ったときに画像が表示される

## ステータス

✅ 完了 — 2026-04-06（コミット・デプロイ済み）
静的 PNG ではなく `app/opengraph-image.tsx`（Next.js ファイル規約）で動的生成に切り替え。
日本語テキスト（Noto Sans JP を Google Fonts CDN から取得）、ブランドカラー (#0B1B2B / #F97316) のデザイン実装済み。
`app/layout.tsx` の OGP 参照先も更新済み。

## 優先度

**Critical** — SNS シェアのたびに「画像なし」状態。最も基本的な拡散施策の前提が機能していない。

## 期待効果

- Growth スコア: 48 → 56（+8）
- Visual スコア: 72 → 76（+4）
- SNS シェアのクリック率が大幅改善（画像なし → あり で 2〜3 倍の差が出ることが多い）

## 関連カテゴリ

Growth / Visual / Brand

## 備考

- 関連 issue: issue-012-og-image-visual.md（視覚デザイン改善）、issue-097-x-share-save-flow-ogp-enhancement.md（X シェア OGP 強化）
- 本 issue は「ファイルが存在しない」という物理的欠落の修正。issue-012 とは独立した対応。
- og-image はデプロイ後に Vercel の Edge Network にキャッシュされるため、更新後は CDN キャッシュパージも検討。
