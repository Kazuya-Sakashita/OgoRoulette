import { NextResponse } from "next/server"
import { verifyResultToken } from "@/lib/result-token"

// GET /api/result-verify?token=HEX&session=SESSION_ID&winner=NAME
// ISSUE-276: result URL の HMAC 署名を検証する。
// サーバー側で再計算した HMAC と token を timingSafeEqual で比較し、
// { valid: true/false } を返す。このエンドポイントは public でよい。
// シークレットはサーバー側にのみ存在するため、token の偽造は不可能。
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token") ?? ""
  const sessionId = searchParams.get("session") ?? ""
  const winner = searchParams.get("winner") ?? ""

  if (!token || !sessionId || !winner) {
    return NextResponse.json({ valid: false })
  }

  const valid = verifyResultToken(token, sessionId, winner)
  return NextResponse.json({ valid })
}
