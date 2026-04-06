import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

// DELETE /api/rooms/[code]/members/me
// WHAT: 自分自身をルームから退室させる
// WHY:  ISSUE-225 — メンバーが誤参加や都合変更時に自分で離脱できるようにする
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 })
    }

    const room = await prisma.room.findUnique({
      where: { inviteCode: code.toUpperCase() },
      select: { id: true, ownerId: true },
    })

    if (!room) {
      return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 })
    }

    if (room.ownerId === user.id) {
      return NextResponse.json({ error: "オーナーはルームを離脱できません" }, { status: 403 })
    }

    await prisma.roomMember.deleteMany({
      where: {
        roomId: room.id,
        profileId: user.id,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[DELETE /members/me]", e)
    return NextResponse.json({ error: "退室に失敗しました" }, { status: 500 })
  }
}
