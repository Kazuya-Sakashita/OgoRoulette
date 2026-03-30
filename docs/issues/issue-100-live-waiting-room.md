# issue-100: ライブ待機室 — 参加者リアルタイム表示 + 参加トースト

## 優先度
High (Viral +3)

## デプロイブロッカー
No

---

## 概要

ルームロビーページ（`/room/[code]`）での参加者待機体験を改善する。

現状:
- 3秒ごとのポーリングで参加者数を更新
- 新しいメンバーが入ってきても「いつの間にか増えていた」状態

改善後:
- Supabase Realtime でほぼ即座に参加を検出
- 「〇〇さんが参加しました 🎉」トーストを3秒間表示
- 「参加を待っています…」の体験が「リアルタイムで盛り上がってる」体験に変わる

---

## 実装内容

### Supabase Realtime 購読（`app/room/[code]/page.tsx`）

play ページと同じパターンで `Room` テーブルを購読:

```typescript
const channel = supabase
  .channel(`room-lobby:${code}`)
  .on("postgres_changes", { event: "*", schema: "public", table: "Room", filter: `invite_code=eq.${code.toUpperCase()}` }, () => { fetchRoom() })
  .subscribe()
```

ポーリングは5秒フォールバックとして残す（3秒 → 5秒に延長してRealtimeを主系に）。

### 新規参加者検出

```typescript
const prevMemberIdsRef = useRef<Set<string>>(new Set())

// fetchRoom 内でメンバー差分を検出
const newMembers = data.members.filter(m => !prevMemberIdsRef.current.has(m.id))
if (newMembers.length > 0 && prevMemberIdsRef.current.size > 0) {
  setJoinToast(`${name}さんが参加しました 🎉`)
  setTimeout(() => setJoinToast(null), 3000)
}
prevMemberIdsRef.current = new Set(data.members.map(m => m.id))
```

### トースト UI

`fixed top-4` の小さいピル型バナー（3秒で自動消去）。

---

## 受け入れ条件

- 新しいメンバーが参加したとき、既存参加者の画面に「〇〇さんが参加しました 🎉」が表示される
- トーストは3秒後に自動消去
- Supabase Realtime が動作しない環境ではポーリング（5秒）がフォールバック
