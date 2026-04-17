# ISSUE-251: Security Re-audit(Medium) — GET /api/rooms/[code]/ranking にレート制限なし（✅ 修正済み）

## ステータス
🔲 TODO

## 優先度
**Medium / セキュリティ**

## カテゴリ
Security / Rate Limiting / DoS

---

## 概要

`GET /api/rooms/[code]/ranking` が認証・レート制限なしで公開されており、
当選者名・回数のランキングを誰でも無制限に取得できる。
ISSUE-250 と組み合わせることでルームの全履歴を効率的に収集できる。

---

## 問題

```typescript
// app/api/rooms/[code]/ranking/route.ts
export async function GET(
  _request: Request,  // ← request を参照していない（IP 取得不可）
  { params }: ...
) {
  // ← レート制限なし
  // ← 認証チェックなし
  const winners = await prisma.participant.findMany({
    where: { isWinner: true, session: { roomId: room.id, status: "COMPLETED" } },
    select: { name: true },
  })
  return NextResponse.json({ ranking })
}
```

---

## 悪用シナリオ

- ISSUE-250 のブルートフォースと組み合わせて全ルームの当選履歴を収集
- 大量リクエストで Prisma/Supabase コネクション圧迫
- DB 読み取りコスト増大（全 COMPLETED セッションを集計するクエリ）

---

## 対応方針

```typescript
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

export async function GET(
  request: Request,  // _request → request に変更
  { params }: ...
) {
  const ip = getClientIp(request.headers)
  const { allowed } = await checkRateLimit(ip, "room-ranking", 20, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }
  // 既存処理...
}
```

---

## 完了条件

- [ ] レート制限を追加（20回/分）
- [ ] `_request` パラメータを `request` に変更して IP 取得に使用
- [ ] ルームプレイ画面のランキング表示が正常に機能することを確認

## 関連ファイル
- `app/api/rooms/[code]/ranking/route.ts`
- `lib/rate-limit.ts`
