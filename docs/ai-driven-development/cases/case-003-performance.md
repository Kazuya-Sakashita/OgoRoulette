# ケーススタディ 003: パフォーマンス最適化
## ― Lighthouse 62→95: 数値で語るAI駆動改善サイクル ―

---

## 概要

| 項目 | 内容 |
|------|------|
| 対象ISSUE | ISSUE-148, 149, 150, 147 |
| 発生フェーズ | バズ設計準備期（LPリリース前） |
| 問題の種類 | LP公開前に Lighthouse 62/100 を計測 → リリース断念 |
| 難易度 | ★★★☆☆（原因特定は難しくない。対策の優先順位付けが肝） |
| 解決期間 | 約4日間 |
| 改善幅 | Lighthouse Performance: 62 → 95（+33点） |
| AIの貢献 | ボトルネック分析・修正優先順位の提案・実装コード生成 |

---

## 背景

### パフォーマンス計測を始めたきっかけ

ランディングページ（LP）を公開する前に、SEOとCore Web Vitalsの観点でスコアを確認しようとgstackでLighthouseを実行した。

**計測結果（改善前）:**
```
Performance:    62/100  ← POOR（目標: 90+）
Accessibility:  89/100
Best Practices: 92/100
SEO:            95/100
```

Performance 62 というスコアは「スマホで3G回線のユーザーには実用に耐えない」レベル。LPのファーストビューが遅いと、ユーザーが離脱してアプリまで辿り着かない。これはLPリリースの判断を保留するに十分な理由だった。

### なぜパフォーマンスが悪かったか（仮説）

LighthouseレポートのOpportunities（改善機会）に並んだ項目:

```
1. Eliminate render-blocking resources          Est. savings: 2.1s
2. Reduce unused CSS                            Est. savings: 119 KiB
3. Reduce unused JavaScript                     Est. savings: 92 KiB
4. Serve images in next-gen formats             Est. savings: 45 KiB
5. Properly size images                         Est. savings: 28 KiB
```

数字を見た瞬間に最大のボトルネックが分かった: **Render-blocking resources = Google Fonts**。

---

## 問題の詳細

### ISSUE-148: Google Fonts 466KB がパフォーマンス主因

**症状:**
- Lighthouse FCP: 5.8s (POOR → 目標: 1.8s以下)
- Lighthouse LCP: 7.3s (POOR → 目標: 2.5s以下)
- Google Fonts CSS: 466KB（全リソースの約半分を占有）

**根本原因（Lighthouseの Diagnostics で特定）:**

`app/layout.tsx` で読み込んでいる Noto Sans JP が全ウェイト（400, 500, 700, 900）を含む CSS 466KB を生成していた。

```html
<!-- 問題のある読み込み（修正前） -->
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">
```

Noto Sans JP は日本語フォントのため、1ウェイトあたりの CSS サイズが欧文フォントの数十倍になる。4ウェイト = 466KB は避けようがない結果だった。

**計測で分かった実態:**

| 環境 | FCP | LCP |
|------|-----|-----|
| 実ブラウザ（高速回線） | 764ms | 1.2s |
| Lighthouse（3G throttling） | 5.8s | 7.3s |
| Lighthouse目標値 | < 1.8s | < 2.5s |

実ブラウザでは速いが、3G回線（東南アジア・地方ユーザー）では致命的に遅い。

### ISSUE-150: 未使用CSS/JSの削減

**症状:**
- CSS バンドル: 160KB（Tailwind の未使用クラスが大半）
- JS: 「Reduce unused JavaScript — Est. savings of 92 KiB」

**根本原因:**
- Tailwind の purge が一部のダイナミッククラスを補足できていない
- RouletteWheel コンポーネントが初回ロード時に同期的にバンドルされている

### ISSUE-149: カラーコントラスト（アクセシビリティ）

**症状:**
- Accessibility: 89/100
- 具体的な指摘: `text-slate-400` on `bg-slate-900` のコントラスト比が 3.2:1（WCAG AA基準: 4.5:1 以上）

これはパフォーマンスではなくアクセシビリティだが、Lighthouseスコアに影響するため同時対処した。

### ISSUE-147: `maximum-scale=1` Viewport制限の削除

**症状:**
- Best Practices の減点原因
- `maximum-scale=1` でピンチズームを無効化すると、視覚障害ユーザーのアクセスが制限される

---

## 解決プロセス

### Step 1: 問題の優先順位付け（AIとの対話）

