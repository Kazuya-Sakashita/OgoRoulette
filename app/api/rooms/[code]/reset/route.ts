import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

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
      // ゲストルーム: X-Guest-Host-Token でホストメンバーIDを検証
      const guestToken = request.headers.get("X-Guest-Host-Token")
      if (!guestToken) {
        return NextResponse.json({ error: "オーナーのみリセットできます" }, { status: 403 })
      }
      const guestMember = await prisma.roomMember.findFirst({
        where: { id: guestToken, roomId: room.id, isHost: true, profileId: null },
        select: { id: true },
      })
      if (!guestMember) {
        return NextResponse.json({ error: "オーナーのみリセットできます" }, { status: 403 })
      }
    }

    await prisma.room.update({
      where: { id: room.id },
      data: { status: "WAITING" },
    })

    return NextResponse.json({ status: "WAITING" })
  } catch (error) {
    console.error("Error resetting room:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
