# overflow-x:hiddenが縦スクロールを壊す理由

## 「横スクロールを消したいだけなのに…」

横スクロールバーを消したくて `overflow-x: hidden` を書いたら、なぜか縦スクロールがおかしくなった。

そんな経験はありませんか？これ、バグではなくCSSの仕様どおりの動作です。

---

## CSSのオーバーフロー軸ルール

CSSには「`overflow-x` と `overflow-y` を同時に `visible` にはできない」というルールがあります。

```css
/* これを書くと… */
.container {
  overflow-x: hidden;
  overflow-y: visible; /* ← 暗黙的に auto に変換される！ */
}
```

つまり `overflow-x: hidden` を書いた瞬間、`overflow-y` が `visible`（デフォルト）から `auto` に強制変換されます。

---

## `auto` になると何が起きる？

`overflow: auto` は「コンテンツがはみ出したらスクロールバーを出す」という意味です。

これによってコンテナが「スクロールコンテナ」になります。

スクロールコンテナになると、内部要素のレイアウト計算が変わります。たとえば：

- `position: sticky` が想定外の位置で止まる
- `min-height: 100dvh` の計算基準がずれる
- `transform` や `z-index` の基準が変わる

OgoRouletteでは `<main className="overflow-x-hidden">` と書いていたため、`<main>` がスクロールコンテナになり、内部のルーレット画面のレイアウトが崩れていました。

---

## 解決策：`overflow-x: clip` を使う

```css
/* 修正前 */
.container {
  overflow-x: hidden; /* スクロールコンテナが生成される */
}

/* 修正後 */
.container {
  overflow-x: clip; /* スクロールコンテナを生成しない */
}
```

`overflow-x: clip` は `hidden` と同様に横方向のはみ出しを切り取りますが、**スクロールコンテナを生成しません**。

Tailwindでは `overflow-x-clip` と書けます。

---

## まとめ

| 値 | 横はみ出し | スクロールコンテナ生成 |
|----|-----------|--------------------|
| `hidden` | 切り取る | **される**（`overflow-y: auto`に変換） |
| `clip` | 切り取る | **されない** |

「横スクロールを消したい」だけなら `overflow-x: clip` が安全です。`hidden` は意図しない副作用を持ちます。

---

## ブラウザサポート

`overflow: clip` はChrome 90+、Safari 16+、Firefox 81+ でサポートされています（2024年時点では主要ブラウザすべてで使えます）。
