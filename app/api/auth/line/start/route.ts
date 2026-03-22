import { NextResponse } from "next/server"
import { randomBytes } from "crypto"

// GET /api/auth/line/start
// WHAT: LINE OAuth フローを開始する
// WHY:  LINE は Supabase の組み込みプロバイダーではないため、カスタム OAuth フローを実装する
// HOW:  1. state パラメーター生成（CSRF 対策）
//       2. state を httpOnly cookie に保存
//       3. LINE 認可 URL にリダイレクト
export async function GET() {
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
  return response
}
