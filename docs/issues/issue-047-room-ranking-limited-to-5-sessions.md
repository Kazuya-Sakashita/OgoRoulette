# issue-047: roomRanking が直近5セッションのみを参照し、長期利用ルームで奢り回数が過少表示される

## 概要

`GET /api/rooms/[code]` のセッション取得に `take: 5` の上限がある。WinnerCard の「奢りランキング」および `treatCount`（通算奢り回数）はこの5件のデータのみで算出されるため、6回以上スピンしたルームで正確な履歴が反映されない。

## 背景

常設グループ（`isPersistent: true`）は有効期限がなく、繰り返し使用されることを前提に設計されている。スピン回数が増えるほど `treatCount` と `ranking` が不正確になり、ゲーミフィケーション（「通算○回奢り」「🥇🥈🥉ランキング」）が機能しなくなる。

## 問題点

`app/api/rooms/[code]/route.ts:29`：

```typescript
sessions: {
  orderBy: { createdAt: 'desc' },
  take: 5,                           // ← 最新5件のみ
  include: {
    participants: {
      where: { isWinner: true },
      take: 1,
      select: { name: true, isWinner: true, color: true, orderIndex: true },
    },
  },
},
```

`app/room/[code]/play/page.tsx:189-199`：

```typescript
const roomRanking = useMemo(() => {
  if (!room?.sessions?.length) return undefined
  const counts: Record<string, number> = {}
  for (const session of room.sessions) {   // sessions = 最大5件
    const wp = session.participants?.find((p) => p.isWinner)
    if (wp) counts[wp.name] = (counts[wp.name] ?? 0) + 1
  }
  ...
}, [room?.sessions])
```

`treatCount` はこの `roomRanking` から取得される（`play/page.tsx:713`）。

## 原因

パフォーマンスのために `take: 5` でセッション数を制限したが、ランキング計算に同じデータを使っているため、長期利用で精度が劣化する。

## ユーザー影響

| スピン回数 | 影響 |
|-----------|------|
| 1〜5回 | 正確 |
| 6回以上 | 最古のスピン結果が「なかったこと」になる |
| 10回以上 | 常に「最新5回の奢り回数」しか表示されない |
| 常設グループで長期運用 | ランキングが毎回リセットされたように見える |

例：田中さんが10回中6回奢ったルームで、最近5回しか参照されない場合、「3回奢り」と表示される可能性がある。

## 技術的リスク

- `take: 5` を外すとレスポンスサイズと DB クエリコストが線形に増加する
- 1000回スピンしたルームでは 1000 件のセッション + 各セッションの参加者データが返る
- ルームのレスポンスが巨大になり、ポーリング（10秒ごと）のネットワーク負荷が増加する

## 修正方針

### 案A（推奨）: ランキング専用の軽量エンドポイントを追加

ルームのポーリングレスポンスとランキングデータを分離する。

```typescript
// GET /api/rooms/[code]/ranking
// 全セッションの winner 集計のみ返す
const ranking = await prisma.sessionParticipant.groupBy({
  by: ["name"],
  where: { session: { roomId: room.id }, isWinner: true },
  _count: { _all: true },
  orderBy: { _count: { _all: "desc" } },
  take: 10,  // 上位10名のみ
})
```

プレイページでは初回ロード時とスピン完了後にこのエンドポイントを呼ぶ。

### 案B: セッション上限を大きくする（暫定対応）

`take: 5` を `take: 100` に増やす。100回未満のルームでは正確だが根本解決ではない。

### 案C: Profile.totalTreated を使う（認証ユーザーのみ）

認証ユーザーは `profile.totalTreated` が更新されており（`spin/route.ts:209-217`）、これを使えばルーム横断の正確な集計が可能。ただしゲストには使えない。

## タスク

- [ ] `GET /api/rooms/[code]/ranking` エンドポイントを新規作成（案A）
- [ ] `app/room/[code]/play/page.tsx` の `roomRanking` 計算をランキング API から取得するよう変更
- [ ] WinnerCard の `treatCount` もランキング API から取得
- [ ] 案A が難しければ案B を暫定適用

## 受け入れ条件

- 10回以上スピンしたルームで奢り回数が正確に表示される
- WinnerCard の「通算N回奢り」が全スピン履歴から算出される
- ポーリングのレスポンスサイズが増加しない

## 優先度

Medium

## デプロイブロッカー

No（常設グループを長期利用した場合に顕在化）
