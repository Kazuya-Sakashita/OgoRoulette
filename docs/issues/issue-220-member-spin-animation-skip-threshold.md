# ISSUE-220: バグ修正(P0) — スマホメンバーのルーレット回転演出がスキップされる

## ステータス
✅ 完了 — 2026-04-07

## 優先度
**P0 / Critical** — PCオーナー + スマホメンバーで 100% に近い頻度で再現。コアUXが壊れている

## カテゴリ
Bug / Multiplayer / Animation / State

## 対象スコア
HEART-Task success: +1 / 感情: +1 / G-STACK信頼性: +1

---

## Summary

PCオーナーがスピンすると、スマホメンバー側ではルーレット回転演出が表示されず、
いきなり結果（WinnerCard）が表示される。
ISSUE-216 の修正後も、**演出スキップ自体は未解決**のままになっている。

---

## Background

ISSUE-216 は「スキップパスで `setWinner()` が呼ばれず WinnerCard が表示されない」を修正した。
しかし「スキップ自体が不当に発動する」という根本問題は残っている。

スキップ判定は `elapsed = now - serverStartTime >= SKIP_THRESHOLD_MS(5500)` で行われる。
`serverStartTime` はサーバーがスピンを開始した時刻であり、
**メンバーがそのデータを受信した時刻ではない**。

モバイルネットワークや 2 秒ポーリングの遅延により、
メンバーが IN_SESSION を検出した時点ですでに `elapsed >= 5500ms` になっている場合、
「アニメーションを再生する余裕がない」と誤判定され、演出が完全にスキップされる。

---

## Current Behavior

1. PCオーナーがスピンを実行（T=0ms）
2. スマホメンバーのポーリングが遅延（T=5600ms 以降に IN_SESSION を検出）
3. `elapsed = 5600 - 0 = 5600ms >= 5500ms` でスキップ判定が発動
4. `phase` が `"preparing"` → `"result"` に遷移（`"spinning"` を経由しない）
5. `RouletteWheel.isSpinning` が一度も `true` にならない
6. スマホ側にルーレット回転演出が表示されず、WinnerCard が突然現れる

---

## Expected Behavior

- メンバー側でも必ずルーレット回転演出が表示される
- 遅れて検出した場合は短縮版アニメーション（0.5秒〜）で表示する
- `phase` は必ず `"waiting" → "preparing" → "spinning" → "result"` の順で遷移する
- PCオーナー / スマホメンバー で演出フローが一致する

---

## Reproduction Steps

1. PC でルーム作成（オーナー）
2. スマホで参加（メンバー）
3. PC のルーレットをスピン
4. スマホ側の演出を確認
5. スマホが 5.5 秒以上遅れて IN_SESSION を検出するとスキップが発生

※モバイルネットワーク遅延、ブラウザタブ非アクティブ状態、低スペックデバイスで発生しやすい

---

## Root Cause

`app/room/[code]/play/use-spin.ts` の `scheduleSpin()` 内スキップ判定：

```typescript
// L368: スピン開始時刻（サーバー側）
const startMs = new Date(session.startedAt).getTime()

// L376: メンバーがこのタイムアウトを実行した時刻
const now = Date.now()
const adjustedNow = now + clockOffsetMsRef.current

// L378: elapsed = サーバーがスピンを開始してからの経過時間
const elapsed = Math.max(0, adjustedNow - startMs)

// L381: ← ここが問題
// elapsed はサーバーイベント起点で測定されているが
// メンバーがアニメーションを再生できる時間ではない
const SKIP_THRESHOLD_MS = 5500
if (elapsed >= SKIP_THRESHOLD_MS) {
  // アニメーションをスキップして直接 result へ
  setPhase("result")
  return
}
```

