# issue-043: JOIN 同時実行で複数メンバーが同一色になる

## 概要

複数ユーザーが同時に同じルームに参加した場合、色の割り当てが衝突し、複数メンバーが同一色になる。ルーレットのセグメントが視覚的に区別不能になる。

## 背景

ルーレットの各セグメントはメンバーごとに異なる色が割り当てられる。色は `SEGMENT_COLORS[memberCount % length]` で決定される。この計算がアトミックでないため、同時参加でインデックスが衝突する。

## 問題点

`app/api/rooms/join/route.ts:92`（認証ユーザー）と `:135`（ゲスト）の両方で以下のコードが使われる：

```typescript
const colorIndex = room._count.members % SEGMENT_COLORS.length
```

この `room._count.members` は SELECT 時点のスナップショット。
2人が同時にルームを取得すると同じカウント（例: 3）を読み込み、
両者ともに `SEGMENT_COLORS[3]` を使ってメンバーが作成される。

## 原因

- `_count.members` の読み取りから `roomMember.create` まで DB ロックがない
- SELECT → INSERT の間に別リクエストが INSERT を完了できる
- カラー衝突を防ぐ UNIQUE 制約もない

## ユーザー影響

- ルーレットに同色セグメントが2つ現れ、誰が当たったか判別不能
- 複数人が同時入室するシナリオ（QR コードを同時スキャン）で確実に発生
- グループ機能でプリセットメンバーが多い場合も同様に発生しうる

## 技術的リスク

- `SEGMENT_COLORS` は 12色。12人以上のルームでは必然的に色が重複するが、それとは別に並行実行による重複が発生する
- 現状ルーレット UI に color の uniqueness に関するフォールバック表示がない

## 修正方針

**案A（推奨）**: `roomMember.create` をトランザクションに移し、現在の member 数をトランザクション内でカウントして色を決定する

```typescript
await prisma.$transaction(async (tx) => {
  const count = await tx.roomMember.count({ where: { roomId: room.id } })
  const colorIndex = count % SEGMENT_COLORS.length
  return tx.roomMember.create({ data: { ..., color: SEGMENT_COLORS[colorIndex] } })
})
```

**案B**: 色を単純に順番で割り当てず、既存メンバーが使っていない色を選択するロジックに変更する

## タスク

- [x] `app/api/rooms/join/route.ts` 認証ユーザー分岐 (line 91-103) をトランザクション化
- [x] 同ファイルゲスト分岐 (line 135-145) も同様に修正
- [ ] 同時10リクエストの並行テストで色衝突がないことを確認

## 受け入れ条件

- 10人が同時参加してもルーム内に同一色メンバーが存在しない
- 副作用としてパフォーマンス劣化がない（トランザクションの追加は軽微）

## 優先度

High

## デプロイブロッカー

No（既存ルームへの影響はないが、本番でよく発生するシナリオ）
