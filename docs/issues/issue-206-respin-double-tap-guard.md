# ISSUE-206: handleRespin 二重タップで重複カウントダウンタイマーが起動するリスク

## ステータス
✅ 完了 — 2026-04-05

## 優先度
**Medium**

## カテゴリ
Bug / UX

## 概要
`app/home/page.tsx` の `handleRespin` は WinnerCard の「もう一回！」ボタンから呼ばれる。この関数は `setWinner(null)` + `startSpin()` を呼ぶが、二重タップ防止ガードがない。React の非同期 state 更新中に2回呼ばれると、2つの `startSpin` が実行され、重複カウントダウンタイマー（3×2=6本）が起動する可能性がある。

## 問題のコード

```typescript
// app/home/page.tsx:392
const handleRespin = () => {
  setWinner(null)
  setLastTreatCount(undefined)
  setLastTreatTitle(undefined)
  setLastRanking(undefined)
  resetRecording()
  startSpin(participants.length)  // ← ガードなし
}
```

`startSpin` 内には `if (isSpinning || participantCount < 2 || countdown !== null) return` があるが、
`handleRespin` が素早く2回呼ばれた場合、1回目の state 更新が React のバッチングで未適用の間に2回目が実行されることで、両方の `startSpin` が guards を通過してしまう。

## 修正方針

```typescript
const isRespinningRef = useRef(false)

const handleRespin = () => {
  if (isRespinningRef.current) return
  isRespinningRef.current = true
  setWinner(null)
  setLastTreatCount(undefined)
  setLastTreatTitle(undefined)
  setLastRanking(undefined)
  resetRecording()
  startSpin(participants.length)
  // startSpin がカウントダウンを開始したら ref をリセット
  // countdown が null → non-null になった時点でリセット
  setTimeout(() => { isRespinningRef.current = false }, 500)
}
```

または WinnerCard 側でボタンを `disabled` にする（呼び出し元でガード）:

```typescript
// WinnerCard の「もう一回！」ボタン
<button
  onClick={() => { onRespin(); onClose() }}
  disabled={isRespinCalled}  // state or ref
>
```

## 影響ファイル
- `app/home/page.tsx` — `handleRespin` に ref ガード追加

## 修正工数
約 20 分

## 参照
- ISSUE-200（第4回評価）で BUG-06 として特定
