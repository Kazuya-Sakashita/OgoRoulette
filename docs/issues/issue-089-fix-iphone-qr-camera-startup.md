# ISSUE-089: iPhoneでQRスキャン時にカメラが起動しない問題を修正する

**ステータス:** ✅ 実装済み（commit: 5b5c81d）
**優先度:** Critical
**デプロイブロッカー:** 解消済み

---

## 1. 問題概要

### 何が起きているか

iPhoneで QRスキャンタブを選択すると「カメラを起動中...」と表示されたまま
カメラ映像が出ない。ユーザーには何が起きているか分からない。

### なぜ重大か

- QR参加導線がモバイルで完全に機能しない（= 今回実装した機能が iPhone でゼロ）
- 「壊れている」と感じてアプリ自体を信頼しなくなるリスク
- スピナーが回り続けるため、エラーと認識されず手動入力に戻れない

---

## 2. 再現条件

| 条件 | 予測 |
|---|---|
| iPhone Safari | 毎回再現（構造的バグ） |
| iPhone Chrome | 同様に再現（同じバグパス） |
| Android Chrome | **再現しない可能性が高い** — Android はレンダリングタイミングが異なる |
| ヘッドレスブラウザ | カメラなしエラーで先に落ちるため再現しない |
| 権限許可・拒否問わず | getUserMedia 成功でも失敗でも同じ構造なので再現 |

---

## 3. カメラ起動フロー分解

```
[ユーザーがQRタブを選択]
        ↓
[startCamera() 実行]
        ↓
[setStatus("loading")]  ← ここでリレンダリング発生
        ↓
[status === "loading" の分岐でローディングUI表示]
        ↓
[<video> 要素が DOM から消える → videoRef.current = null]
        ↓
[getUserMedia() 実行 ... 成功または失敗]
        ↓ ← 成功した場合
[const video = videoRef.current] → ★ null !!!
        ↓
[if (!video) { stopCamera(); return }] ← ★ エラー state をセットせず無言リターン
        ↓
[status は "loading" のまま]
        ↓
[スピナーが永久に回り続ける]
```

### 止まっている段階

**ステップ5（video要素への srcObject 設定）の前で、参照が null のままサイレントリターン**。

getUserMedia 自体は成功しているが、video 要素が DOM に存在しないため反映できない。

---

## 4. 根本原因候補

### 最有力: **G + H の複合（例外握りつぶし + state 固着）**

#### G: 例外を握りつぶして state だけ進んでいる

```tsx
// components/qr-scanner.tsx:88-92
const video = videoRef.current
if (!video) {
  stopCamera()
  return  // ← エラー state をセットしていない！！
}
```

`return` の前に `setStatus("error")` が呼ばれていない。

#### H: UI が「起動中」のまま戻らない state 管理ミス

```tsx
// status === "loading" のとき、video 要素はレンダリングされない
if (status === "loading") {
  return <スピナーUI />  // ← video 要素なし
}

// ...
return (
  <div>
    <video ref={videoRef} ... />  // ← status が loading 以外のときのみ存在
  </div>
)
```

**`setStatus("loading")` した瞬間に `videoRef.current` は `null` になる**。
これが根本構造。

#### E（副次的）: `playsinline` の設定タイミング

```tsx
// startCamera() 内
video.srcObject = stream
video.setAttribute("playsinline", "true")  // srcObject 設定後に動的付与
await video.play()
```

JSX 側では `playsInline` props を設定しているが、video 要素が DOM に存在する
（loading 以外のフェーズ）ときに動的設定しても遅い場合がある。
ただしこれは主原因ではなく副次問題。

#### F（副次的）: `facingMode` の厳しすぎる指定

```tsx
video: { facingMode: "environment" }
```

`"environment"` は exact 指定として解釈される実装がある。
`{ ideal: "environment" }` の方が安全。
ただし iPad など前面カメラのみの端末でなければ主原因にはならない。

### 原因分類まとめ

| 分類 | 該当 | 優先度 |
|---|---|---|
| A. getUserMedia 自体が失敗 | ❌ | — |
| B. 権限拒否 | ❌（権限許可でも起きる） | — |
| C. HTTPS 条件不備 | ❌（Vercel は HTTPS） | — |
| D. srcObject / play() 反映失敗 | ⚠️ 副次的 | 低 |
| E. playsInline 不足 | ⚠️ 副次的 | 低 |
| F. facingMode 厳しすぎ | ⚠️ 副次的 | 低 |
| **G. 例外握りつぶし** | ✅ **主因** | Critical |
| **H. state 固着** | ✅ **主因** | Critical |
| I. Safari 特有挙動 | ⚠️ 副次的 | 低 |

---

## 5. 調査計画

### すぐ確認する項目（コード）

1. `components/qr-scanner.tsx:88-92` — `!video` のとき `setStatus("error")` が呼ばれていないことを確認（**既に確認済み**）
2. `status === "loading"` のレンダリング分岐で `<video>` が存在するか確認（**存在しないことを確認済み**）

### ログ追加ポイント（デバッグ用）

```tsx
const startCamera = useCallback(async () => {
  scannedRef.current = false
  setStatus("loading")
  setErrorType(null)

  try {
    const stream = await navigator.mediaDevices.getUserMedia(...)
    console.log("[QrScanner] stream OK:", stream)  // ← ここ
    streamRef.current = stream

    const video = videoRef.current
    console.log("[QrScanner] videoRef:", video)  // ← ここ（null になるはず）
    if (!video) {
      console.error("[QrScanner] videoRef is null — DOM not ready")  // ← ここ
      stopCamera()
      return
    }
    ...
  }
}, ...)
```

