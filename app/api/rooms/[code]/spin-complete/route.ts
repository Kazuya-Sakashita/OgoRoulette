import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

// POST /api/rooms/[code]/spin-complete
// WHAT: オーナーのアニメーション完了後に呼ぶ。ルームを COMPLETED、セッションを COMPLETED に設定。
// WHY:  spin API では IN_SESSION + SPINNING のまま。アニメーション終了後に確定させることで
//       メンバーがポーリングで「ルームが終了した」ことを検知できる。
// HOW:  room.status → COMPLETED / rouletteSession.status → COMPLETED（SPINNING のものだけ）
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
      select: { id: true, status: true, ownerId: true },
    })

    if (!room) {
      return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 })
    }

    // 認証ルームへの未認証アクセスは拒否
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
        return NextResponse.json({ error: "オーナーのみ操作できます" }, { status: 403 })
      }
    }

    await prisma.$transaction([
      prisma.room.update({
        where: { id: room.id },
        data: { status: "COMPLETED" },
      }),
      prisma.rouletteSession.updateMany({
        where: { roomId: room.id, status: "SPINNING" },
        data: { status: "COMPLETED" },
      }),
    ])

    return NextResponse.json({ status: "COMPLETED" })
  } catch (error) {
    console.error("Error in spin-complete:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