**プロンプト:**
```
Lighthouse Performance 62点のWebアプリを改善したいです。
以下のOpportunitiesが出ています。

1. Eliminate render-blocking resources: 2.1s savings
2. Reduce unused CSS: 119 KiB
3. Reduce unused JavaScript: 92 KiB
4. Serve images in next-gen formats: 45 KiB
5. Properly size images: 28 KiB

優先順位を「スコア改善への影響の大きさ」と「実装コスト」の観点でランク付けしてください。
Next.js 14 (App Router) / Tailwind CSS / Firebase の構成です。
```

**AIの回答（優先順位の提案）:**

```
優先度: 高（スコア改善大 × 実装コスト小）
1. render-blocking resources → Google Fonts の最適化
   → CSS ウェイト削減で即座に FCP が改善

優先度: 中（スコア改善中 × 実装コスト小）
2. Reduce unused JavaScript → RouletteWheel の dynamic import 化
   → ページ初回ロードのJS解析時間を削減

優先度: 低（スコア改善小 × 実装コスト中）
3. Reduce unused CSS → Tailwind purge 最適化
   → 効果は限定的。Tailwind の purge は Next.js では通常正しく動作する
4. 画像フォーマット → WebP/AVIF への変換
   → 現在 OG 画像が主な対象。Vercel の Image Optimization で自動対応可能

実施しない（コスト > 効果）:
5. Properly size images → 現状のユーザー数・用途では優先度低
```

この分析を受けて、以下の順で実施を決定:
1. Google Fonts の最適化（ISSUE-148）
2. RouletteWheel の dynamic import（ISSUE-150）
3. カラーコントラスト修正（ISSUE-149）
4. maximum-scale=1 削除（ISSUE-147）

### Step 2: Google Fonts 最適化の実装

**AIへの実装プロンプト:**
```
以下の Google Fonts 読み込みを最適化してください。

現状:
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">

目標:
- CSS サイズを最小化
- FCP/LCP への影響を最小化
- 実用上の見た目の劣化なし

制約:
- Next.js 14 App Router
- next/font/google は Turbopack 環境で問題が出るため現状 CDN 直読み込みを維持
- font-weight 500 は UI 上でほぼ使っていない（確認済み）

提案してほしいこと:
1. 最適化後のリンクタグ
2. preconnect の追加
3. その他 <head> 内の最適化
```

**AIの修正提案:**

```html
<!-- 修正後 -->
<!-- preconnect を先に追加 -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- weight 500 を削除（400,700,900 のみ） -->
<link
  href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap"
  rel="stylesheet"
>
```

**実装後の計測結果:**

| 指標 | Before | After | 改善率 |
|------|--------|-------|--------|
| Google Fonts CSS | 466KB | 90KB | -80% |
| FCP（Lighthouse throttling） | 5.8s | 3.4s | -41% |
| LCP（Lighthouse throttling） | 7.3s | 6.5s | -11% |

FCP は大きく改善したが、LCPはまだ目標未達。次の手を打つ。

### Step 3: RouletteWheel の動的インポート

ホームページに埋め込まれているデモ用 RouletteWheel が、初回ロード時に同期的にバンドルされていた。

**AIの実装提案:**

```typescript
// 修正前
import { RouletteWheel } from "@/components/roulette-wheel"

// 修正後
import dynamic from "next/dynamic"

const RouletteWheel = dynamic(
  () => import("@/components/roulette-wheel").then((m) => ({ default: m.RouletteWheel })),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ width: 220, height: 220 }}
        className="rounded-full bg-slate-800 animate-pulse"
      />
    ),
  }
)
```

**AIが追記した注意点:**
> `ssr: false` を設定すると SSR 時にコンポーネントが描画されない。SEO が重要な場合は注意が必要。ただし RouletteWheel はインタラクティブな Canvas 要素であり、SEO で意味のある内容ではないため `ssr: false` が適切。

**実装後の計測結果:**

| 指標 | Before | After |
|------|--------|-------|
| JS Parse（ホームページ） | 1.8s | 1.1s |
| Lighthouse Performance | 73/100 | 89/100 |

### Step 4: カラーコントラスト修正（ISSUE-149）

**問題のあったクラスとその対策:**

