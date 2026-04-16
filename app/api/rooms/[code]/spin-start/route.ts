import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { canStartSpin } from "@/lib/room-spin"
import { verifyGuestToken } from "@/lib/guest-token"

// POST /api/rooms/[code]/spin-start
// オーナーがスピンを開始するとき WAITING → IN_SESSION に遷移する。
// メンバーはポーリングで IN_SESSION を検知して「スピン中」UIを表示できる。
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
      select: { id: true, status: true, ownerId: true },
    })

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    // WAITING 以外から IN_SESSION には遷移できない（多重実行防止）
    if (!canStartSpin(room.status)) {
      return NextResponse.json(
        { error: "Room is not in WAITING state" },
        { status: 409 }
      )
    }

    // ISSUE-256: 認証ルームへの未認証アクセスを早期拒否
    // spin / spin-complete / reset と同パターンで一貫性を確保
    if (room.ownerId && !user) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 })
    }

    // 認証ユーザーはオーナー検証必須
    if (user) {
      const ownerMembership = await prisma.roomMember.findFirst({
        where: { roomId: room.id, isHost: true, profileId: user.id },
        select: { id: true },
      })
      if (!ownerMembership) {
        return NextResponse.json(
          { error: "Only the room owner can start a spin" },
          { status: 403 }
        )
      }
    } else {
      // ゲストルーム: X-Guest-Host-Token を HMAC で検証
      const guestToken = request.headers.get("X-Guest-Host-Token")
      if (!guestToken) {
        return NextResponse.json({ error: "オーナーのみスピンを開始できます" }, { status: 403 })
      }
      const hostMember = await prisma.roomMember.findFirst({
        where: { roomId: room.id, isHost: true, profileId: null },
        select: { id: true },
      })
      if (!hostMember || !verifyGuestToken(guestToken, hostMember.id, code.toUpperCase())) {
        return NextResponse.json({ error: "オーナーのみスピンを開始できます" }, { status: 403 })
      }
    }

    await prisma.room.update({
      where: { id: room.id },
      data: { status: "IN_SESSION" },
    })

    return NextResponse.json({ status: "IN_SESSION" })
  } catch (error) {
    console.error("Error starting spin:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
