/**
 * 認証ヘルパー — Google / X (Twitter) / LINE の OAuth 開始処理を一元化
 *
 * Supabase ネイティブプロバイダー（Google / X）と
 * カスタムプロバイダー（LINE）の違いを吸収する。
 */

import { createClient } from "@/lib/supabase/client"

/** Supabase ネイティブ OAuth で使用できるプロバイダー */
export type SupabaseOAuthProvider = "google" | "x"

/**
 * Supabase OAuth の redirectTo URL を組み立てる。
 * returnTo が指定された場合、callback 後に元のパスへ戻るための `?next=` を付与する。
 */
export function buildOAuthRedirectUrl(returnTo?: string | null): string {
  // 開発環境: NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL を優先（Supabase ダッシュボードの
  // Redirect URLs ホワイトリストに localhost を追加しなくて済む）
  if (process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL) {
    return process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
  }

  const base = `${window.location.origin}/auth/callback`
  const safeNext = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
    ? returnTo
    : null

  return safeNext ? `${base}?next=${encodeURIComponent(safeNext)}` : base
}

/**
 * LINE OAuth 開始 URL を組み立てて遷移する。
 * returnTo が指定された場合、LINE start ルートに `?returnTo=` を付与する。
 */
export function startLineAuth(returnTo?: string | null): void {
  const safeReturn = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
    ? returnTo
    : null
  const url = safeReturn
    ? `/api/auth/line/start?returnTo=${encodeURIComponent(safeReturn)}`
    : "/api/auth/line/start"
  window.location.href = url
}

/**
 * Supabase ネイティブ OAuth（Google / X）を開始する。
 * エラーは Error として throw する。
 */
export async function startSupabaseOAuth(
  provider: SupabaseOAuthProvider,
  returnTo?: string | null
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: buildOAuthRedirectUrl(returnTo),
    },
  })
  if (error) throw error
}
