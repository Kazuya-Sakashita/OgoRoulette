// レートリミット
// - Vercel KV（KV_REST_API_URL + KV_REST_API_TOKEN が設定されている場合）: サーバー横断で有効
// - 未設定の場合: インメモリフォールバック（ローカル開発用）

// ─── インメモリストア（フォールバック用）───────────────────

interface RateLimitEntry {
  count: number
  resetAt: number
}

const globalForRateLimit = globalThis as unknown as {
  rateLimitStore: Map<string, RateLimitEntry> | undefined
}

const store: Map<string, RateLimitEntry> =
  globalForRateLimit.rateLimitStore ?? new Map()

if (!globalForRateLimit.rateLimitStore) {
  globalForRateLimit.rateLimitStore = store
}

const STORE_MAX_SIZE = 10_000

function evictExpired(): void {
  if (store.size < STORE_MAX_SIZE) return
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}

function checkRateLimitMemory(
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

// ─── Vercel KV バックエンド ──────────────────────────────

const KV_CONFIGURED = !!(
  process.env.KV_REST_API_URL &&
  process.env.KV_REST_API_TOKEN
)

async function checkRateLimitKV(
  ip: string,
  endpoint: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const { kv } = await import("@vercel/kv")
  const windowStart = Math.floor(Date.now() / windowMs)
  const resetAt = (windowStart + 1) * windowMs
  const kvKey = `rl:${endpoint}:${ip}:${windowStart}`

  const count = await kv.incr(kvKey)
  if (count === 1) {
    // 初回: TTL を設定（windowMs + 5秒バッファ）
    await kv.expire(kvKey, Math.ceil(windowMs / 1000) + 5)
  }

  const allowed = count <= limit
  const remaining = Math.max(0, limit - count)
  return { allowed, remaining, resetAt }
}

// ─── 公開 API ──────────────────────────────────────────────

/**
 * IPアドレスとエンドポイント名をキーにレート制限を確認する。
 * Vercel KV が設定されている場合はサーバー横断で機能する。
 *
 * @param ip       クライアント IP
 * @param endpoint ルートを識別する任意の文字列（例: "join", "spin"）
 * @param limit    ウィンドウ内に許可するリクエスト数
 * @param windowMs ウィンドウの長さ（ミリ秒）
 * @returns allowed: true なら通過、false なら 429 を返すべき
 */
export async function checkRateLimit(
  ip: string,
  endpoint: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  if (KV_CONFIGURED) {
    try {
      return await checkRateLimitKV(ip, endpoint, limit, windowMs)
    } catch (err) {
      // KV が一時的に利用不可の場合はメモリフォールバック
      console.warn("[rate-limit] KV unavailable, falling back to memory:", err)
    }
  }
  return checkRateLimitMemory(ip, endpoint, limit, windowMs)
}

/** NextRequest の headers から最善の IP を取得する */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  )
}
