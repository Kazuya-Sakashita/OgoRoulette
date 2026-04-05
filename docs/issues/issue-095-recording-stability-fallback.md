# issue-095: 録画安定化 — MediaRecorder 失敗時に静止画フォールバック

## ステータス
✅ 完了 — 2026-04-06

## 優先度
High

## デプロイブロッカー
No

---

## 概要

iOS Safari では `MediaRecorder` API が動画形式をサポートしていないため、
`recorderRef.current.stop()` が null または空の Blob を返すケースがある。
この場合、シェアシートに何も表示されず「シェアできない」体験になる。

録画が失敗した場合でも `recordingCanvasRef` から静止画（PNG）を取得し、
`recordedBlob` にセットすることで最低限のシェア体験を保証する。

---

## 問題

```typescript
// 修正前
const blob = await recorderRef.current.stop()
if (blob && blob.size > 0) setRecordedBlob(blob)
// blob が null/empty の場合は何もセットされない → シェアシートが開かない
```

---

## 修正方針

```typescript
// 修正後（ISSUE-095）
const blob = await recorderRef.current.stop()
if (blob && blob.size > 0) {
  setRecordedBlob(blob)
} else {
  // iOS Safari フォールバック: recordingCanvas から PNG を取得
  const canvas = recordingCanvasRef.current
  if (canvas) {
    const png = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"))
    if (png && png.size > 0) setRecordedBlob(png)
  }
}
```

---

## 実装箇所

- `lib/use-video-recorder.ts` — `stopRecordingAfterReveal()` 内

---

## 受け入れ条件

- iOS Safari で録画が失敗した場合でも静止画がシェアシートに表示される
- 動画録画が成功した場合は従来どおり動画が優先される
- PNG フォールバックが使われた場合も winner-card.tsx の「今すぐシェア 📸」ボタンが機能する