**問題の本質:**
- `elapsed` は「サーバーがスピンを開始してからの経過時間」を測定している
- メンバーが IN_SESSION を検出したのは `scheduleSpin()` が呼ばれた瞬間
- その時点ですでに `elapsed >= 5500ms` であれば、メンバーはアニメーションを一切表示しない
- しかしメンバー視点では「今初めてスピンを知った」状態

**具体的なタイムライン:**

```
T=0ms:    オーナーがスピン実行 → session.startedAt = 0
T=5600ms: メンバーのポーリングが IN_SESSION を検出
          elapsed = 5600 - 0 = 5600ms >= 5500ms
          → スキップ判定が発動（メンバーはアニメーションを見ていないのに）
```

---

## Scope

- `app/room/[code]/play/use-spin.ts` — `scheduleSpin()` のスキップ判定ロジック（L378-401）

---

## Proposed Fix

### Option A（推奨）: スキップ判定の基準時刻をメンバー検出時刻に変更

```typescript
// scheduleSpin() が呼ばれた時刻を記録（= メンバーが IN_SESSION を検出した時刻）
const detectedAtMs = Date.now()

setTimeout(() => {
  const now = Date.now()
  // elapsed をサーバー起点ではなく、メンバー検出起点に変更
  const memberElapsed = now - detectedAtMs  // ← 変更点
  const SKIP_THRESHOLD_MS = 500  // メンバー検出後に十分な時間がないかどうか

  if (memberElapsed >= SKIP_THRESHOLD_MS) {
    // ここには来ないはず（delay=0 なので即時実行）
    // ...
  }

  // serverElapsed に基づいてアニメーション残り時間を計算（従来通り）
  const serverElapsed = Math.max(0, adjustedNow - startMs)
  const cappedElapsed = Math.min(serverElapsed, 3000)
  const remaining = Math.max(500, 4500 - cappedElapsed)
  setSpinRemainingMs(remaining)
  setPhase("spinning")  // ← 必ずアニメーションを再生
}, delay)
```

### Option B（シンプル）: スキップ判定を削除し、常に短縮版アニメーションを再生

```typescript
// スキップ判定を削除
// elapsed に関わらず必ずアニメーションを再生する

const serverElapsed = Math.max(0, adjustedNow - startMs)
const cappedElapsed = Math.min(serverElapsed, 3000)
const remaining = Math.max(500, 4500 - cappedElapsed)  // 最低 0.5秒は再生
setSpinRemainingMs(remaining)
setPhase("spinning")
```

**Option B の利点:** シンプル。遅延検出時は 0.5 秒の短縮アニメーションで演出を保証。
**Option B の欠点:** 非常に遅いネットワーク（10秒以上）でも常にアニメーションが走る。

**推奨:** Option B。スキップ判定は「ユーザーが結果を待っている時間を短縮する」意図だったが、
演出を完全に奪う副作用が大きすぎる。500ms の最低保証アニメーションは十分な UX を提供できる。

---

## Acceptance Criteria

- [ ] PCオーナー + スマホメンバーで、スマホ側にルーレット回転演出が表示される
- [ ] `phase` が必ず `"waiting" → "preparing" → "spinning" → "result"` の順で遷移する
- [ ] ポーリング遅延が 5.5 秒以上でも演出がスキップされない
- [ ] 遅延検出時は短縮版アニメーション（≥0.5 秒）が再生される
- [ ] PC Chrome + iPhone Safari で確認
- [ ] オーナー側の演出は変更なし

## Priority
**P0** — 飲み会本番でメンバーが演出を見られない。コアUXのクリティカルパスが壊れている。

## Risk / Notes

- ISSUE-216 との関係: ISSUE-216 は「WinnerCard 表示されない」、このISSUEは「演出がスキップされる」。別問題
- `scheduleSpin()` の変更は member-side 同期全体に影響するため、regression テスト必須
- `clockOffsetMsRef` による NTP 補正は維持すること
- Option B を採用した場合、`SKIP_THRESHOLD_MS` 定数は削除してよい
