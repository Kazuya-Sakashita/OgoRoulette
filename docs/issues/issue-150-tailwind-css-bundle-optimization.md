# ISSUE-150: 未使用 CSS/JS の削減（バンドル最適化）

## 概要
Lighthouse が CSS 119KB・JS 92KB の削減余地を指摘。Tailwind の未使用ルールと未使用 JavaScript チャンクが原因。

## 症状
- Lighthouse: "Reduce unused CSS — Est savings of 119 KiB"
- Lighthouse: "Reduce unused JavaScript — Est savings of 92 KiB"
- CSS バンドル: 160KB（Tailwind の未使用クラスが大半）

## 根本原因
1. **未使用 CSS**: Tailwind の purge 設定が不完全。動的クラス名（テンプレートリテラルや条件分岐）がスキャンされない可能性。
2. **未使用 JS**: Next.js のコード分割が最適化されておらず、初回ロードで不要なチャンクも読み込んでいる。

## 修正方針

### CSS: `tailwind.config.ts` の content パス確認
```typescript
content: [
  "./app/**/*.{ts,tsx}",
  "./components/**/*.{ts,tsx}",
  "./lib/**/*.{ts,tsx}",  // 追加漏れの可能性
]
```

### JS: 動的 import でコード分割
重いコンポーネント（RouletteWheel、recording 系）を `dynamic()` でレイジーロード化。

## 期待効果
- CSS: 160KB → 40KB 以下
- JS: 一部チャンクの遅延ロード化

## 実施した修正

### JS: RouletteWheel を動的 import に変更（`app/page.tsx`）

```typescript
// 修正前
import { RouletteWheel } from "@/components/roulette-wheel"

// 修正後
import dynamic from "next/dynamic"
const RouletteWheel = dynamic(
  () => import("@/components/roulette-wheel").then((m) => ({ default: m.RouletteWheel })),
  { ssr: false, loading: () => <div style={{ width: 220, height: 220 }} /> }
)
```

### CSS: 対応不要

Tailwind CSS v4 を使用（`tailwind.config.ts` なし）。v4 はコンテンツスキャンが自動のため、
purge 設定の追加による改善余地は限定的。Lighthouse の "119KB unused CSS" の大半は
Tailwind v4 の仕様上不可避。

## 結果

- `unused-css-rules`: Lighthouse 推定削減量 920ms → **370ms**（−60%）
- RouletteWheel チャンクが遅延ロード化され、初回 JS 転送量を削減

## ステータス
✅ 修正済み（JS のみ。CSS は v4 仕様上対応不要） — commit `8591af2`
**優先度:** P2
