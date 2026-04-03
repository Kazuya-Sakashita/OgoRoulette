# 最適化フェーズ プロンプト集

## このカテゴリについて

機能が動くようになった後、「速く・正確に・誰でも使いやすく」するフェーズで使うプロンプト群。  
Lighthouse スコア改善・アクセシビリティ（WCAG 2.1）・パフォーマンスボトルネック解消・Google Fonts 最適化など、OgoRoulette で実際に取り組んだ最適化作業を元にしたプロンプト集。  
数値（Before / After）を必ず渡すことで、AIが優先度を正しく判断できる。

---

## プロンプト一覧

### Lighthouse スコア改善相談
**使うタイミング**: Lighthouse を実行してスコアが低い項目が見つかったとき。何から手をつけるべきか優先度を決めたいとき
**効果**: スコアへの寄与度が高い順に修正タスクをリストアップしてもらえる

```
以下の Lighthouse 結果を元に、スコア改善のための優先度付きタスクリストを作成してください。
コスパの良い修正（変更量が少なく・スコアへの影響が大きいもの）を優先してください。

---

## 現在の Lighthouse スコア
- Performance: 62/100
- Accessibility: 86/100
- Best Practices: 95/100
- SEO: 100/100

## 測定環境
- デバイス: Mobile（Lighthouse デフォルト設定）
- スロットリング: Simulated 4G
- URL: https://ogo-roulette.vercel.app/

## Lighthouse の指摘事項（Performance）
- FCP (First Contentful Paint): 5.8s (POOR, 目標 < 1.8s)
- LCP (Largest Contentful Paint): 7.3s (POOR, 目標 < 2.5s)
- TBT (Total Blocking Time): 240ms (NEEDS IMPROVEMENT)
- Render-Blocking Resources: Google Fonts CSS 466KB がブロッキング
- Unused JavaScript: 推定 92KB 削減余地
- Unused CSS: 推定 119KB 削減余地

## Lighthouse の指摘事項（Accessibility）
- [aria-*] 属性が不正: 1件
- Background and foreground colors do not have a sufficient contrast ratio: 2件
- [user-scalable="no"] または [maximum-scale] が設定されている: 1件
- Links do not have a discernible name: 1件

## 技術スタック
- Next.js 16 App Router
- Tailwind CSS v4（purge は v4 仕様で自動）
- Google Fonts: Noto Sans JP (400;500;700;900) + Inter
- Framer Motion（RouletteWheel コンポーネントで使用）

---

以下の形式で出力してください：

### 優先タスクリスト（コスパ順）
| 優先度 | タスク | 対象ファイル | 工数 | スコア改善予測 |
|--------|--------|------------|------|--------------|
| 1      |        |            | 小/中/大 |            |

### 各タスクの具体的な修正方法
[上位3タスクについて、変更前・変更後のコードを示す]

### やらなくていいこと（理由付き）
[Lighthouseが指摘していても対応不要または対応困難なもの]
```

**OgoRouletteでの使用例**: Lighthouse Performance 62点・Accessibility 86点の状態でこのプロンプトを使用。「Google Fontsのウェイト削減（466KB→90KB）」「viewport の maximum-scale 削除」「muted-foreground のコントラスト修正」「RouletteWheelの動的import」の4タスクを優先度付きで得た。すべて1〜2ファイルの変更で完了し、Accessibilityが92点まで改善した。

---

### アクセシビリティ問題の修正（WCAG 2.1）
**使うタイミング**: Lighthouse や axe がアクセシビリティ問題を報告したとき
**効果**: WCAG 2.1 基準・具体的な修正コード・対応すべき優先度をセットで得られる

```
以下のアクセシビリティ問題を修正してください。
WCAG 2.1 の基準を参照しながら、修正方針と具体的なコードを提示してください。

---

## 報告されている問題

### 問題1: ズーム制限（Critical）
```
Lighthouse: "[user-scalable="no"] が設定されているか、[maximum-scale] が 5 未満に制限されています"
WCAG 2.1 Success Criterion 1.4.4 (Resize text) 違反
```

現在のコード:
```typescript
// app/layout.tsx
export const viewport: Viewport = {
  themeColor: '#0B1B2B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,      // ← これが問題
  userScalable: false,  // ← これも問題
}
```

### 問題2: コントラスト不足（Serious）
```
Lighthouse: "Background and foreground colors do not have a sufficient contrast ratio"
対象: text-muted-foreground クラスを使ったテキスト
背景色: #0B1B2B（ダークテーマ）
現在の前景色: rgba(249, 250, 251, 0.5) → コントラスト比 3.5:1（基準: 4.5:1）
```

現在のコード:
```css
/* app/globals.css */
:root {
  --muted-foreground: rgba(249, 250, 251, 0.5);
}
```

### 問題3: リンクのアクセシブルな名前なし（Moderate）
```
Lighthouse: "Links do not have a discernible name"
対象: アイコンのみのリンクボタン（シェアボタン等）
```

---

以下を出力してください：

### 各問題の WCAG 基準と影響
[どのユーザーにどんな影響があるか]

### 修正コード（変更前・変更後）
```typescript
// 問題1の修正
// Before
export const viewport: Viewport = { maximumScale: 1, userScalable: false }

// After
export const viewport: Viewport = { /* maximumScale と userScalable を削除 */ }
```

### コントラスト比の計算
[修正後の色でコントラスト比が基準を満たすかを確認]

### 修正しなくていい項目と理由
[WCAG の例外ケースや UX とのトレードオフで許容される場合]
```

