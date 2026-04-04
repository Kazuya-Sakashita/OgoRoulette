# ISSUE-201: Vercel Serverless でレートリミットが無効（globalThis 非共有）

## ステータス
🔴 未着手

## 優先度
**Critical**

## カテゴリ
Security / Backend

## 概要
`lib/rate-limit.ts` が `globalThis` を使ってメモリ内 Map でレートリミット状態を管理している。Vercel Serverless Functions は並行リクエストを異なるインスタンスで処理するため、インスタンス間で Map が共有されず、レートリミットが実質無効になる。

## 問題のコード

```typescript
// lib/rate-limit.ts:11-19
const globalForRateLimit = globalThis as unknown as {
  rateLimitStore: Map<string, RateLimitEntry> | undefined
}
const store: Map<string, RateLimitEntry> =
  globalForRateLimit.rateLimitStore ?? new Map()
globalForRateLimit.rateLimitStore = store
```

`globalThis` はプロセス内では共有されるが、Vercel が複数インスタンスをスポーンすると各インスタンスが独立した Map を持つ。同一 IP から並行リクエストを送ると、異なるインスタンスに振り分けられ、各インスタンスのカウンターが独立してリセットされる。

## 影響
- `/api/rooms/spin` への高頻度リクエストが通過し、スピン操作が不正実行できる
- その他レートリミット対象エンドポイント全体（招待コード生成・ルーム参加等）
- Supabase への不正な書き込みが増加し、コストが上昇する可能性

## 修正方針

### Option A（推奨）: Vercel KV 採用
```typescript
import { kv } from "@vercel/kv"

export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now()
  const windowKey = `rl:${key}:${Math.floor(now / windowMs)}`
  const count = await kv.incr(windowKey)
  if (count === 1) await kv.expire(windowKey, Math.ceil(windowMs / 1000))
  return count <= limit
}
```

### Option B: Upstash Redis（Vercel KV の代替）
`@upstash/ratelimit` + `@upstash/redis` を使用する。

### Option C（暫定）: リクエスト元 IP ヘッダー検証強化
Vercel の `x-forwarded-for` を信頼し、IP ごとのウィンドウを厳格化する（根本解決ではない）。

## 影響ファイル
- `lib/rate-limit.ts` — 実装全体の置き換え
- `app/api/rooms/join/route.ts` — `checkRateLimit` 呼び出し箇所（async に変更）
- `app/api/rooms/[code]/spin/route.ts` — 同上

## 参照
- ISSUE-200（第4回評価）で BUG-01 として特定
