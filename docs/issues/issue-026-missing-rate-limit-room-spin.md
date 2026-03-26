# ISSUE-026: POST /api/rooms・spin エンドポイントに rate limit がなく DoS/乱用リスクあり

## 概要

`POST /api/rooms`（ルーム作成）と `POST /api/rooms/[code]/spin`（スピン）に rate limiting が実装されていない。`POST /api/rooms/join` には 10回/分 の制限があるが、より重いDBオペレーションを行う2つのエンドポイントが無制限。

## 背景

`app/api/rooms/join/route.ts` は `checkRateLimit` を使っているが、`app/api/rooms/route.ts` と `app/api/rooms/[code]/spin/route.ts` には rate limit の記述がない。

## 問題点

- 現在何が起きているか:
  - `POST /api/rooms`: 1秒に何千もルームを作成可能 → DB がパンク
  - `POST /api/rooms/[code]/spin`: 連続スピンリクエストで Prisma トランザクションが過負荷、ルームステータスが壊れる可能性
- ユーザー影響: サービス全体が落ちると全ユーザーがルーレットできない
- 技術的影響: Supabase の無料枠 connection limit に達してサービス停止

## 原因

開発優先でレート制限の追加が漏れた。`lib/rate-limit.ts` に実装済みのパターンがあるにもかかわらず適用されていない。

## 修正方針

`app/api/rooms/join/route.ts` のパターンをそのまま流用する:

```typescript
// POST /api/rooms に追加
const ip = getClientIp(request.headers)
const { allowed, resetAt } = checkRateLimit(ip, "room-create", 5, 60_000) // 5件/分
if (!allowed) {
  return NextResponse.json(
    { error: "リクエストが多すぎます。しばらくしてからお試しください。" },
    { status: 429, headers: { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) } }
  )
}
```

```typescript
// POST /api/rooms/[code]/spin に追加
const { allowed, resetAt } = checkRateLimit(ip, "spin", 10, 60_000) // 10件/分
```

## タスク

- [ ] `app/api/rooms/route.ts` POST に rate limit 追加（5件/分）
- [ ] `app/api/rooms/[code]/spin/route.ts` POST に rate limit 追加（10件/分）
- [ ] 動作確認: 制限超過時に 429 が返ること
- [ ] 回帰確認: 通常利用で 429 が出ないこと

## 受け入れ条件

- 連続ルーム作成・スピンに対して 429 が返る
- 通常のパーティー利用（1-2スピン/分）で制限に当たらない
- 既存テストが通る

## 優先度

Critical

## デプロイブロッカー

Yes — DB リソース枯渇によるサービス全停止リスク
