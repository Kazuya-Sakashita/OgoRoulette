# setStatus で消えた video 要素：React の DOM 管理と useRef の落とし穴

## 概要

iPhoneでQRスキャンを実装したところ、「カメラを起動中...」と表示されたまま
カメラ映像が出ないという問題が起きた。

原因は React のレンダリングと useRef の関係を理解していなかったことだった。

---

## 発生した問題

### 現象

- QRスキャンタブをタップすると「カメラを起動中...」とスピナーが表示される
- しかしカメラ映像が出ない
- 何秒待っても「起動中」のまま動かない
- エラーも出ない

ヘッドレスブラウザ（CI用）では「カメラを起動できませんでした」と正しく出る。
しかし iPhone 実機では永遠に起動中のまま固着した。

---

## 原因

### コードの構造

QrScanner コンポーネントは次の構造になっていた。

```tsx
export function QrScanner({ onScan, active }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState("idle")

  const startCamera = async () => {
    setStatus("loading")  // ← ここが問題

    const stream = await navigator.mediaDevices.getUserMedia(...)
    const video = videoRef.current  // ← null になっている
    if (!video) {
      stopCamera()
      return  // ← エラーにならずサイレントリターン
    }
    video.srcObject = stream
    await video.play()
    setStatus("scanning")
  }

  if (status === "loading") return <スピナーUI />  // ← video 要素なし
  if (status === "error")   return <エラーUI />    // ← video 要素なし

  return (
    <div>
      <video ref={videoRef} playsInline muted autoPlay />  // ← scanning/idle のみ
    </div>
  )
}
```

### 何が起きていたか

```
① setStatus("loading") を呼ぶ
② React がリレンダリングする
③ status === "loading" の分岐でスピナーUIを返す
④ <video> 要素が DOM から消える → videoRef.current = null になる

⑤ getUserMedia() が成功してストリームを取得する

⑥ const video = videoRef.current → null !!!
⑦ if (!video) { stopCamera(); return }
   → エラーにもならず無言でリターン
   → status は "loading" のまま

⑧ スピナーが永遠に回り続ける
```

ヘッドレスブラウザではカメラが存在しないため getUserMedia 自体が失敗してエラー UI に落ちた。
だから CI では問題に見えなかった。iPhone では getUserMedia が成功するため、
⑥ の null 参照まで進んでしまった。

### useRef の性質

`useRef` は DOM 要素へのポインタを保持する。
DOM に要素がある間は有効だが、要素が DOM から消えると `null` に戻る。

これは `useState` と異なる挙動だ。`state` の値はコンポーネントがアンマウントされるまで残るが、
`ref.current` は参照している DOM 要素がなくなれば即 `null` になる。

React の条件付きレンダリング（`if (status === "loading") return ...`）は
返された JSX 以外の要素を DOM から取り除く。
`<video>` を含まない JSX を返した瞬間、`videoRef.current` は `null` になる。

---

## 修正

`<video>` 要素を常に DOM に存在させ、status に応じてオーバーレイを重ねる構造に変更した。

```tsx
export function QrScanner({ onScan, active }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState("idle")

  // ...

  // <video> は常にマウント — status が何であっても videoRef が有効
  return (
    <div className="relative w-full aspect-square ...">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline muted autoPlay
        style={{ display: status === "scanning" ? "block" : "none" }}
      />

      {/* ローディングはオーバーレイで重ねる */}
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center ...">
          <div className="animate-spin ..." />
          <p>カメラを起動中...</p>
        </div>
      )}

      {/* エラーもオーバーレイ */}
      {status === "error" && (
        <div className="absolute inset-0 ...">
          {/* エラーメッセージ */}
        </div>
      )}
    </div>
  )
}
```

**ポイントは `display: none` と `visibility: hidden` の使い分けではない。**
`display: none` でも DOM には存在するため `videoRef.current` は有効なまま保たれる。
CSS で隠すのと、JSX から要素を消すのは全く別のことだ。

