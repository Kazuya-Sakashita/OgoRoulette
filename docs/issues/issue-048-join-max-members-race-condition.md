# issue-048: JOIN の maxMembers チェックが非アトミック — 同時参加でルームが定員超過する

## 概要

`POST /api/rooms/join` の定員チェック（`room._count.members >= room.maxMembers`）と、メンバー作成（`roomMember.create`）の間にトランザクションがない。複数ユーザーが同時参加するとチェックをすり抜け、定員を超えるメンバーが作成される。

## 背景

ルームには `maxMembers`（2〜20人）の上限がある。定員超過はルーレットのセグメントが多すぎて見えにくくなる問題に加え、ユーザーの期待（「満員なので入れない」）と実際の動作が乖離する。

## 問題点

`app/api/rooms/join/route.ts:58-60`：

```typescript
if (room._count.members >= room.maxMembers) {
  return NextResponse.json({ error: "ルームが満員です" }, { status: 400 })
}
```

このチェックの後、認証ユーザーは line 94、ゲストは line 137 で `roomMember.create` が実行される。

チェックと作成の間にロックがないため：
1. ユーザーAが `_count.members = 9`（maxMembers=10）を読む → チェック通過
2. ユーザーBが `_count.members = 9` を読む → チェック通過
3. ユーザーAが member を作成（count → 10）
4. ユーザーBが member を作成（count → 11）→ 定員超過

## 原因

ISSUE-043（色衝突）と同根。SELECT と INSERT の間に DB レベルのロックがない。

## ユーザー影響

- maxMembers = 10 に設定したルームに 11人以上入れる
- ルーレットのセグメントが20色を超えると `SEGMENT_COLORS[index % 12]` で重複色が発生（12色しかない）
- 「満員のためこれ以上参加できません」という期待が裏切られる
- オーナーが設定した人数制限が機能しない

## 技術的リスク

- 同時参加が集中するシナリオ：QRコードをグループチャットに送った直後に複数人がほぼ同時にスキャン
- maxMembers = 2 の場合（1対1の奢りルーレット）：2人を超えてしまうと片方が「余計なメンバー」になる

## 修正方針

JOIN をトランザクション化し、カウントチェックと作成をアトミックに実行する：

```typescript
const member = await prisma.$transaction(async (tx) => {
  const count = await tx.roomMember.count({ where: { roomId: room.id } })
  if (count >= room.maxMembers) {
    throw Object.assign(new Error("ルームが満員です"), { statusCode: 400 })
  }
  const colorIndex = count % SEGMENT_COLORS.length
  return tx.roomMember.create({
    data: {
      roomId: room.id,
      profileId: user?.id ?? null,
      isHost: false,
      color: SEGMENT_COLORS[colorIndex],
      nickname: trimmedName,
    },
  })
})
```

これにより ISSUE-043（色衝突）も同時に解決できる。

## タスク

- [x] 認証ユーザー参加フロー（line 63-108）をトランザクション化
- [x] ゲスト参加フロー（line 111-150）をトランザクション化
- [x] トランザクション内で `statusCode` 付きエラーを throw → catch で 400 を返す
- [ ] 10人が同時参加した場合のテストを追加（maxMembers = 5 などで確認）

## 受け入れ条件

- maxMembers = 5 のルームに 10人が同時参加しても、ちょうど 5人でメンバー作成が止まる
- 定員超過のユーザーは「ルームが満員です（400）」を受け取る
- ISSUE-043（色衝突）も同時に解消される

## 優先度

Medium（常時発生ではないが、QR 招待直後に集中発生する）

## デプロイブロッカー

No
