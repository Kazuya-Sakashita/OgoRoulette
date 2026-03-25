# [ISSUE-006] `handleRespin` 後のポーリング競合で SPIN ボタンが一時的に「結果を見る」に置き換わる

## 🧩 概要

「もう一回！」ボタンを押した後（`handleRespin`）、楽観的更新で `room.status = "WAITING"` になるが、この直後にポーリングが `"COMPLETED"` を返すと `setRoom` が `"COMPLETED"` に上書きする。この結果 `isCompleted = true` になり、SPIN ボタンが「結果を見る」に一時的に置き換わる。通常は数秒以内に自己解決するが、reset API が失敗した場合は永続する。

## 🚨 背景 / なぜ問題か

**`handleRespin` の処理順（`play/page.tsx:414-438`）:**

```tsx
const handleRespin = async () => {
  setWinner(null)
  setPhase("waiting")
  // ...
  // ← この時点では room.status は "COMPLETED" のまま
  // ← isCompleted = true → SPIN ボタンが「結果を見る」に切り替わる

  const res = await fetch(`/api/rooms/${code}/reset`, ...)
  if (res.ok) {
    setRoom(prev => ({ ...prev, status: "WAITING", sessions: [] }))
    // ← ここでやっと "WAITING" になるが、この前にポーリングが発火すると競合
  }
}
```

**ポーリングによる上書き（`play/page.tsx:195-203`）:**

```tsx
setRoom(prev => {
  if (
    prev &&
    prev.status === data.status &&  // ← "WAITING" != "COMPLETED" → 上書き
    ...
  ) return prev
  return data  // ← data.status = "COMPLETED" で上書き
})
```

**発生条件:**
- reset API の応答待ち（約100〜500ms）の間にポーリングが発火するとき
- ポーリング周期は 3 秒ごとのため、reset API が遅い場合や直前にポーリングが走ったときに発生しやすい

**reset 失敗時の永続化:**
- reset API が失敗した場合、`setRoom` の楽観的更新が走らない
- しかし `setPhase("waiting")` は既に実行済み
- ポーリングが `"COMPLETED"` を返し続けると `isCompleted = true` → SPIN 永続不可

## 🎯 目的

`handleRespin` 呼び出し後、SPIN ボタンが「結果を見る」に置き換わることなく、スムーズに `phase = "waiting"` の状態で再表示される。

## 🔍 影響範囲

- **対象機能:** 再スピンフロー / ルームステータス表示
- **対象画面:** `/room/[code]/play`
- **対象コンポーネント:** `app/room/[code]/play/page.tsx`
  - `handleRespin` 関数（`line:414`）
  - `isCompleted` 派生 state（`line:151`）
  - `setRoom` 楽観的更新

## 🛠 修正方針

**方針: API 呼び出し前に楽観的更新を実行し、失敗時に元に戻す**

```tsx
const handleRespin = async () => {
  setWinner(null)
  setPhase("waiting")
  setPendingWinnerIndex(undefined)
  setSpinError(null)
  setSpinStartedAtMs(null)
  spinScheduledRef.current = false
  prevSessionIdRef.current = null
  pendingMemberWinnerRef.current = null
  resetRecording()

  // API 呼び出し前に楽観的更新（SPIN ボタンをすぐに表示するため）
  setRoom(prev => prev ? { ...prev, status: "WAITING", sessions: [] } : prev)

  try {
    const res = await fetch(`/api/rooms/${code}/reset`, {
      method: "POST",
      headers: buildGuestAuthHeaders(),
    })
    if (!res.ok) {
      const data = await res.json()
      setSpinError(data.error || "リセットに失敗しました")
      // 楽観的更新を戻す（最新のルーム情報を再取得）
      await fetchRoom()
    }
  } catch {
    setSpinError("ネットワークエラーが発生しました")
    // 楽観的更新を戻す
    await fetchRoom()
  }
}
```

**追加: `prevSessionIdRef` のリセット方法の改善**

`prevSessionIdRef.current = null` の代わりに `prevSessionIdRef.current = ""` など「存在するが空のセッション ID」を使うことで、メンバー用エフェクトが `undefined`（初回）と `null`（リセット後）を区別できるようにする。

## ⚠️ リスク / 副作用

- `fetchRoom()` が async のため、失敗時の rollback が即時でない
- 楽観的更新後に reset が失敗した場合、ユーザーは一瞬 SPIN が有効に見えてから無効に戻る。ただし `spinError` が表示されるため理由は伝わる

## ✅ 確認項目

- [ ] 「もう一回！」押下直後に SPIN ボタンが表示される（「結果を見る」への切り替わりがない）
- [ ] reset API 失敗時にエラーが表示され、room.status が再取得される
- [ ] reset API 成功後に SPIN が正常動作する
- [ ] ポーリングと楽観的更新の競合で無限ループにならない

## 🧪 テスト観点

**手動確認:**
1. スピン完了後「もう一回！」→ SPIN ボタンが即座に表示される（チラつきなし）
2. reset API をモック 500 → エラーが表示され room.status が COMPLETED に戻る
3. ポーリングが「もう一回！」と同時に走ったケース（ネットワーク throttle でシミュレーション）

## 📌 受け入れ条件（Acceptance Criteria）

- [ ] 「もう一回！」押下後に「結果を見る」ボタンへの一時的切り替わりが発生しない
- [ ] reset API 失敗時にエラーメッセージが表示される
- [ ] reset API 失敗後にルームが最新状態に再取得される

## 🏷 優先度

**High**

## 📅 実装順序

**6番目**

## 🔗 関連Issue

- [ISSUE-005] spin-complete 失敗時の room IN_SESSION 放置
