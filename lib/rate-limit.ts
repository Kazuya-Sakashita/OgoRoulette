// シンプルなインメモリ・レート制限
// NOTE: Vercel Serverless の複数インスタンス間では共有されない。
//       スケールアップ時は @upstash/ratelimit + Upstash Redis への移行を推奨。

interface RateLimitEntry {
  count: number
  resetAt: number
}

// グローバルで Map を保持（Prisma と同じパターン）
const globalForRateLimit = globalThis as unknown as {
  rateLimitStore: Map<string, RateLimitEntry> | undefined
}

const store: Map<string, RateLimitEntry> =
  globalForRateLimit.rateLimitStore ?? new Map()

if (process.env.NODE_ENV !== "production") {
  globalForRateLimit.rateLimitStore = store
}

// 古いエントリを定期的に削除（メモリリーク防止）
// 実際の削除は checkRateLimit 呼び出し時に確認し、10000エントリ超えで一括クリア
const STORE_MAX_SIZE = 10_000

function evictExpired(): void {
  if (store.size < STORE_MAX_SIZE) return
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}

/**
 * IPアドレスとエンドポイント名をキーにレート制限を確認する。
 *
 * @param ip       クライアント IP（`x-forwarded-for` または `x-real-ip` の値）
 * @param endpoint ルートを識別する任意の文字列（例: "join", "line-start"）
 * @param limit    ウィンドウ内に許可するリクエスト数
 * @param windowMs ウィンドウの長さ（ミリ秒）
 * @returns allowed: true なら通過、false なら 429 を返すべき
 */
export function checkRateLimit(
  ip: string,
  endpoint: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  evictExpired()

  const key = `${endpoint}:${ip}`
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs
    store.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

/** NextRequest の headers から最善の IP を取得する */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  )
}
