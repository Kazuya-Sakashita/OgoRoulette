# LP SEOデプロイ完了・Google Search Console申請

## 概要

issue-178（LP Next.js統合）の実装は完了（デプロイ待ち）だが、Google Search Console へのサイト登録・サイトマップ送信・インデックス申請が未実施。SEO効果を発現させるための残タスクを完遂する。あわせて `sitemap.xml` と `robots.txt` を Next.js から自動生成する設定を追加する。

## 背景

AARRR Acquisition スコア（10/20）の根本的な問題は「検索からの流入がほぼゼロ」であること。issue-178でLP（/lp）がNext.jsページとして完成し、JSON-LDとメタデータが整備された。しかしGoogleにインデックスされなければSEO効果は発現しない。Search Consoleへの申請は手動ステップのため、ISSUEとして明示的に管理する。

同時に `sitemap.xml` がアプリに存在しないため、Googlebotがクロールする際にどのページを優先すべきか判断できない状態。

## 問題

- `https://ogo-roulette.vercel.app/lp` がGoogleにインデックスされているか不明
- `sitemap.xml` が存在しない（`/sitemap.xml` → 404）
- `robots.txt` が存在しない（デフォルト動作に依存）
- Google Search Console のサイトプロパティが未設定

## 目的

- OgoRouletteの主要ページ（/lp, /home, /how-to-use）をGoogleにインデックスさせる
- `sitemap.xml` を自動生成してクロール効率を上げる
- Search Consoleで検索パフォーマンスを計測できるようにする
- AARRR Acquisition スコアを段階的に改善する

## 対応内容

### Step 1: Next.js sitemap.xml 自動生成

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://ogo-roulette.vercel.app',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: 'https://ogo-roulette.vercel.app/lp',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: 'https://ogo-roulette.vercel.app/how-to-use',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]
}
```

### Step 2: robots.txt 設定

```typescript
// app/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/'],
    },
    sitemap: 'https://ogo-roulette.vercel.app/sitemap.xml',
  }
}
```

### Step 3: issue-178のデプロイ確認

- `/lp` ページが Next.js静的ページとして配信されていることを確認
- `/lp` のHTMLソースに `<title>`, `<meta description>`, `<script type="application/ld+json">` が含まれることを確認

### Step 4: Google Search Console 設定（手動作業）

1. https://search.google.com/search-console にアクセス
2. プロパティを追加（URL プレフィックス: `https://ogo-roulette.vercel.app`）
3. 所有権確認（Vercel にHTMLファイル配置 or DNS TXTレコード）
4. サイトマップ送信: `https://ogo-roulette.vercel.app/sitemap.xml`
5. `/lp` の URL 検査でインデックス申請

### Step 5: Vercel Analytics でのページビュー計測確認

Vercel Analytics（`@vercel/analytics` 導入済み）で `/lp` のPVが計測されていることを確認する。

## 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `app/sitemap.ts` | 新規作成（sitemap.xml自動生成） |
| `app/robots.ts` | 新規作成（robots.txt設定） |

## 完了条件

- [ ] `https://ogo-roulette.vercel.app/sitemap.xml` が有効なXMLを返す
- [ ] `https://ogo-roulette.vercel.app/robots.txt` が正しく返る
- [ ] Google Search Console にサイトプロパティが登録されている
- [ ] サイトマップが Search Console から送信・受理されている
- [ ] `/lp` が Search Console の URL検査でインデックス申請済み
- [ ] `npm run build` でエラーなし

## ステータス

**未着手** — 2026-04-04

## 優先度

**Recommended** — SEO効果の発現に必要な実装・運用タスク。issue-178の効果を引き出すための後続作業。

## 期待効果

- AARRR Acquisition: 10 → 15 (+5)（6ヶ月後の自然流入増加を見込む）
- 総合スコア: 65 → 66 (+1)

## 関連カテゴリ

Growth / SEO / Engineering

## 関連ISSUE

- issue-178（LP Next.js統合・完了デプロイ待ち）
- issue-013（アナリティクス設定）
- issue-097（X シェア OGP強化）
