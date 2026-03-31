# issue-093: 当選確定の瞬間に「今すぐシェア」ボタンを追加する

## ステータス
✅ 実装済み（commit: f3dfd44）

## 優先度
High

## デプロイブロッカー
No

---

## 概要

現状、当選発表（WinnerCard Phase A）からシェアシートが開くまでに最低5ステップかかる。
感情のピーク（当選確定の瞬間）から離れた位置にシェアアクションがあるため、
「後でシェアしよう」と思ったユーザーの大半がシェアしない。

WinnerCard Phase A（全画面当選発表）の画面に「今すぐシェア（画像）」ボタンを追加し、
**動画録画の完了を待たずに静止画を即シェアできる「ライトパス」** を提供する。

---

## 背景

現状のシェアまでの導線:
```
当選確定
  ↓
WinnerCard Phase A（4秒間の全画面演出）
  ↓ 自動 or タップで移行
WinnerCard Phase B（詳細シート）
  ↓ タップ
シェアシートを開く
  ↓ タップ
テンプレート選択
  ↓ タップ
"動画をシェア" ボタン
  ↓
Web Share API / クリップボード
```

5ステップ、かつ動画録画（約12秒）が完了するまで本シェアができない。
感情が冷めるタイミングでシェアを求めている。

---

## 改善後のUI

```
[WinnerCard Phase A — 全画面当選発表]

  👑 Aさんが奢り確定！

  [紙吹雪・アニメーション]

  ┌────────────────────────────┐
  │  📸 今すぐシェア（画像）    │  ← NEW: 静止画で即シェア
  └────────────────────────────┘

  ↓ 動画録画が完了したら自動で表示切り替え

  ┌────────────────────────────┐
  │  🎬 動画でシェア           │  ← 既存（録画完了後に有効化）
  └────────────────────────────┘

  ────────── または ──────────

  [ タップして詳細を見る ]    ← Phase B へ
```

---

## 実装方針

### 静止画生成

WinnerCard Phase A が表示されているとき、`RecordingCanvas` の現在フレームを
`canvas.toDataURL("image/png")` または `canvas.toBlob("image/png")` で取得する。

RecordingCanvas は reveal フェーズで当選者名・クラウン・グロウを描画しているため、
シェアに適した静止画が自動的に得られる。

```typescript
// winner-card.tsx または play/page.tsx
const captureShareImage = (): Promise<Blob | null> => {
  const canvas = recordingCanvasRef.current
  if (!canvas) return Promise.resolve(null)
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png")
  })
}
```

### シェア処理

```typescript
const handleInstantShare = async () => {
  const imageBlob = await captureShareImage()
  if (!imageBlob) return

  const file = new File([imageBlob], "ogo-roulette-result.png", { type: "image/png" })
  const text = `🎰 OgoRoulette で ${winner} さんが奢りに決定！\n#OgoRoulette`

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text, url: shareUrl })
  } else {
    // フォールバック: URL + テキストをシェア or クリップボードにコピー
    await navigator.share({ text, url: shareUrl }).catch(() => {
      navigator.clipboard.writeText(`${text}\n${shareUrl}`)
    })
  }
}
```

### ボタンの状態管理

- `recordingPhase === "reveal"` のとき: 「今すぐシェア（画像）」を表示
- `recordedBlob !== null` になったとき: ボタンを「動画でシェア」に自動切り替え
- どちらの状態でも Phase A 上に表示する（Phase B へ移動させない）

### 表示タイミング

Phase A の演出が視覚的に落ち着いてから表示する（t=1.5秒後）。
冠 + 名前が出て感情が高まったところでボタンが現れるのが自然。

```typescript
const [showShareButton, setShowShareButton] = useState(false)

useEffect(() => {
  if (!isPhaseA) return
  const id = setTimeout(() => setShowShareButton(true), 1500)
  return () => clearTimeout(id)
}, [isPhaseA])
```

---

## タスク

- [ ] `WinnerCard` に Phase A 用の「今すぐシェア（画像）」ボタンを追加
- [ ] `captureShareImage()` 関数を実装（canvas.toBlob）
- [ ] `recordingCanvasRef` を WinnerCard に渡す（または play/page.tsx でハンドリング）
- [ ] `recordedBlob` が完成したらボタンを「動画でシェア」に自動切り替え
- [ ] iOS Safari で `navigator.canShare({ files })` が動作することを確認
- [ ] Android Chrome で動作確認
- [ ] フォールバック（URL共有 → クリップボードコピー）を確認

---

## 受け入れ条件

- WinnerCard Phase A の画面にシェアボタンが表示される（t=1.5秒後から）
- ボタンタップで静止画を即シェアできる（動画録画の完了を待たない）
- 動画録画が完了したらボタンが「動画でシェア」に自動的に変わる
- iOS Safari / Android Chrome / PC ブラウザで正常動作する
- フォールバックがある（Web Share 非対応環境でもクリップボードコピーが機能する）

---

## 実装メモ

- `RecordingCanvas` は `reveal` フェーズ中も描画ループが動いているため、
  任意のタイミングで `canvas.toBlob()` を呼べば現在フレームが取得できる
- Phase A を表示してから約 t=0.65s で名前ズームアニメーションが完了するため、
  t=1.5s で静止画キャプチャするとほぼ完成状態の当選画面が取得できる
- `navigator.canShare({ files: [...] })` は iOS 15+、Android Chrome 86+ でサポート
