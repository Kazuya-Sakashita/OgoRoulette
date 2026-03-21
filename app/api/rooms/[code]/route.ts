import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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
          select: { id: true, name: true, avatarUrl: true }
        },
        members: {
          include: {
            profile: {
              select: { id: true, name: true, avatarUrl: true }
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
      }, { status: 400 })
    }

    return NextResponse.json(room)
  } catch (error) {
    console.error("Error fetching room:", error)
    return NextResponse.json({ error: "Failed to fetch room" }, { status: 500 })
  }
}
