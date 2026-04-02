# ISSUE-146: メンバーのルーレットアニメーション skip バグ修正

## 概要

3名参加のルーレットで、Realtime 受信が失敗しポーリング fallback に頼ったメンバーが
ルーレット回転演出をスキップして結果画面が直接表示される不具合。

---

## 症状

- オーナー・Realtime 受信成功メンバーは回転アニメーションが正常再生
- Realtime 失敗メンバー（ポーリング fallback）は回転をスキップして結果が突然表示される
- ユーザー報告: 「3名中1名だけ結果だけ表示になった」

---

## 根本原因

### 主因: TOTAL_ANIM_MS とポーリング間隔の不整合

**該当箇所:** `app/room/[code]/play/page.tsx:470`

```typescript
const TOTAL_ANIM_MS = 5000  // spinStartedAt 起点の skip 閾値

setTimeout(() => {
  const elapsed = Math.max(0, Date.now() - startMs)
  if (elapsed >= TOTAL_ANIM_MS) {  // elapsed >= 5000ms でスキップ
    setWinner(winnerData)
    setPhase("result")
    return
  }
  setSpinElapsedMs(elapsed)
  setPhase("spinning")
}, delay)
```

`spinStartedAt = スピン時刻 + 3000ms (SPIN_COUNTDOWN_MS)`

ポーリング fallback の間隔は **10秒** (`app/room/[code]/play/page.tsx:307`)。
ポーリングで受信した場合の elapsed:

```
最悪ケース: 到着 T+10000ms → elapsed = 10000 - 3000 = 7000ms >= 5000ms → SKIP
```

`route.ts` コメント:
```
// SPIN_COUNTDOWN_MS 後にアニメーションが始まる = 3秒ポーリングのメンバーも間に合う
```

この設計は「3秒ポーリング」を想定しているが実際は10秒。ポーリング fallback に
頼ったメンバーは **100%** アニメーションをスキップする。

### 副因: Realtime missed events のリカバリーなし

Supabase `postgres_changes` は WebSocket 切断時の missed events を再送しない。
再接続後も次のポーリング（最大10秒後）まで受信できない。

---

## 発生タイムライン

```
T+0      オーナーがスピン → spinStartedAt = T+3000ms
T+3000   全員がアニメーション開始（設計上の期待）
T+8000   アニメーション終了（4500ms spin + 500ms bounce）

[Realtime 失敗時]
T+10000  ポーリング fallback 受信 → elapsed = 7000ms >= 5000ms → SKIP発動
```

---

## 再現条件

1. ルームに2名以上のメンバーが参加
2. 1名以上のメンバーが Realtime を受信できない（ネットワーク一時断など）
3. そのメンバーがスピン後の最初のポーリングを T+8001ms 以降に受信する

DevTools の Network タブで WebSocket をブロックすることで安定再現可能。

---

## 影響範囲

- オーナー: 影響なし（API レスポンスで即座に受信）
- メンバー（Realtime 正常）: 影響なし
- メンバー（ポーリング fallback）: **100% 再現**

---

## 修正方針

### 応急（即日、リスク最小）

`TOTAL_ANIM_MS` を `8000` に引き上げる。
アニメーション終了後も 3 秒のバッファを設け、ポーリング到着タイミングをカバー。

```typescript
// 変更前
const TOTAL_ANIM_MS = 5000

// 変更後
// spinStartedAt + 8000ms = オーナースピン時刻 + 11000ms
// ポーリング10秒 → elapsed最大7000 < 8000 → スキップしない
const TOTAL_ANIM_MS = 8000
```

elapsed が 5000〜8000ms の範囲は RouletteWheel に最小 duration 0.5s で再生させる
（`spinElapsedMs` を渡すと `duration = max(0.5, 4.5 - elapsedSec)` が発動）。

### 安全（推奨）

IN_SESSION 中のポーリング間隔を短縮し、全員が SPIN_COUNTDOWN_MS 内に受信できるようにする。

```typescript
// 変更前: 常に10秒
timeoutId = setTimeout(poll, 10000)

// 変更後: IN_SESSION 中は2秒
const pollInterval = (currentRoom?.status === "IN_SESSION") ? 2000 : 10000
timeoutId = setTimeout(poll, pollInterval)
```

### 理想（根本解決）

Realtime 再接続時に即座に `fetchRoom()` を実行し missed events をリカバリーする。

```typescript
channel.subscribe((status) => {
  if (status === "SUBSCRIBED") {
    // 再接続後に最新状態を取得
    fetchRoom()
  }
})
```

---

## 副次バグ（同時修正推奨）

### pendingMemberWinnerRef が null の場合の無限待機

**該当箇所:** `app/room/[code]/play/page.tsx:475-481`

```typescript
if (winnerData) {
  setWinner(winnerData)
  setPhase("result")
  spinScheduledRef.current = false
}
return  // winnerData が null → phase が "preparing" に固まる
```

修正案: `winnerData` が null の場合も `spinScheduledRef = false` + `setPhase("idle")` でリカバリー。

---

## 検証方法

1. DevTools Network タブで WebSocket (`wss://`) をブロック
2. 2タブでルーム参加（片方がオーナー、片方がメンバー）
3. オーナーがスピン
4. メンバータブでルーレット回転アニメーションが表示されることを確認
5. `TOTAL_ANIM_MS` 変更後: 修正前後でメンバーの挙動を比較

---

## ステータス

🔴 未修正 — 分析完了、実装待ち

**優先度:** High（ユーザー体験の核を破壊する演出バグ）
