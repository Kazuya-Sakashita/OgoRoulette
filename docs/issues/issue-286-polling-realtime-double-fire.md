# ISSUE-286: Medium — polling + Realtime の二重発火でフリッカーが発生する

## ステータス
✅ 修正済み（2026-04-18）— isFetchingRef ゲートで並行 fetchRoom 呼び出しを防止

## 優先度
**Medium / UX / パフォーマンス**

## カテゴリ
Bug / UX / Realtime / Polling / Flicker

---

## 問題

`use-room-sync.ts` は Supabase Realtime の `postgres_changes` / Broadcast と、
インターバルポーリングの両方が有効になっている。
スピン開始時に Broadcast → `fetchRoom()` と polling → `fetchRoom()` がほぼ同時に実行され、
ルームデータが 2 回更新される。

```typescript
// app/room/[code]/play/use-room-sync.ts（現状）
.on("broadcast", { event: "spin_start" }, () => { fetchRoom() })  // Broadcast 受信
.on("postgres_changes", ..., () => { fetchRoom() })                // DB 変更検知

// + インターバルポーリング
setInterval(() => fetchRoom(), IN_SESSION ? 2000 : 10000)
```

Broadcast（~100ms）と postgres_changes（~300-800ms）と polling（2000ms）が
別々のタイミングで `fetchRoom()` を呼ぶため、React の state 更新が 3 回起きる。

---

## なぜ危険か

- 画面がちらつく（UI フリッカー）
- スピンアニメーション開始と `setRoom()` 呼び出しが競合する
- ISSUE-279（prevSessionIdRef）・ISSUE-282（spinScheduledRef）のバグを誘発する
- 不要な Prisma クエリが 3 倍発生する（DB 負荷）

---

## 発生条件

- スピン開始時（全員の画面で発生）
- ネットワーク遅延が小さい環境では Broadcast と postgres_changes がほぼ同時に届く

---

## 影響範囲

- 全参加者の画面
- スピン開始直後の 1-2 秒間

---

## 推定原因

Broadcast（ISSUE-221 で追加）は postgres_changes のフォールバックとして追加したが、
実際には postgres_changes も生きているため二重発火が常時発生している。

---

## 修正方針

### 案A: debounce で fetchRoom() を集約する（推奨）

```typescript
const debouncedFetchRoom = useMemo(
  () => debounce(fetchRoom, 200),  // 200ms 以内の重複呼び出しを 1 回に集約
  [fetchRoom]
)

.on("broadcast", { event: "spin_start" }, () => { debouncedFetchRoom() })
.on("postgres_changes", ..., () => { debouncedFetchRoom() })
```

### 案B: Broadcast 受信後は postgres_changes をスキップするフラグを立てる

```typescript
let broadcastReceived = false
.on("broadcast", { event: "spin_start" }, () => {
  broadcastReceived = true
  fetchRoom()
  setTimeout(() => { broadcastReceived = false }, 1000)
})
.on("postgres_changes", ..., () => {
  if (!broadcastReceived) fetchRoom()  // Broadcast が先に来た場合はスキップ
})
```

### 案C: polling を停止し Realtime のみに依存する

ネットワーク断対策のフォールバックがなくなるため、visibilitychange ハンドラを強化する必要がある。

---

## 受け入れ条件

- [ ] スピン開始時に `fetchRoom()` が 2 回以上呼ばれないこと（または debounce で 1 回に集約されること）
- [ ] スピンアニメーションのフリッカーが解消されること
- [ ] Realtime 切断時はポーリングでフォールバックできること

## 関連ファイル

- `app/room/[code]/play/use-room-sync.ts`

## 関連 ISSUE

- ISSUE-279: prevSessionIdRef バグ（二重発火が引き金）
- ISSUE-282: spinScheduledRef 競合（二重発火が引き金）
- ISSUE-221: Broadcast 追加（二重発火の起源）