### 実機で再確認する項目

- `stream` が取れているかどうか（Safari DevTools の Console）
- `videoRef.current` が null かどうか
- status が "loading" のまま止まっているかどうか

---

## 6. 修正方針

### 応急対応（「起動中のまま分からない」を止める）

`!video` のとき `setStatus("error")` を呼ぶ。エラーメッセージと再試行ボタンが出る。

```tsx
if (!video) {
  stopCamera()
  setStatus("error")        // ← 追加
  setErrorType("unknown")   // ← 追加
  return
}
```

これだけでスピナー固着は解消。しかし映像が出ない根本は残る。

---

### 安全修正（iPhone Safari で安定させる）

`<video>` 要素を **常に DOM に存在させ、CSS で表示・非表示を切り替える**。
status に関係なく videoRef が有効になる。

```tsx
export function QrScanner({ onScan, onError, active = true }: QrScannerProps) {
  // ...

  return (
    <div className="relative w-full aspect-square rounded-3xl overflow-hidden bg-black">

      {/* video は常に DOM にマウント。status に関わらず videoRef が有効になる */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        autoPlay
        style={{ display: status === "scanning" ? "block" : "none" }}
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* ローディングオーバーレイ */}
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-3" />
          <p className="text-sm text-muted-foreground">カメラを起動中...</p>
        </div>
      )}

      {/* エラーオーバーレイ */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary px-6 text-center">
          {/* エラー内容 */}
        </div>
      )}

      {/* ビューファインダー */}
      {status === "scanning" && (
        <div className="absolute inset-0 flex items-center justify-center">
          {/* 四隅の角線 + スキャンライン */}
        </div>
      )}
    </div>
  )
}
```

**重要な変更点:**
- `<video>` を常に DOM にマウントしたまま、`display: none` で隠す
- status がどの状態でも `videoRef.current` が有効
- loading/error/scanning をオーバーレイで重ねる構造

---

### 理想修正（端末差異と fallback 含む）

安全修正に加え、以下を組み合わせる:

1. **`facingMode` を `ideal` に緩める**

```tsx
video: { facingMode: { ideal: "environment" } }
```

2. **`video.play()` の AbortError を別途ハンドリング**

iOS Safari は `play()` が非同期で AbortError を投げる場合がある。

```tsx
try {
  await video.play()
} catch (playErr) {
  const e = playErr as DOMException
  if (e.name !== "AbortError") throw e
  // AbortError は autoPlay ポリシーによるもの — 再試行
  await new Promise(r => setTimeout(r, 100))
  await video.play()
}
```

3. **タイムアウト付きスタート**

getUserMedia が resolve も reject もしない場合（稀だが iOS で報告あり）に備え、
10秒でタイムアウトして error 状態に落とす。

```tsx
const timeoutId = setTimeout(() => {
  if (statusRef.current === "loading") {
    setStatus("error")
    setErrorType("unknown")
  }
}, 10_000)
// ...finally: clearTimeout(timeoutId)
```

---

## 7. UX改善案

### 権限拒否時

```
カメラへのアクセスが許可されていません。
設定アプリ > Safari > カメラ から許可してください。
[コード入力で参加する →]
```

### 非対応時

```
このブラウザはカメラスキャンに対応していません。
[コード入力で参加する →]
```

### 起動失敗時（unknown）

```
カメラを起動できませんでした。
[再試行] [コード入力で参加する →]
```

### 「起動中」タイムアウト時

```
カメラの起動に時間がかかっています。
[コード入力で参加する →]
```

---

## 8. 検証計画

| 端末・環境 | 確認内容 |
|---|---|
| iPhone Safari（権限許可）| カメラ映像が出るか、QR読み取り成功するか |
| iPhone Safari（権限拒否）| 権限拒否UIが出るか、設定誘導テキストが出るか |
| iPhone Safari（再試行）| 再試行ボタンでカメラが再起動するか |
| iPhone Chrome | Safari と同様に動作するか |
| Android Chrome | 既存動作が壊れていないか（回帰） |
| 手動タブ切り替え | スキャン → 手動 → スキャンでカメラが再起動するか |
| ページ離脱 | カメラストリームが停止するか |

---

## 9. 推奨アクション

### 最初にやるべき1手

**安全修正（`<video>` を常時 DOM マウント）を実装する。**

これだけで:
- スピナー固着が解消
- iPhone でカメラ映像が出る
- タイムアウトがなくても正しくエラー表示される

### 次にやるべきこと

1. `facingMode: { ideal: "environment" }` に緩める
2. `video.play()` の AbortError ハンドリング追加
3. iPhone 実機で QR 読み取り動作を確認

---

## 修正ファイル

- `components/qr-scanner.tsx` — 全面的な構造見直し

## タスク

- [ ] `<video>` を常時 DOM マウント + オーバーレイ構造に変更（主修正）
- [ ] `facingMode: { ideal: "environment" }` に変更
- [ ] `play()` AbortError ハンドリング追加
- [ ] `!video` のときのエラー state 設定（応急対応）
- [ ] iPhone Safari 実機確認
- [ ] Android Chrome 回帰確認

## 受け入れ条件

- iPhone Safari でQRスキャンタブを選んだときにカメラ映像が表示される
- 起動失敗時に原因が分かるエラーが表示される
- 手動入力タブへ戻れる
- Android や他導線に副作用がない

## 優先度

Critical

## デプロイブロッカー

Yes — QR参加導線がiPhoneで完全に機能しない
