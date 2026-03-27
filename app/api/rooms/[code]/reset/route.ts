import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { verifyGuestToken } from "@/lib/guest-token"

// POST /api/rooms/[code]/reset
// WHAT: ルームを WAITING にリセットして再スピンを可能にする
// WHY:  同じメンバーで「もう一回！」の要求に応えるため
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const room = await prisma.room.findUnique({
      where: { inviteCode: code.toUpperCase() },
      select: { id: true, status: true, expiresAt: true, ownerId: true },
    })

    if (!room) {
      return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 })
    }

    if (room.expiresAt && room.expiresAt < new Date()) {
      return NextResponse.json({ error: "ルームが期限切れです" }, { status: 403 })
    }

    // 認証ルームへの未認証アクセスは拒否
    if (room.ownerId && !user) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 })
    }

    if (user) {
      // 認証ユーザーはオーナー検証必須
      const ownerMembership = await prisma.roomMember.findFirst({
        where: { roomId: room.id, isHost: true, profileId: user.id },
        select: { id: true },
      })
      if (!ownerMembership) {
        return NextResponse.json({ error: "オーナーのみリセットできます" }, { status: 403 })
      }
    } else {
      // ゲストルーム: X-Guest-Host-Token を HMAC で検証
      // sendBeacon はカスタムヘッダーを送れないため、body の JSON も受け入れる (ISSUE-045)
      let guestToken = request.headers.get("X-Guest-Host-Token")
      if (!guestToken) {
        try {
          const body = await request.json()
          guestToken = body?.guestToken ?? null
        } catch {
          // body が空 or 非 JSON (auth user の sendBeacon) — 無視
        }
      }
      if (!guestToken) {
        return NextResponse.json({ error: "オーナーのみリセットできます" }, { status: 403 })
      }
      const hostMember = await prisma.roomMember.findFirst({
        where: { roomId: room.id, isHost: true, profileId: null },
        select: { id: true },
      })
      if (!hostMember || !verifyGuestToken(guestToken, hostMember.id, code.toUpperCase())) {
        return NextResponse.json({ error: "オーナーのみリセットできます" }, { status: 403 })
      }
    }

    // ISSUE-005: トランザクションで room を WAITING に戻し、残った SPINNING セッションを CANCELLED にする
    // spin-complete が失敗した場合に room が IN_SESSION + セッション SPINNING で残るケースを正しく回収する
    await prisma.$transaction([
      prisma.room.update({
        where: { id: room.id },
        data: { status: "WAITING" },
      }),
      prisma.rouletteSession.updateMany({
        where: { roomId: room.id, status: "SPINNING" },
        data: { status: "CANCELLED" },
      }),
    ])

    return NextResponse.json({ status: "WAITING" })
  } catch (error) {
    console.error("Error resetting room:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
