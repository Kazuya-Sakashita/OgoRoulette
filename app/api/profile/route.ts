import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

// GET /api/profile - Get current user's profile with stats
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get or create profile
    const profile = await prisma.profile.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email?.split("@")[0],
        avatarUrl: user.user_metadata?.avatar_url,
      }
    })

    // Get stats
    const [totalSessions, wonSessions, participatedSessions] = await Promise.all([
      prisma.rouletteSession.count({
        where: { hostId: user.id }
      }),
      prisma.rouletteSession.count({
        where: { winnerId: user.id }
      }),
      prisma.participant.count({
        where: { profileId: user.id }
      })
    ])

    // Get total amount treated
    const treatAmountResult = await prisma.rouletteSession.aggregate({
      where: { winnerId: user.id },
      _sum: { treatAmount: true }
    })

    return NextResponse.json({
      ...profile,
      stats: {
        totalSessions,
        wonSessions,
        participatedSessions,
        totalTreatedAmount: treatAmountResult._sum.treatAmount || 0
      }
    })
  } catch (error) {
    console.error("Error fetching profile:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/profile - Update profile
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, avatarUrl } = body

    const profile = await prisma.profile.update({
      where: { id: user.id },
      data: {
        name,
        avatarUrl,
      }
    })

    return NextResponse.json(profile)
  } catch (error) {
    console.error("Error updating profile:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
