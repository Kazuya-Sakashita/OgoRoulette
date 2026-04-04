import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { validateReturnTo } from "@/lib/safe-redirect"

// GET /api/auth/line/start
// WHAT: LINE OAuth フローを開始する
// WHY:  LINE は Supabase の組み込みプロバイダーではないため、カスタム OAuth フローを実装する
// HOW:  1. state パラメーター生成（CSRF 対策）
//       2. state を httpOnly cookie に保存
//       3. LINE 認可 URL にリダイレクト
export async function GET(request: NextRequest) {
  // レート制限: 同一 IP から 10分間に 5回まで（LINE Admin API 呼び出しコスト削減）
  const ip = getClientIp(request.headers)
  const { allowed, resetAt } = checkRateLimit(ip, "line-start", 5, 10 * 60_000)
  if (!allowed) {
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
    const errorUrl = new URL(`${origin}/auth/error`)
    errorUrl.searchParams.set("reason", "rate_limit")
    errorUrl.searchParams.set("retry_after", String(retryAfter))
    return NextResponse.redirect(errorUrl.toString())
  }
  const state = randomBytes(16).toString("hex")

  const lineAuthUrl = new URL("https://access.line.me/oauth2/v2.1/authorize")
  lineAuthUrl.searchParams.set("response_type", "code")
  lineAuthUrl.searchParams.set("client_id", process.env.LINE_CHANNEL_ID!)
  lineAuthUrl.searchParams.set("redirect_uri", process.env.LINE_CALLBACK_URL!)
  lineAuthUrl.searchParams.set("state", state)
  lineAuthUrl.searchParams.set("scope", "profile openid")

  const response = NextResponse.redirect(lineAuthUrl.toString())
  response.cookies.set("line_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10分
    path: "/",
  })

  // ISSUE-044: returnTo をクッキーに保存してコールバックで復元する
  const returnTo = validateReturnTo(request.nextUrl.searchParams.get("returnTo"))
  if (returnTo !== "/home") {
    response.cookies.set("line_oauth_return_to", returnTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    })
  }

  return response
}
