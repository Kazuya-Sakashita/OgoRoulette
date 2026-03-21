import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

// GET /api/sessions/[id] - Get session by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const session = await prisma.rouletteSession.findUnique({
      where: { id },
      include: {
        participants: {
          orderBy: { orderIndex: "asc" },
        },
      },
    })

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Only allow access to sessions the user hosted or participated in
    const isHost = session.hostId === user.id
    const isParticipant = session.participants.some((p) => p.profileId === user.id)
    if (!isHost && !isParticipant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(session)
  } catch (error) {
    console.error("Error fetching session:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/sessions/[id] - Update session (complete roulette)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { winnerId, winnerParticipantId, totalAmount, treatAmount } = body

    // Verify user is the host
    const existingSession = await prisma.rouletteSession.findUnique({
      where: { id },
      include: { participants: true }
    })

    if (!existingSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (existingSession.hostId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Calculate amounts
    const participantCount = existingSession.participants.length
    const remainingAmount = (totalAmount || 0) - (treatAmount || 0)
    const perPersonAmount = participantCount > 1 
      ? Math.ceil(remainingAmount / (participantCount - 1))
      : 0

    // Update session and participants
    const session = await prisma.rouletteSession.update({
      where: { id },
      data: {
        status: "COMPLETED",
        winnerId,
        totalAmount,
        treatAmount,
        completedAt: new Date(),
        participants: {
          updateMany: [
            {
              where: { id: winnerParticipantId },
              data: { isWinner: true, amountToPay: treatAmount }
            },
            {
              where: { 
                id: { not: winnerParticipantId },
                sessionId: id
              },
              data: { amountToPay: perPersonAmount }
            }
          ]
        }
      },
      include: {
        host: true,
        winner: true,
        participants: true,
      }
    })

    return NextResponse.json(session)
  } catch (error) {
    console.error("Error updating session:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/sessions/[id] - Delete session
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Verify user is the host
    const session = await prisma.rouletteSession.findUnique({
      where: { id }
    })

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (session.hostId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.rouletteSession.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting session:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