| 要素 | 修正前 | 修正後 | コントラスト比 |
|------|--------|--------|------------|
| 本文テキスト | `text-slate-400` | `text-slate-300` | 3.2:1 → 5.1:1 |
| キャプション | `text-gray-500` | `text-gray-400` | 2.8:1 → 4.6:1 |
| プレースホルダー | `placeholder-slate-500` | `placeholder-slate-400` | 2.5:1 → 4.6:1 |

**AIへの確認プロンプト:**
```
以下のカラーコンビネーションのコントラスト比を計算し、
WCAG AA（4.5:1）をクリアする代替案を提案してください。

背景色: #0F1E30（--c-surface）
テキスト色: #94A3B8（text-slate-400、Tailwind）

修正候補: text-slate-300, text-slate-200, text-gray-300

OgoRoulette のデザインシステム（暗い海軍色ベース）との整合性も考慮してください。
```

### Step 5: maximum-scale=1 削除（ISSUE-147）

```html
<!-- 修正前 -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">

<!-- 修正後 -->
<meta name="viewport" content="width=device-width, initial-scale=1">
```

`maximum-scale=1` を削除してもUIが崩れないかを確認する必要があった。AIに確認:

```
maximum-scale=1 を削除すると、
以下のUIに問題が出る可能性を評価してください:

1. input フォームへのフォーカス時に iOS Safari が自動ズームする
2. ルーレットホイールのタッチ操作が意図しないズームと競合する

それぞれの対処法を提案してください。
```

**AIの分析:**

> 1. iOS Safari の自動ズーム問題: `font-size: 16px` 以上の input であれば自動ズームは発生しない。現在の input 要素の font-size を確認して、`text-base`（= 16px）以上であることを確認する必要がある。
>
> 2. ルーレットのタッチ操作: `touch-action: none` を canvas に設定することでピンチズームを canvas 内に限定できる。ただし現在のホイールはタッチインタラクションを受けていないので問題なし。

確認の結果、input は全て `text-base` 以上 → `maximum-scale=1` 削除を実施。

---

## 最終計測結果

### Lighthouse スコア推移

| 実施内容 | Performance | Accessibility | Best Practices |
|---------|------------|-------------|--------------|
| 初期状態 | 62 | 89 | 92 |
| ISSUE-148（Fonts最適化） | 73 | 89 | 92 |
| ISSUE-150（dynamic import） | 89 | 89 | 92 |
| ISSUE-149（コントラスト修正） | 89 | 97 | 92 |
| ISSUE-147（viewport修正） | 89 | 97 | 100 |
| 最終結果 | **95** | **97** | **100** |

### Core Web Vitals の変化

| 指標 | Before | After | 目標 |
|------|--------|-------|-----|
| FCP | 5.8s | 1.4s | < 1.8s |
| LCP | 7.3s | 2.1s | < 2.5s |
| TBT（Total Blocking Time） | 420ms | 180ms | < 200ms |
| CLS（Cumulative Layout Shift） | 0.05 | 0.03 | < 0.1 |

FCP は 5.8s → 1.4s に。LCP は 7.3s → 2.1s に。どちらも目標クリア。

---

## AI活用方法（詳細）

### 有効だったプロンプトパターン

**パターン1: 優先順位付け**
```
[Lighthouse Opportunitiesのリスト] を優先順位付けしてください。
観点: スコア改善への寄与度 × 実装コスト
制約: [技術スタック]
```

**パターン2: 実装ガイダンス**
```
[具体的な問題]を修正するコードを提案してください。
制約: [変えてはいけない部分]
確認してほしい副作用: [懸念点のリスト]
```

**パターン3: 影響範囲の評価**
```
[変更内容]を実施した場合の影響を評価してください。
1. SEO への影響
2. ユーザー体験への影響
3. 他の機能との競合
4. 対処法（影響が出た場合）
```

### AIが特に効果的だった場面

**1. Lighthouse 数値の読み方の解説**

Lighthouse レポートは数値が多く、どれが重要か判断が難しい。AIに「このレポートで最も改善効果が大きい3項目を選んで」と聞くと、的確に優先順位を出してくれた。

**2. フォントの最適化オプションの比較**

Google Fonts の最適化方法は複数あり（next/font/google、CDN直読み、variable fonts など）、それぞれのトレードオフをAIが整理してくれた。

**3. アクセシビリティとパフォーマンスの両立**

`maximum-scale=1` の削除は、アクセシビリティ改善だがUX問題のリスクがある。AIがリスクの具体的な条件（input の font-size）を特定してくれたことで、安心して実施できた。

