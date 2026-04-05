# issue-098: ニアミス演出 — 「惜しかった！」感の追加

## ステータス
✅ 完了 — 2026-04-06

## 優先度
High

## デプロイブロッカー
No

---

## 概要

ルーレットが止まる際、本当の当選者の隣のセグメントを280ms間だけハイライトしてから
正しい当選者をハイライトする。

「もう少しで違う人だった！」感が生まれ、「もう一回」ボタンを押したくなる。

---

## 実装

`components/roulette-wheel.tsx` のバウンスアニメーション完了後:

```typescript
// 当選者の1つ前のセグメントを280ms間ハイライト（ニアミス演出）
const neighborIdx = (resolvedIdx - 1 + snapshotParticipants.length) % snapshotParticipants.length
setWinnerIndex(neighborIdx)
setTimeout(() => {
  setWinnerIndex(resolvedIdx)
  onSpinCompleteRef.current?.(snapshotParticipants[resolvedIdx], resolvedIdx)
}, 280)
```

---

## 受け入れ条件

- スピン停止直後に隣のセグメントが一瞬（約280ms）ハイライトされる
- 280ms後に正しい当選者がハイライトされ `onSpinComplete` が呼ばれる
- Owner と Member で onSpinComplete の呼び出しタイミングに影響なし（ローカル演出のみ）
