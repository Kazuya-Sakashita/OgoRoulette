import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

// GET /api/sessions - Get all sessions for current user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sessions = await prisma.rouletteSession.findMany({
      where: {
        OR: [
          { hostId: user.id },
          { participants: { some: { profileId: user.id } } },
        ],
      },
      include: {
        participants: {
          orderBy: { orderIndex: "asc" },
        },
        room: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(sessions)
  } catch (error) {
    console.error("Error fetching sessions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/sessions - Save a completed roulette session
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await request.json()
    const {
      title,
      location,
      totalAmount,
      treatAmount,
      perPersonAmount,
      winnerName,
      participants, // [{ name: string; color: string; index: number }]
      roomId,
    } = body

    // Authenticated saves: full profile session
    // Guest saves: require roomId so the session is linkable to the room
    if (!user && !roomId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Owner-only guard: authenticated user with roomId must be the room's host member.
    // This prevents non-owner members from saving a session by calling the API directly.
    // Guest hosts (no user) cannot be verified by profileId, so they rely on the
    // room-status lock in the transaction below.
    if (user && roomId) {
      const ownerMembership = await prisma.roomMember.findFirst({
        where: { roomId, isHost: true, profileId: user.id },
        select: { id: true },
      })
      if (!ownerMembership) {
        return NextResponse.json({ error: "Only the room owner can save a session" }, { status: 403 })
      }
    }

    // Ensure host profile exists (authenticated only)
    if (user) {
      await prisma.profile.upsert({
        where: { id: user.id },
        update: {},
        create: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || null,
          avatarUrl: user.user_metadata?.avatar_url || null,
        },
      })
    }

    // When roomId is present: atomically lock the room and create the session
    // in a transaction to prevent duplicate sessions from concurrent requests.
    const session = await prisma.$transaction(async (tx) => {
      if (roomId) {
        // Lock: update status only if the room is still in a spinnable state.
        // updateMany returns { count: 0 } when the WHERE condition doesn't match,
        // which means another request already marked it COMPLETED (or it's EXPIRED/missing).
        const lockResult = await tx.room.updateMany({
          where: { id: roomId, status: { notIn: ["COMPLETED", "EXPIRED"] } },
          data: { status: "COMPLETED" },
        })

        if (lockResult.count === 0) {
          const existing = await tx.room.findUnique({ where: { id: roomId }, select: { status: true } })
          if (!existing) throw Object.assign(new Error("Room not found"), { statusCode: 404 })
          if (existing.status === "EXPIRED") throw Object.assign(new Error("Room has expired"), { statusCode: 403 })
          throw Object.assign(new Error("Session already saved for this room"), { statusCode: 409 })
        }
      }

      return tx.rouletteSession.create({
        data: {
          hostId: user?.id ?? null,
          roomId: roomId || null,
          title: title || null,
          location: location || null,
          totalAmount: totalAmount || null,
          treatAmount: treatAmount || null,
          perPersonAmount: perPersonAmount || null,
          status: "COMPLETED",
          completedAt: new Date(),
          participants: {
            create: (participants as { name: string; color: string; index: number }[]).map((p) => ({
              name: p.name,
              color: p.color,
              isWinner: p.name === winnerName,
              amountToPay: p.name === winnerName
                ? (treatAmount || null)
                : (perPersonAmount || null),
              orderIndex: p.index,
            })),
          },
        },
        include: {
          participants: { orderBy: { orderIndex: "asc" } },
        },
      })
    })

    // Increment host's total session count (authenticated only)
    if (user) {
      await prisma.profile.update({
        where: { id: user.id },
        data: { totalSessions: { increment: 1 } },
      })
    }

    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode
    if (statusCode) {
      return NextResponse.json({ error: (error as Error).message }, { status: statusCode })
    }
    console.error("Error creating session:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
