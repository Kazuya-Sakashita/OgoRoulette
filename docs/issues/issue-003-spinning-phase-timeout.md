# [ISSUE-003] phase="spinning" または "preparing" で永続停止したときの自動回復機構がない

## 🧩 概要

`phase` が `"spinning"` または `"preparing"` のまま戻らなくなった場合、SPIN ボタンが永続的に無効化され、ページリロードなしに回復できない。現状、この状態への自動回復機構（タイムアウト）が存在しない。

## 🚨 背景 / なぜ問題か

**`phase = "spinning"` で止まるケース:**

`handleSpinComplete` は Framer Motion の `.then()` チェーンの末尾で呼ばれる:

```tsx
// roulette-wheel.tsx:108-126
animate(rotation, targetRotation, { duration: 4.5 }).then(() => {
  animate(rotation, targetRotation - bounceAmount, { duration: 0.18 }).then(() => {
    animate(rotation, targetRotation, { duration: 0.28 }).then(() => {
      onSpinCompleteRef.current?.(winner, index)  // ← ここが呼ばれないと "spinning" のまま
    })
  })
})
```

Framer Motion の `animate()` の `.then()` が何らかの理由で発火しない場合（低スペックデバイスでのアニメーション最適化スキップ・メモリ不足・稀なバグ）、`phase` は `"spinning"` のまま止まる。

**`phase = "preparing"` で止まるケース:**

ISSUE-001〜002 のフリッカーが発生した場合や、`spinStartedAt` の計算で非常に大きな `delay` が生じた場合（ISSUE-004）。

**影響:**
- `phase !== "waiting"` → SPIN ボタン disabled（`play/page.tsx:837`）
- `disabled:opacity-50 disabled:cursor-not-allowed` のみで、ユーザーには理由が伝わらない
- `handleRespin` を呼ぶ手段もない（`phase === "result"` でのみ表示）
- **ページリロードが唯一の回復手段**

## 🎯 目的

`phase = "spinning"` または `"preparing"` が想定時間を超えて継続している場合、自動的に `phase = "waiting"` にリセットし、エラーメッセージを表示する。ユーザーがページをリロードしなくても回復できる状態にする。

## 🔍 影響範囲

- **対象機能:** SPIN ボタンの有効化 / フェーズ遷移
- **対象画面:** `/room/[code]/play`
- **対象コンポーネント:** `app/room/[code]/play/page.tsx`
  - `phase` state 管理
  - `spinError` state

## 🛠 修正方針

`useEffect` でタイムアウトを設定する。以下を `play/page.tsx` に追加する。

**`phase = "spinning"` のタイムアウト（7.5秒）:**

```tsx
useEffect(() => {
  if (phase !== "spinning") return

  // アニメーション総時間: 4.5秒 + バウンス0.46秒 + バッファ2.5秒 = 7.46秒
  const SPIN_TIMEOUT_MS = 4500 + 500 + 2500
  const id = setTimeout(() => {
    console.warn("[OgoRoulette] spin animation timeout — resetting phase to waiting")
    setPhase("waiting")
    setSpinError("アニメーションがタイムアウトしました。再試行してください")
    spinScheduledRef.current = false
    setPendingWinnerIndex(undefined)
  }, SPIN_TIMEOUT_MS)

  return () => clearTimeout(id)
}, [phase])
```

**`phase = "preparing"` のタイムアウト（SPIN_COUNTDOWN_MS + 6秒）:**

```tsx
useEffect(() => {
  if (phase !== "preparing") return

  // SPIN_COUNTDOWN_MS(3000) + clock skew 許容(2000) + バッファ(4000) = 9秒
  const PREPARING_TIMEOUT_MS = SPIN_COUNTDOWN_MS + 6000
  const id = setTimeout(() => {
    // spinScheduledRef が true のまま setTimeout が発火しなかった場合の回収
    if (phase === "preparing") {
      console.warn("[OgoRoulette] preparing phase timeout — resetting")
      setPhase("waiting")
      setSpinError("準備がタイムアウトしました。再試行してください")
      spinScheduledRef.current = false
    }
  }, PREPARING_TIMEOUT_MS)

  return () => clearTimeout(id)
}, [phase]) // eslint-disable-line react-hooks/exhaustive-deps
```

## ⚠️ リスク / 副作用

- タイムアウト値を短くしすぎると、正常なスピン（遅いデバイス・低速回線）を誤って中断する
  - spinning: 最短アニメーション時間 `4.5 + 0.46 = 4.96秒` → 7.5秒のバッファは十分
  - preparing: `SPIN_COUNTDOWN_MS = 3秒` + clock skew 許容 2秒 → 9秒のバッファは妥当
- タイムアウト後に `setPhase("waiting")` が呼ばれた場合、既に `"result"` に遷移していれば `phase` の上書きが起きる → `phase === "preparing"` or `"spinning"` のチェックを入れることで防止
- オーナーと非オーナーで同じタイムアウトが発火する問題はない（非オーナーは SPIN ボタンを持たない）

## ✅ 確認項目

- [ ] `phase = "spinning"` のまま 7.5 秒が経過したとき、自動的に `"waiting"` に戻る
- [ ] `phase = "preparing"` のまま 9 秒が経過したとき、自動的に `"waiting"` に戻る
- [ ] タイムアウト後にエラーメッセージが表示される
- [ ] 正常なスピン（4.5秒アニメーション）がタイムアウトで中断されない
- [ ] タイムアウト後に SPIN ボタンが再度押せる

## 🧪 テスト観点

**手動確認:**
1. DevTools で `RouletteWheel` コンポーネントの `onSpinComplete` をモック（空関数に差し替え）して `phase = "spinning"` を維持 → 7.5 秒後に自動リセットされることを確認
2. 通常スピンで 7.5 秒以内に `handleSpinComplete` が呼ばれ、タイムアウトが発火しないことを確認

## 📌 受け入れ条件（Acceptance Criteria）

- [ ] `phase = "spinning"` が 7.5 秒以上継続したとき `"waiting"` に自動リセットされる
- [ ] `phase = "preparing"` が 9 秒以上継続したとき `"waiting"` に自動リセットされる
- [ ] 自動リセット後にエラーメッセージ（`spinError`）が表示される
- [ ] 正常なスピンフローでタイムアウトが誤発火しない

## 🏷 優先度

**Critical**（永続スタックの最終防衛線）

## 📅 実装順序

**3番目**（ISSUE-001・002 と同時またはすぐ後に対応）

## 🔗 関連Issue

- [ISSUE-001] ゲストホストの `isOwner` フリッカー
- [ISSUE-002] spinScheduledRef 競合
- [ISSUE-004] clock skew による delay 上限なし
