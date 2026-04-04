# LP の Next.js 統合と SEO 最適化

## 概要

現在 `public/lp/` に配置されている静的 HTML のランディングページを Next.js のルート（`app/lp/page.tsx` または `app/(lp)/page.tsx`）に統合し、SEO・パフォーマンス・メンテナンス性を改善する。
同時に「飲み会ゲーム」「おごり 決め方」などの検索キーワードからの自然流入を設計する。

## 背景

現在の LP の問題:
1. `public/lp/index.html` は静的 HTML のため、Next.js のメタデータ管理・OGP 管理・フォント最適化の恩恵を受けていない
2. LP の OGP 画像は `app/opengraph-image.tsx`（動的生成）とは別系統で管理されており、統一されていない
3. ランディングページとアプリ本体で Tailwind のスタイルが別管理になっており、デザイン変更時の二重メンテが必要
4. Google Search Console 等でのインデックス状況が不明
5. AARRR の Acquisition スコアが 45 と低く、「ユーザーが来るための入口」が不足している

## 現状のLP

- `public/lp/index.html` — 静的 HTML
- `public/lp/ogoroulette-lp.pdf` — PDF 版（開発用ドキュメント）
- アクセス URL: `https://ogo-roulette.vercel.app/lp/`（静的ファイルとして配信）

## 対応内容

### Step 1: Next.js ルートへの移行

`app/lp/page.tsx` を作成し、現在の `public/lp/index.html` の内容を JSX/TSX に変換する。

```typescript
// app/lp/page.tsx
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "OgoRoulette — 飲み会・ランチのおごりをルーレットで公平に決めよう",
  description: "飲み会・合コン・社内ランチ。おごる人をリアルタイムルーレットで公平に決める無料Webアプリ。QRコードで全員の画面が同期。スマホだけで使える。",
  keywords: ["おごり", "決め方", "飲み会", "ゲーム", "ルーレット", "幹事", "割り勘", "合コン", "社内ランチ"],
  openGraph: {
    title: "OgoRoulette — 飲み会のおごりをルーレットで決めよう",
    description: "リアルタイムルーレットで全員の画面が同期。QRコードで参加、公平に決まる。",
    url: "https://ogo-roulette.vercel.app/lp",
    type: "website",
  },
}

export default function LPPage() {
  return (
    // 現在の lp/index.html の内容を JSX に変換
  )
}
```

### Step 2: SEO キーワード設計

ターゲットキーワード（月間検索ボリューム推定）:

| キーワード | ボリューム推定 | 競合 | 優先度 |
|-----------|-------------|------|--------|
| 飲み会 ゲーム アプリ | 高 | 中 | 高 |
| おごり 決める 方法 | 中 | 低 | 高 |
| 割り勘 ルーレット | 低 | 低 | 中 |
| 幹事 ゲーム スマホ | 中 | 中 | 中 |
| じゃんけん 代替 アプリ | 低 | 低 | 低 |

LP の H1・H2 テキストにこれらのキーワードを自然に含める。

### Step 3: 構造化データ（JSON-LD）追加

```typescript
// app/lp/page.tsx に WebApplication の構造化データを追加
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "OgoRoulette",
  "description": "飲み会・ランチのおごりをリアルタイムルーレットで公平に決めるWebアプリ",
  "url": "https://ogo-roulette.vercel.app",
  "applicationCategory": "GameApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "JPY"
  }
}
```

### Step 4: LP → アプリへの導線最適化

- ヒーローセクションの CTA ボタンを `<Link href="/home">` に変更（SPA ナビゲーション）
- 「今すぐ使ってみる」CTAを LP 内に複数配置（スクロール位置に応じて）
- デモ用ルーレット（issue-096）が実装済みであれば LP に埋め込む

### Step 5: `public/lp/` のリダイレクト設定

`next.config.ts` に `/lp/` → `/lp`（Next.js ルート）へのリダイレクトを追加し、既存の URL を維持する。

```typescript
// next.config.ts
async redirects() {
  return [
    {
      source: "/lp/index.html",
      destination: "/lp",
      permanent: true,
    },
  ]
}
```

## 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `app/lp/page.tsx` | 新規作成（静的 HTML を JSX に変換） |
| `app/lp/opengraph-image.tsx` | LP 専用 OGP 画像生成（オプション） |
| `next.config.ts` | `/lp/index.html` → `/lp` リダイレクト |
| `public/lp/index.html` | 移行完了後に削除 |

## 完了条件

- [ ] `https://ogo-roulette.vercel.app/lp` が Next.js ページとして配信される
- [ ] LP の `<title>` と `<meta description>` に対象キーワードが含まれている
- [ ] JSON-LD 構造化データが含まれている
- [ ] Google Search Console でインデックス申請済み
- [ ] `/lp/index.html` へのアクセスが `/lp` にリダイレクトされる
- [ ] LP → `/home` への CTA が機能している

## 優先度

**Nice-to-have（Growth）** — 即座に Acquisition を改善するわけではないが、長期的な SEO 資産として有効。
AARRR Acquisition スコア: 45 → 52（+7）への寄与を期待。

## 期待効果

- Acquisition スコア（AARRR）: 45 → 52（+7）
- 自然検索からの月間流入: 数十 → 数百（6ヶ月後）
- LP の OGP・メタデータ管理が統一され、メンテナンスコストが下がる

## 関連カテゴリ

Growth / Engineering / SEO

## 備考

- 関連 issue: issue-096（LP デモルーレット）、issue-137（LP ソーシャルプルーフ）、issue-097（X シェア OGP 強化）
- 静的 HTML から JSX への変換は機械的な作業だが、Tailwind クラスの移行に注意
- `public/lp/ogoroulette-lp.pdf` は開発用ドキュメントのため移行対象外
- Google Search Console の設定が未確認の場合は同時に対応すること