**OgoRouletteでの使用例**: ISSUE-147（viewport zoom 制限）と ISSUE-149（muted コントラスト不足）の修正で使用。`maximumScale: 1` と `userScalable: false` の削除により Accessibility スコアが +6pt 改善。`--muted-foreground` の opacity を 0.5 から 0.65 に変更してコントラスト比を 3.5:1 から 4.6:1 に改善した。

---

### パフォーマンスボトルネック調査
**使うタイミング**: 特定のページが重い・初回表示が遅い・ユーザーからの「重い」という報告があるとき
**効果**: バンドルサイズ・ウォーターフォール・レンダリングブロッキングの順に原因を絞り込める

```
以下のページのパフォーマンスボトルネックを調査してください。
Lighthouse の数値と技術スタックをもとに、原因と改善策を提示してください。

---

## 対象ページ
`/` (トップページ / ホーム画面)

## 現在のパフォーマンス数値
- Lighthouse Performance (Mobile, Simulated 4G): 62/100
- FCP: 5.8s
- LCP: 7.3s
- TBT: 240ms
- Lighthouse の主な指摘:
  - "Eliminate render-blocking resources" — Google Fonts CSS (466KB)
  - "Reduce unused JavaScript" — 推定 92KB
  - "Reduce unused CSS" — 推定 119KB

## ページのコンポーネント構成
```tsx
// app/page.tsx（簡略版）
import { Noto_Sans_JP, Inter } from 'next/font/google'  // ← フォント
import { RouletteWheel } from '@/components/roulette-wheel'  // ← Framer Motion 使用
import { WinnerCard } from '@/components/winner-card'
import { BillCalculator } from '@/components/bill-calculator'
```

## フォント読み込み方法（現在）
```html
<!-- app/layout.tsx — Turbopack 回避のため link タグで直接読み込み -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet" />
```

## 技術スタック
- Next.js 16 App Router
- Tailwind CSS v4
- Framer Motion v11（RouletteWheel コンポーネント内）

---

以下を出力してください：

### ボトルネックの優先度（影響大きい順）
1. [原因・影響・対策]
2. [原因・影響・対策]
3. [原因・影響・対策]

### 即効性の高い修正（各1ファイル以内の変更）
```typescript
// 修正前 → 修正後のコード差分
```

### 期待できる改善値（推定）
| 施策 | FCP 改善予測 | LCP 改善予測 | 工数 |
|------|-----------|------------|------|

### 長期的な改善案
[システムフォントへの切り替え・ISR の導入など、工数がかかるが効果が大きい施策]
```

**OgoRouletteでの使用例**: ISSUE-148（Google Fonts 466KB がパフォーマンスボトルネック）の調査で使用。Noto Sans JP の `500` ウェイトを削除することで CSS が 466KB から 90KB（約80%削減）に改善。また RouletteWheel を `dynamic()` + `ssr: false` で遅延ロードし、初回 JS 転送量を削減した（ISSUE-150）。

---

### Google Fonts 最適化
**使うタイミング**: Lighthouse が "Render-blocking resources" としてGoogle Fontsを指摘したとき。フォントが原因でFCP/LCPが悪化しているとき
**効果**: ウェイト削減・display=swap・preconnect・next/font 移行など、段階的な最適化オプションを得られる

```
Google Fonts によるパフォーマンス問題を改善してください。
段階的な対策（応急対応 → 理想対応）を提示してください。

---

## 現在の問題
- Lighthouse: "Eliminate render-blocking resources"
- Google Fonts CSS サイズ: 466KB（全リソースの約半分）
- FCP への影響: +3〜4秒（Simulated 4G）

## 現在のフォント設定
```html
<!-- app/layout.tsx -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link
  href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap"
  rel="stylesheet"
/>
```

## 使用している CSS クラス（Tailwind）
- `font-sans` — 全体のベースフォント（Noto Sans JP）
- `font-bold` — 太字（700）
- `font-black` — 極太（900）
- `font-medium` — 中太（500）← 使用箇所が限定的

## 技術スタック
- Next.js 16 App Router
- Tailwind CSS v4
- Turbopack（開発環境）← next/font との相性問題あり

---

以下を出力してください：

### 応急対応（1日以内で完了）
[フォントのウェイト削減・display=swap の追加など、現状維持で最大化できる改善]

```html
<!-- 修正後の link タグ -->
```

### 中期対応（next/font への移行）
```typescript
// app/layout.tsx — next/font/google を使った実装
import { Noto_Sans_JP } from 'next/font/google'

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  display: 'swap',
  preload: false,  // Noto は巨大なので preload しない
  variable: '--font-noto',
})
```

### 理想対応（システムフォントへの移行）
```css
/* Noto Sans JP をフォールバックに降格し、システムフォントを優先する */
font-family: -apple-system, 'Hiragino Sans', 'Yu Gothic', sans-serif, 'Noto Sans JP';
```

### 各対策の効果比較
| 対策 | CSS削減 | FCP改善 | 工数 | リスク |
|------|---------|---------|------|--------|

### Turbopack との相性問題
[next/font が Turbopack 環境で動かない場合の回避策]
```

**OgoRouletteでの使用例**: ISSUE-148の修正で使用。Turbopack との相性から next/font ではなく link タグ直読みを維持しつつ、Noto Sans JP のウェイトを `400;500;700;900` から `400;700;900` に削減。Google Fonts CSS が 466KB から 90KB に約80%削減された。残課題としてシステムフォントへの移行が別ISSUEで追跡中。

---
