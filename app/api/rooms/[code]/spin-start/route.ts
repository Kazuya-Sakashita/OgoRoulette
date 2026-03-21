import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { canStartSpin } from "@/lib/room-spin"

// POST /api/rooms/[code]/spin-start
// オーナーがスピンを開始するとき WAITING → IN_SESSION に遷移する。
// メンバーはポーリングで IN_SESSION を検知して「スピン中」UIを表示できる。
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const room = await prisma.room.findUnique({
      where: { inviteCode: code.toUpperCase() },
      select: { id: true, status: true },
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
    }
    // ゲストホスト（user=null）: roomId 知識が唯一の証明。
    // IN_SESSION はデータを保存しない視覚的状態変化のみのため低リスク。

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
