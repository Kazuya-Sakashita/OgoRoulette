# ISSUE-221: 設計改善(P1) — スピン開始を Broadcast で即時通知しメンバー同期遅延を解消

## ステータス
✅ 完了 — 2026-04-07

## 優先度
**P1 / High** — ISSUE-220 で演出スキップは解消済み。残る同期遅延（最大800ms）を根本改善

## カテゴリ
Architecture / Multiplayer / Realtime / UX

## 対象スコア
HEART-Happiness: +1 / G-STACK信頼性: +1 / 感情: +0.5

---

## Summary

現在、メンバーへのスピン開始通知は Supabase `postgres_changes`（DB レプリケーション経由）で行っている。
このパスには 200-800ms の遅延があり、Supabase 高負荷時は 1500ms 超になることがある。
`Broadcast`（メッセージブローカー直送、20-100ms）に切り替えることで
メンバーの検知を ~600ms 高速化し、全員が `spinStartedAt` に合わせて同時スタートできる確率を高める。

合わせて `visibilitychange` イベントを監視し、スマホでタブがバックグラウンドになった場合でも
復帰時に即座に再取得して演出を受け取れるようにする。

---

## Background

### Kano 評価: **Basic（当然品質）**

飲み会で全員が同じ場にいる。1秒以上の演出ズレは「あの人だけ先に結果わかってた」という体験劣化に直結。
ISSUE-220（スキップ判定削除）で「演出が出ない」は解消済みだが、同期精度の改善が残課題。

### 現状の同期フロー

```
T=0ms      オーナーが SPIN → POST /api/spin
T+50ms     サーバーが spinStartedAt = serverNow + 3000ms を DB 保存
T+50ms     Supabase WAL → Realtime レプリケーション開始
T+300-800ms  メンバーの postgres_changes が変更を受信 → fetchRoom() → scheduleSpin()
T+3000ms   全員が spinStartedAt でアニメーション開始（設計上）
```

メンバーの検知ウィンドウ: 3000ms - 800ms = **2200ms** がギリギリ。
高負荷時は 3000ms - 1500ms = 1500ms しか余裕がない。

---

## Current Behavior

- `postgres_changes` サブスクリプション経由でスピン開始を検知（200-800ms 遅延）
- スマホタブがバックグラウンドになると `setTimeout` が throttle され、ポーリングが機能しない
- 同期が遅れたメンバーは短縮アニメーションでズレが体感できる

---

## Expected Behavior

```
T=0ms      オーナーが SPIN → POST /api/spin
T+50ms     サーバーが spinStartedAt を DB 保存（既存）
T+100ms    オーナーが API レスポンス受信と同時に Broadcast 送信（新規）
T+120-200ms  メンバーが Broadcast 受信 → fetchRoom() → scheduleSpin()  ← 600ms 高速化
T+3000ms   全員が spinStartedAt でアニメーション開始（より確実に同期）
```

- Broadcast でメンバーの検知ウィンドウが 2200ms → **2850ms** に拡大
- `postgres_changes` は引き続きバックアップとして機能（二重安全網）
- スマホタブ復帰時も `visibilitychange` で即再取得

---

## Scope

- `app/room/[code]/play/use-room-sync.ts` — Broadcast リスナー + visibilitychange + channelRef 公開
- `app/room/[code]/play/use-spin.ts` — channelRef 受け取り + オーナーが API 成功後に Broadcast 送信
- `app/room/[code]/play/page.tsx` — channelRef を useRoomSync → useSpin に橋渡し

---

## Proposed Fix

### use-room-sync.ts

```typescript
// 既存チャンネルに broadcast リスナーを追加
const channel = supabase
  .channel(`room-play:${code}`)
  .on("postgres_changes", { ... }, () => fetchRoom())   // 既存
  .on("broadcast", { event: "spin_start" }, () => {     // 追加
    fetchRoom()
  })
  .subscribe(...)
channelRef.current = channel

// visibilitychange で復帰時即再取得
const handleVisibilityChange = () => { if (!document.hidden) fetchRoom() }
document.addEventListener("visibilitychange", handleVisibilityChange)
// cleanup に removeEventListener 追加
```

### use-spin.ts

```typescript
// handleSpin() の API 成功後
spinSyncChannelRef.current?.send({
  type: "broadcast",
  event: "spin_start",
  payload: { startedAt: data.spinStartedAt },
})
```

---

## Acceptance Criteria

- [ ] オーナーがスピンしたとき、Broadcast `spin_start` が WebSocket フレームに流れる
- [ ] PC/スマホメンバーが Broadcast 受信後に即 `fetchRoom()` を呼ぶ
- [ ] `postgres_changes` サブスクリプションが引き続き機能する（バックアップ）
- [ ] スマホでタブをバックグラウンドにした後に復帰すると `fetchRoom()` が発火する
- [ ] オーナー側の演出・タイミングは変更なし
- [ ] TypeScript 型エラーなし

## Priority
**P1** — ISSUE-220 の補完。ISSUE-220 は「演出が出ない」を修正、このISSUEは「演出が遅れる」を修正。

## Risk / Notes

- Broadcast 送信は `?.send()` でオプショナル呼び出しのため、チャンネルが null でも安全
- `postgres_changes` は残すため、Broadcast が届かなくても既存の動作が維持される
- 変更量: 3ファイル / 約22行追加
- 既存の `emoji_reaction` Broadcast（`room-play-overlays.tsx`）と同じパターン
