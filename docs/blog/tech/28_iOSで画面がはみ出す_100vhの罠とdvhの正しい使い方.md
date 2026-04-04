# iOSで画面がはみ出す？100vhの罠とdvhの正しい使い方

## これは何の話？

スマホでWebアプリを作っていると、こんな経験はないでしょうか。

「PCのChromeでは完璧に表示されるのに、iPhoneで開いたら要素が画面の外にはみ出てる」

OgoRouletteでも同じ問題が起きました。iPhone 17 Proでルーレットホイールが半分しか見えない、という不具合です。原因を調べると、`100vh`というCSSの値の「仕様」が関係していました。

---

## `100vh` って何？

`vh` は "viewport height" の略。`100vh` は「画面の高さの100%」という意味です。

```css
.container {
  min-height: 100vh; /* 画面の高さいっぱいに広げる */
}
```

これ、一見シンプルです。でも iOSでは落とし穴があります。

---

## iOSの「二つの高さ」問題

iPhoneのSafariには、アドレスバーがあります。

ページをスクロールすると、アドレスバーが隠れて画面が広くなりますよね。つまり「表示できる高さ」がスクロールによって変わります。

ここで問題が起きます。**`100vh` は「アドレスバーが隠れた状態の高さ」を返す** のです。

| 状態 | 実際の表示高さ |
|------|--------------|
| アドレスバーあり | 764px（例） |
| アドレスバーなし | 852px（例） |

差は最大88px。`100vh` が返す値は852px（アドレスバーなしの状態）。

でもページを開いた直後はアドレスバーが表示されているので、実際の表示域は764px。

結果：コンテナは852pxの高さを要求するが、見えているのは764px → **88pxがはみ出す** という事態になります。

---

## どう直すか？ → `dvh` を使う

```css
/* 修正前 */
.container {
  min-height: 100vh;
}

/* 修正後 */
.container {
  min-height: 100dvh;
}
```

`dvh` は "dynamic viewport height" の略。アドレスバーの表示・非表示に合わせて動的に変化します。

| 単位 | 意味 | iOSの挙動 |
|------|------|----------|
| `vh` | viewport height | アドレスバーなしの高さ（固定） |
| `dvh` | dynamic viewport height | 実際の表示域に追従（推奨） |
| `svh` | small viewport height | アドレスバーありの高さ（保守的） |
| `lvh` | large viewport height | アドレスバーなしの高さ（`vh`と同じ） |

Tailwindでは `min-h-dvh` と書けます（Tailwind v3.4以降）。

---

## さらに：コンテナのサイズを動的に取得する

`dvh` で大半は解決しますが、「ルーレットホイールの直径」のように具体的なピクセルが必要な場合は `window.innerHeight` を使います。

```tsx
const [wheelSize, setWheelSize] = useState(280)

useEffect(() => {
  const RESERVED_HEIGHT = 440 // ヘッダー・ボタン等の合計高さ

  const update = () => {
    const vh = window.innerHeight  // 実際の表示域（iOSでも正確）
    const vw = window.innerWidth
    const byWidth = Math.min(280, vw - 40)
    const byHeight = Math.min(280, vh - RESERVED_HEIGHT)
    setWheelSize(Math.max(200, Math.min(byWidth, byHeight)))
  }

  update()
  window.addEventListener("resize", update)
  return () => window.removeEventListener("resize", update)
}, [])
```

**ポイント：** `window.innerHeight` はiOS Safariでも現在の実際の表示域を返します。`100vh` より信頼性が高いです。

---

## まとめ

| 問題 | 原因 | 解決策 |
|------|------|--------|
| iOS Safariでレイアウトがはみ出す | `100vh` がアドレスバーを考慮しない | `100dvh` または `window.innerHeight` を使う |

- コンテナの最小高さ → `min-h-dvh`
- 実際のピクセルが必要な場面 → `window.innerHeight`

`100vh` はデスクトップでは正確に動きますが、iOSでは「ちょっと大きすぎる値」を返します。モバイル対応では `dvh` を使う習慣をつけましょう。
