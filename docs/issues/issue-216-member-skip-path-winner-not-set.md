# ISSUE-216: バグ修正 — PCメンバー遅延参加時に WinnerCard が表示されない

## ステータス
✅ 完了 — 2026-04-06

## 優先度
**Critical** — マルチプレイヤーの根幹機能が壊れている。ホスト以外の参加者が結果を見られない

## カテゴリ
Bug / UX / Multiplayer

## 対象スコア
技術: +1（バグ修正） / G-STACK信頼性: +1 / HEART-Task success: +1

---

## 背景

### 現象

PCや遅延ネットワーク環境のメンバーが、スピン開始から **5500ms 以上** 経過してポーリングを検出した場合、
回転アニメーションがスキップされ **WinnerCard も表示されない**。

参加者は「スピンが始まった」とも「誰が当たったか」とも分からないまま、 `waiting` 状態に見える画面を眺める。

### 再現条件

1. ホストがスピンを開始する
2. メンバーが 5.5 秒以上経過後にポーリング結果を受信する（PCや低速ネット環境）
3. メンバー画面で何も演出が起きない

---

## 根本原因

`app/room/[code]/play/use-spin.ts` の `scheduleSpin` 関数内スキップパス：

```typescript
// L381-385
if (elapsed >= SKIP_THRESHOLD_MS) {
  spinScheduledRef.current = false
  setPhase("result")   // ← phase を "result" に変える
  return               // ← ここで return してしまう
}
```

`pendingMemberWinnerRef.current` には winner データが格納済み（L359-365）だが、
`setWinner()` を呼ばずに return するため `winner` state が `null` のまま。

`room-play-overlays.tsx` の WinnerCard レンダリング条件：
```tsx
{showWinnerCard && (
  <WinnerCard winner={winner!.name} ...
```

`winner` が null → `showWinnerCard` が true になっても WinnerCard は表示されない（参照エラーを防ぐため `winner!` を参照するが `showWinnerCard` のトリガーが `winner` stateの変化に依存）。

具体的には `room-play-overlays.tsx` L124-128：
```tsx
useEffect(() => {
  if (!winner) { setShowWinnerCard(false); return }   // ← winner が null だとクリアされる
  const t = setTimeout(() => setShowWinnerCard(true), 800)
  return () => clearTimeout(t)
}, [winner])
```

`winner` が null のまま `phase="result"` になると、`showWinnerCard` は永遠に false。

---

## 修正内容

`use-spin.ts` のスキップパスに `setWinner` + 付帯処理を追加：

```typescript
if (elapsed >= SKIP_THRESHOLD_MS) {
  spinScheduledRef.current = false
  setPendingWinnerIndex(undefined)
  const skippedWinner = pendingMemberWinnerRef.current
  if (skippedWinner) {
    setWinner(skippedWinner)
    pendingMemberWinnerRef.current = null
    playResultSound()
    vibrate(HapticPattern.result)
    setShowConfetti(true)
    setShowPrismBurst(true)
    setTimeout(() => setShowPrismBurst(false), 1800)
    clearTimeout(confettiTimerRef.current ?? undefined)
    confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 6000)
  } else {
    showResult(room)  // fallback: セッション直読みで winner を補完
  }
  setPhase("result")
  return
}
```

---

## 影響ファイル

- `app/room/[code]/play/use-spin.ts` — スキップパスに winner 設定を追加（L381-385）

---

## 完了条件

- [ ] スピン開始から 6秒後に参加したメンバーが WinnerCard を受け取れる
- [ ] 当選者名・金額表示が正しい
- [ ] 絵文字リアクションパレット（ISSUE-213）が表示される
- [ ] スキップ時もコンフェッティが出る
- [ ] PC Chrome + iPhone Safari の両方で確認

## 期待スコア

技術: +1 / G-STACK: +0.5 / HEART-Task success: +0.5 → 総合: +1〜2点