### AIが答えられなかったこと

**1. 実際の計測数値の予測**

「この修正をしたら何点上がるか」はAIが予測できない。必ず実際に計測する必要がある。

**2. 自分のサイト固有のボトルネック**

「なぜ TBT が 420ms あるか」の真因は、実際にLighthouseレポートの Flame Chart を確認しないと分からない。AIは一般的な原因を列挙するが、固有の問題は計測データがないと特定できない。

**3. 改善後の副作用の完全な予測**

`maximum-scale=1` 削除後に iOS で特定の input がズームするかは、実機確認が必要。AIは「可能性」を教えてくれるが、「実際に起きるか」は環境依存。

---

## 学び

### パフォーマンス最適化の一般的な教訓

**教訓1: 計測なき最適化は無意味**

「なんとなく重い」という感覚で最適化しても、スコアは上がらない。Lighthouseで計測 → ボトルネックを特定 → ISSUEに落とす、というサイクルが必須。

**教訓2: 80/20の法則が強く効く**

ISSUE-148（Google Fonts）一つで Performance が 62→73 になった。複数の細かい最適化より、大きなボトルネック一つに集中する方が効率的。

**教訓3: 計測環境に注意する**

実ブラウザでは 764ms の FCP が、Lighthouse throttling では 5.8s になる。低速回線ユーザーへの配慮を忘れると、グローバル展開時に問題になる。

**教訓4: パフォーマンスとアクセシビリティは表裏一体**

`maximum-scale=1` の削除はアクセシビリティ改善だが、パフォーマンスにも間接的に影響する（Best Practices スコア向上 → Lighthouse 総合評価向上）。分野を横断して改善することで、相乗効果が生まれる。

---

## 再利用パターン

### パフォーマンス改善のチェックリスト

```markdown
## Next.js アプリのパフォーマンス最適化チェックリスト

### フォント
- [ ] Google Fonts: 必要なウェイトのみに絞る（不要な weight を削除）
- [ ] display=swap を設定する（render-blocking を避ける）
- [ ] preconnect を追加する

### JavaScript
- [ ] 重いコンポーネントを dynamic import 化する
- [ ] third-party ライブラリは lazy load で読み込む
- [ ] Server Componentsで渡せるものは渡す（クライアントJSを減らす）

### CSS
- [ ] Tailwind の content パスに全ファイルが含まれているか確認
- [ ] 未使用の動的クラスを safelist に追加（または動的生成を避ける）

### 画像
- [ ] next/image を使う（自動WebP変換・サイズ最適化）
- [ ] 重要な画像には priority prop を設定（LCP改善）

### アクセシビリティ（スコアに影響）
- [ ] カラーコントラスト比を確認（WCAG AA: 4.5:1以上）
- [ ] maximum-scale=1 を削除する
- [ ] alt 属性を全画像に設定する
```

### AIを使ったパフォーマンス診断のプロンプトテンプレート

```
# パフォーマンス診断依頼

## 現状
Lighthouse Performance: [スコア]/100

## Opportunities（Lighthouse出力をコピー）
[Lighthouseのテキスト出力をそのまま貼る]

## 技術スタック
- Framework: [Next.js / Nuxt / etc]
- CSS: [Tailwind / styled-components / etc]
- Hosting: [Vercel / Cloudflare / etc]

## 依頼事項
1. 最も効果の大きい改善項目TOP3を選んでください
2. 各項目の実装難易度（S/M/L）を評価してください
3. 実施順序の推奨を教えてください
4. それぞれの修正コードのサンプルを提示してください

## 制約
- [変更できないもの（デザイン・外部依存・予算など）]
```

---

## 関連ドキュメント

- [ISSUE-147](../../issues/issue-147-remove-maximum-scale-viewport.md) — viewport 最適化
- [ISSUE-148](../../issues/issue-148-google-fonts-performance.md) — Google Fonts 最適化
- [ISSUE-149](../../issues/issue-149-color-contrast-a11y.md) — カラーコントラスト修正
- [ISSUE-150](../../issues/issue-150-tailwind-css-bundle-optimization.md) — バンドル最適化
- [ケーススタディ 001](./case-001-race-condition.md) — Race Condition との戦い
- [ケーススタディ 004](./case-004-lp-creation.md) — LP作成とコンテンツ共創

---

*最終更新: 2026-04-02*
*ステータス: 全ISSUE 解決済み。Lighthouse Performance 95/100 達成*
