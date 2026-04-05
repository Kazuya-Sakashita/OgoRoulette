# ISSUE-211: AARRR-Acquisition強化 — Google Search Console + OGP動的画像 + コンテンツSEO

## ステータス
📋 未着手

## 優先度
**Recommended** — Acquisition が 3/5 で頭打ち。オーガニック流入がほぼゼロ。

## カテゴリ
SEO / Marketing / Growth

## 対象スコア
AARRR-Acquisition: +1.5 / G-STACK-Strategy: +1

---

## 背景

`app/layout.tsx` には keywords・OGP・Twitter Card が設定されており、LP も存在する。
しかし:
- Google Search Console に登録されていない（インデックス状況不明）
- OGP 画像が `/opengraph-image` 参照だが内容不明
- LP が Next.js に組み込まれたが SEO 最適化の確認がされていない
- 「おごり ルーレット アプリ」「飲み会 誰が払う アプリ」などのキーワードで検索順位不明

---

## 問題

### ① Google Search Console 未登録

インデックス数・クリック率・表示回数がゼロかどうかすら分からない。
`sitemap.xml` の存在確認と submit が未完了。

### ② OGP 動的画像の品質未確認

`/opengraph-image` が Next.js の `ImageResponse` で生成されているが、
実際に X（Twitter）や LINE でシェアした際の見た目が未確認。
「シェアしたら画像が真っ白だった」は致命的。

### ③ 競合キーワードでの未出現

「おごり決める アプリ」「飲み会 おごり ルーレット」「順番決め アプリ 無料」
これらのキーワードで Google 検索しても OgoRoulette が出ない可能性が高い。

---

## 改善内容

### Step 1: Google Search Console 登録

1. `https://search.google.com/search-console` でプロパティ追加
2. DNS TXT レコードまたは HTML ファイルで確認
3. `sitemap.xml` を作成して submit

```tsx
// app/sitemap.ts (新規作成)
export default function sitemap() {
  return [
    { url: 'https://ogo-roulette.vercel.app', changeFrequency: 'weekly', priority: 1 },
    { url: 'https://ogo-roulette.vercel.app/lp', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://ogo-roulette.vercel.app/how-to-use', changeFrequency: 'monthly', priority: 0.7 },
  ]
}
```

### Step 2: OGP 動的画像の確認・改善

```bash
# X Card Validator でテスト
open "https://cards-dev.twitter.com/validator"
# LINE で URL シェアして確認
# Facebook Debugger でテスト
open "https://developers.facebook.com/tools/debug/"
```

`/app/opengraph-image.tsx` を確認し、アプリ名・キャッチコピー・ロゴが正しく表示されるよう修正。

### Step 3: ターゲットキーワード強化

`app/layout.tsx` の keywords を実測検索ボリュームに基づいて最適化:

```tsx
keywords: [
  'おごり ルーレット', 'おごり決め アプリ', '飲み会 誰が払う',
  '割り勘 ルーレット', 'じゃんけん アプリ 無料', '順番決め ルーレット',
  '幹事 ツール', 'QRコード ルーレット', '合コン ゲーム アプリ',
],
```

### Step 4: `how-to-use` ページの SEO 構造化

`/how-to-use` に FAQ Schema（JSON-LD）を追加することで Google のリッチリザルト対象にする。

---

## 完了条件

- [ ] Google Search Console 登録・確認完了
- [ ] sitemap.xml 作成・submit 完了
- [ ] OGP 画像が X・LINE で正しく表示される（スクショ確認）
- [ ] 「おごり ルーレット」で Google 検索に表示される
- [ ] Search Console でインプレッション数の計測開始

## 期待スコア上昇

AARRR-Acquisition: +1.5（3→4.5/5） / G-STACK-Strategy: +1
→ 総合: +2点
