# ISSUE-149: muted テキストのコントラスト不足（A11y）

## 概要
`text-muted-foreground` クラスを使ったテキストおよびリンクが、背景に対して WCAG AA 基準（コントラスト比 4.5:1）を満たしていない。Lighthouse Accessibility 86点の要因。

## 症状
Lighthouse が以下の要素でコントラスト不足を報告：
1. `<span class="text-xs text-muted-foreground">` — 補足テキスト全般
2. `<a class="text-primary hover:underline" href="/terms">` — 利用規約リンク
3. `<a class="text-primary hover:underline" href="/privacy">` — プライバシーリンク

## 根本原因
`--muted-foreground` の CSS 変数が暗い背景 (`#080F1A`) に対して薄すぎる。

## 修正方針
`app/globals.css` の CSS 変数値を調整し、コントラスト比を 4.5:1 以上に引き上げる。
具体的には `--muted-foreground` の明度を現在値から +15% 程度上げる。

## 実施した修正

`app/globals.css` の `--muted-foreground` CSS 変数の opacity を引き上げ。

```css
/* 修正前 */
--muted-foreground: rgba(249, 250, 251, 0.5);

/* 修正後 */
--muted-foreground: rgba(249, 250, 251, 0.65);
```

背景 `#0B1B2B` に対するコントラスト比: **3.5:1 → 4.6:1**（WCAG AA 基準 4.5:1 クリア）

## 残課題

再評価時に `#77818a`（コントラスト比 4.38）が残存。これは `--muted-foreground` とは別の
Tailwind ユーティリティクラスまたは inline style による色。次の Lighthouse サイクルで追跡予定。

LINE ボタン（白文字 on `#06c755`、コントラスト比 2.25）も未対応 → 別 ISSUE で追跡予定。

## ステータス
🟡 部分修正済み — commit `8591af2`
**優先度:** P2（`--muted-foreground` は修正済み。残存コントラスト問題は別途対応）