また、`!video` のときに黙ってリターンしていた箇所もエラー state を設定するよう直した。

```tsx
if (!video) {
  stopCamera()
  setStatus("error")      // 追加
  setErrorType("unknown") // 追加
  return
}
```

---

## あわせて直したこと

### facingMode の指定を緩める

```ts
// Before（厳しすぎる — OverconstrainedError が起きやすい）
video: { facingMode: "environment" }

// After（ideal 指定 — 背面カメラを優先するが失敗しない）
video: { facingMode: { ideal: "environment" } }
```

`"environment"` の文字列指定は実装によっては exact 制約として扱われ、
背面カメラが使えない状況（iPadの前面カメラのみ接続など）で `OverconstrainedError` を投げる。
`{ ideal: "environment" }` にすると「できれば背面を使って」という意味になり、失敗しにくい。

### play() の AbortError

iOS Safari では `video.play()` が `AbortError` を投げることがある。
autoplay ポリシーや直前の `play()` 呼び出しのキャンセルで発生する。

```ts
try {
  await video.play()
} catch (playErr) {
  const e = playErr as DOMException
  if (e.name === "AbortError") {
    await new Promise(r => setTimeout(r, 150))
    await video.play()  // 再試行
  } else {
    throw e
  }
}
```

### 10秒タイムアウト

getUserMedia が resolve も reject もしない場合（iOS で稀に発生する）に備え、
10秒でタイムアウトしてエラー状態に落とすようにした。

---

## 学び

### 1. useRef の current は DOM に連動して消える

`ref.current` は「今 DOM にある要素への参照」だ。
要素が DOM にない間は `null`。条件付きレンダリングで要素を返さなければ即 `null` になる。

非同期処理中に `ref.current` を使うときは、
「非同期処理が完了するまで、その要素が DOM に存在し続けるか」を確認する必要がある。

### 2. 「状態に応じて UI を切り替える」と「要素を消す」は別のこと

今回のような場合、状態に応じて UI を切り替えたいが、
DOM 要素は消したくないというケースがある。

解決策は:
- CSS の `display: none` / `visibility: hidden` で隠す（DOM には残る）
- オーバーレイで重ねる
- 親コンポーネントで非表示にするのではなく、コンポーネント内で管理する

### 3. エラーにならない失敗が最も見つけにくい

`!video` で黙ってリターンしていたことで、
getUserMedia が成功しているのにカメラが出ないという不可解な現象が生まれた。
失敗したときは必ず状態を更新し、ユーザーに伝える。

### 4. CI と実機で再現条件が違う

ヘッドレスブラウザにはカメラがないため getUserMedia が早期に失敗し、
「起動中固着」のステップまで進まなかった。
モバイル固有のバグは CI では見えないことがある。実機テストは代替できない。

---

## まとめ

| 問題 | 原因 | 修正 |
|---|---|---|
| 「起動中」で永久固着 | setStatus("loading") で video 要素が DOM から消え videoRef.current = null | video を常時 DOM マウント、オーバーレイで状態表示 |
| カメラが映らない | videoRef.current が null のまま srcObject を設定できない | 同上 |
| エラーが出ない | `!video` でサイレントリターン | setStatus("error") を呼ぶ |

useRef が持つ「DOM への参照」という性質を理解していれば、
条件付きレンダリングと非同期処理を組み合わせるときに同じ罠に落ちない。

---

## SNS投稿文

```
iPhoneでQRスキャン実装したら「カメラ起動中」から動かなくなった。

原因: setStatus("loading") で video 要素が DOM から消えて
videoRef.current が null になってた。

getUserMedia は成功してるのに video に srcObject を設定できず、
エラーにもならず永遠にスピナーが回り続ける。

修正: video を常に DOM にマウント、loading/error はオーバーレイで重ねる。
「状態に応じて UI 切り替える」と「DOM から要素を消す」は別のことだった。
```

## タグ

`React` `useRef` `getUserMedia` `iOS Safari` `QRスキャン` `非同期` `モバイル` `DOM` `カメラ`
