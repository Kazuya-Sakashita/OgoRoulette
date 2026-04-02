# ISSUE-148: Google Fonts 466KB がパフォーマンスボトルネック

## 概要
Google Fonts の CSS が 466KB あり、初回ロード時の FCP/LCP を大幅に遅延させている。Lighthouse Performance: 62/100 の主因。

## 症状
- Lighthouse FCP: 5.8s (POOR) ← 目標 < 1.8s
- Lighthouse LCP: 7.3s (POOR) ← 目標 < 2.5s
- Google Fonts CSS: 466KB（全リソースの約半分）
- 実ブラウザ（throttlingなし）では FCP 764ms で問題なし → 低速回線で顕在化

## 根本原因
`app/layout.tsx` の Google Fonts インポートに `display=swap` と `preconnect` が不足している。

### 現状
```typescript
// app/layout.tsx
import { Inter, Noto_Sans_JP } from "next/font/google"
const inter = Inter({ subsets: ["latin"] })
const notoSansJP = Noto_Sans_JP({ subsets: ["latin"] })
```

Noto Sans JP はサブセット数が膨大で、全ウェイト (400;500;700;900) をロードすると CSS だけで 466KB になる。

## 修正方針

### 応急: `display: 'swap'` と必要ウェイトのみに絞る
```typescript
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "700", "900"],  // 500 を削除
  display: "swap",
  preload: false,  // Noto は巨大なので preload しない
})

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
})
```

### 理想: システムフォントへの部分フォールバック
日本語フォントはシステムフォント（-apple-system, Hiragino Sans）を第1候補にし、Noto を fallback に降格。

## 期待効果
- FCP: 5.8s → 2.0s 以下（推定）
- CSS 転送量: 466KB → 100KB 以下

## 実施した修正

`app/layout.tsx` の `<link>` タグ（Turbopack 回避のため CDN 直読み込みを維持）から Noto Sans JP の `500` ウェイトを削除。

```html
<!-- 修正前 -->
href="...Noto+Sans+JP:wght@400;500;700;900&display=swap"

<!-- 修正後 -->
href="...Noto+Sans+JP:wght@400;700;900&display=swap"
```

`display=swap` は既に設定済みのため追加不要。

## 結果

- Google Fonts CSS: **466KB → 90KB**（約80%削減）
- LCP: 7.3s → **6.5s**（改善）
- FCP は Lighthouse throttling 環境では 5.8s 維持（低速回線依存のため抜本解決には systemフォントへの移行が必要）

## ステータス
✅ 修正済み（応急対応） — commit `49fba17`
**優先度:** P1（応急対応完了。理想修正はシステムフォントへの移行）
