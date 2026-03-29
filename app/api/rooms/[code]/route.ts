import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getDisplayName } from "@/lib/display-name"

// GET /api/rooms/[code] - Get room by invite code
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params

    const room = await prisma.room.findUnique({
      where: { inviteCode: code.toUpperCase() },
      include: {
        owner: {
          select: { id: true, name: true, displayName: true, avatarUrl: true }
        },
        members: {
          include: {
            profile: {
              select: { id: true, name: true, displayName: true, avatarUrl: true }
            }
          },
          orderBy: { joinedAt: 'asc' }
        },
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            participants: {
              where: { isWinner: true },
              take: 1,
              select: { name: true, isWinner: true, color: true, orderIndex: true },
            },
          },
        },
        _count: {
          select: { members: true, sessions: true }
        }
      }
    })

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    // Check if expired
    if (room.expiresAt && room.expiresAt < new Date()) {
      return NextResponse.json({
        error: "このルームは有効期限が切れています",
        expired: true
      }, { status: 410 })
    }

    // ISSUE-090: profileId を持つメンバーの nickname を公開名で上書きする。
    // 過去の参加者が provider由来名（本名）で nickname を保存していた場合も
    // レスポンス時点で安全な公開名に差し替える。ゲスト（profileId=null）はそのまま。
    const sanitizedMembers = room.members.map((m) => ({
      ...m,
      nickname: m.profileId && m.profile
        ? getDisplayName({ id: m.profile.id, displayName: m.profile.displayName })
        : m.nickname,
    }))

    return NextResponse.json({ ...room, members: sanitizedMembers })
  } catch (error) {
    console.error("Error fetching room:", error)
    return NextResponse.json({ error: "Failed to fetch room" }, { status: 500 })
  }
}
