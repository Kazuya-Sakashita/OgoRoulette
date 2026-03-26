# ISSUE-024: ゲスト二重参加（ダブル送信）でルーレットに同一ユーザーが複数追加される

## 概要

ゲストユーザーが「参加する」ボタンを素早く2回タップ（または遅延ネットワーク下で再タップ）した場合、同じ nickname の RoomMember が2件作成され、ルーレットホイールに同じ人が2回表示される。

## 背景

`POST /api/rooms/join` のゲストパス（line 126-134）は名前の重複チェックを行わない。Postgres の `@@unique([roomId, profileId])` はゲスト（profileId=null）に対して NULL 同士を別値として扱うため、DB レベルの保護が効かない。`joining` state による client-side ロックが存在するが、ネットワーク遅延下では2つのリクエストが同時に DB に到達する競合が発生する。

## 問題点

- 現在何が起きているか: 同一 nickname のゲストが複数の `room_members` レコードとして登録される
- ユーザー影響: ルーレットホイールに同一人物が2枠表示される。パーティーで「不正」と感じるネガティブ体験
- 技術的影響: member count が誤カウントされ、割り勘計算やセッション記録が狂う

## 原因

```typescript
// app/api/rooms/join/route.ts lines 119-134
const trimmedGuestName = (guestName as string).trim()
// ← nickname の重複チェックなし
await prisma.roomMember.create({
  data: {
    roomId: room.id,
    profileId: null,
    ...
    nickname: trimmedGuestName
  }
})
```

クライアント側 `joining` state は同一ブラウザの連続タップは防ぐが、ネットワーク遅延で2リクエストが重なると両方が到達する。

## 修正方針

`POST /api/rooms/join` のゲストパスで、同一 nickname の RoomMember が既に存在する場合は作成をスキップして success を返す:

```typescript
const duplicateMember = room.members.find(
  m => !m.isHost && m.profileId === null && m.nickname === trimmedGuestName
)
if (duplicateMember) {
  return NextResponse.json({
    success: true,
    room: { id: room.id, inviteCode: room.inviteCode, name: room.name }
  })
}
```

## タスク

- [ ] `POST /api/rooms/join` のゲストパスに nickname 重複チェックを追加
- [ ] 動作確認: 同一名前で2回 join → メンバーが1件のみ作成されること
- [ ] 回帰確認: 異なる名前のゲストが複数参加できること

## 受け入れ条件

- 同一名前で素早く2回 join しても RoomMember が1件のみ作成される
- 異なる名前のゲストは複数参加できる
- 既存の join フローに副作用がない

## 優先度

High

## デプロイブロッカー

Yes — パーティーで最も起きやすい操作ミスであり、ルーレット結果の公平性を損なう
