# ISSUE-219: 設計改善(P1) — showWinnerCard / winner の二重管理を廃止しクラッシュ耐性を高める

## ステータス
🔴 未着手

## 優先度
**P1 / High** — ISSUE-218 の応急修正後に対処。根本的な設計問題のため再発を防ぐ

## カテゴリ
Architecture / State / Refactor

## 対象スコア
技術: +1 / G-STACK信頼性: +1

---

## Summary

WinnerCard の表示は `showWinnerCard` と `winner` の 2 つの state で制御されている。
`winner` は即時更新され、`showWinnerCard` は useEffect 経由で遅延クリアされる。
この非対称な設計が ISSUE-218 のクラッシュを生んだ構造的根拠。

---

## Background

現在の WinnerCard 表示制御（`room-play-overlays.tsx`）：

```tsx
// winner が変化した時だけ showWinnerCard を更新する useEffect
useEffect(() => {
  if (!winner) { setShowWinnerCard(false); return }
  const t = setTimeout(() => setShowWinnerCard(true), 800)  // 800ms delay
  return () => clearTimeout(t)
}, [winner])
```

問題点：
1. `winner=null` になった瞬間と `showWinnerCard=false` になる瞬間に 1 レンダリングのギャップが生まれる
2. このギャップで `showWinnerCard && winner!.name` が null アクセスになる（ISSUE-218）
3. 将来 `winner` を null にする操作が追加されると同様のリスクが生まれる

---

## Current Behavior

- `showWinnerCard`（boolean）と `winner`（WinnerData | null）が別々に管理されている
- WinnerCard 800ms 遅延表示のために `showWinnerCard` state が存在する
- この遅延設計が `winner` との同期を壊す

---

## Expected Behavior

WinnerCard の遅延表示は state ではなく **表示側のアニメーションで実装**し、
条件は `winner` state だけで制御する：

```tsx
// 理想形（showWinnerCard state を廃止）
{winner && (
  <WinnerCard
    winner={winner.name}
    winnerIndex={winner.index}
    ...
  />
)}
```

WinnerCard の入場アニメーション（800ms delay）は framer-motion の `initial` / `animate` で対応：

```tsx
// WinnerCard 内部 or wrapper
<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ delay: 0.8, duration: 0.3 }}
>
  ...
</motion.div>
```

---

## Reproduction Steps

N/A（設計上の問題。ISSUE-218 の応急修正後に着手）

---

## Scope

- `app/room/[code]/play/_components/room-play-overlays.tsx`
  - `showWinnerCard` state を削除
  - WinnerCard の条件を `winner && (...)` に変更
  - 800ms delay を WinnerCard 側のアニメーション delay に移動
- `components/winner-card.tsx`
  - 入場アニメーションに `transition={{ delay: 0.8 }}` を追加

---

## Root Cause Hypothesis

`showWinnerCard` state は「WinnerCard の 800ms 遅延登場」を実現するために追加されたが、
その副作用として `winner` との同期問題が生まれた。

遅延は state ではなく CSS/framer-motion のアニメーション delay で十分実現できる。

---

## Proposed Fix

```tsx
// room-play-overlays.tsx（BEFORE）
const [showWinnerCard, setShowWinnerCard] = useState(false)

useEffect(() => {
  if (!winner) { setShowWinnerCard(false); return }
  const t = setTimeout(() => setShowWinnerCard(true), 800)
  return () => clearTimeout(t)
}, [winner])

// ...

{showWinnerCard && (
  <WinnerCard winner={winner!.name} ...

// ---

// room-play-overlays.tsx（AFTER）
// showWinnerCard state を完全削除

{winner && (
  <WinnerCard winner={winner.name} ...
```

```tsx
// winner-card.tsx（WinnerCard の入場に 0.8s delay を追加）
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.8, type: "spring", stiffness: 300, damping: 25 }}
>
  {/* WinnerCard content */}
</motion.div>
```

---

## Acceptance Criteria

- [ ] `showWinnerCard` state が削除されている
- [ ] WinnerCard 条件が `winner &&` のみで制御されている
- [ ] WinnerCard の 800ms 遅延入場が引き続き動作する（アニメーション delay で実現）
- [ ] 当選者発表リビール（`🎯 当選者発表！`）は WinnerCard が入場するまで表示される
- [ ] TypeScript 型エラーなし・`winner!` 非 null アサーションなし

## Priority
**P1** — ISSUE-218 の応急修正後に対処。ただし放置するとリファクタリング・機能追加時に再発する。

## Risk / Notes

- 変更量はそれなりにある（overlays から state 削除 + WinnerCard にアニメーション追加）
- ISSUE-207（停止演出）の「当選者発表！」リビールとのタイミング調整が必要
- `showWinnerCard` が現在 `room-play-overlays.tsx` 内でのみ使われているため影響範囲は限定的
