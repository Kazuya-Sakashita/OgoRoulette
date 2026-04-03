# Lighthouse 定量評価 → ISSUE自動生成

**レベル:** 中級  
**再利用性:** 高  
**効果:** ★★★★★  
**タグ:** `テンプレ化` `おすすめ`

---

## 目的

本番URLに対してLighthouseを実行し、スコアと問題を取得。  
評価結果をAIに渡してISSUEとして分解させる。

## 使用タイミング

- リリース前の品質チェック
- 定期的な品質モニタリング
- 修正後のスコア確認

---

## プロンプト（Step 1: 評価実行）

```
以下のコマンドでLighthouseを実行して、スコアと主要指標を取得してください。

URL: {your-app-url}

npx lighthouse {your-app-url} \
  --output=json \
  --output-path=/tmp/lh-report.json \
  --only-categories=performance,accessibility,best-practices,seo \
  --quiet

実行後、以下を出力してください：
1. カテゴリスコア（4軸）
2. Core Web Vitals（FCP, LCP, TBT, CLS）
3. Accessibilityの失敗項目一覧
4. Performanceの改善機会（overallSavingsMs > 100msのもの）
```

## プロンプト（Step 2: ISSUE分解）

```
上記のLighthouse結果をもとに、修正すべき問題をISSUEとして整理してください。

フォーマット:
- ISSUE番号（連番）
- タイトル（1行）
- 根本原因（1〜2文）
- 修正方針（具体的なファイル・行数まで）
- 優先度（P1: 即日 / P2: 今週中 / P3: いつか）
- 期待効果（スコアへの影響）

優先度基準:
- P1: A11y Critical（WCAG違反）、FCP/LCP に直接影響するもの
- P2: スコア改善が5点以上見込めるもの
- P3: 軽微な改善
```

---

## 工夫ポイント

- Step 1でデータを取り、Step 2で解釈させる。1プロンプトにまとめると精度が落ちる
- 「P1 = WCAG違反」と優先度の定義を明示することで、AIが独自解釈しない
- `overallSavingsMs > 100ms` という数値フィルタを入れることでノイズを除去

## 改善余地

- モバイル・デスクトップ両方を一度に評価するには `--preset=desktop` を追加して2回実行
- `--throttling-method=simulate` と `--throttling-method=provided` の違いを理解して使い分けると精度向上

## 実行結果

```
Performance: 62 → 60（修正後）
Accessibility: 86 → 92（+6点）
Google Fonts: 466KB → 90KB（-81%）

生成されたISSUE: 4件（ISSUE-147〜150）
うちP1: 2件（即日修正）
所要時間: 評価10分 + 修正60分
```
