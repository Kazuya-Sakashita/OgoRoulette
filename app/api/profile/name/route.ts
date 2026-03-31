import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/profile/name
 *
 * Lightweight endpoint for the /home greeting.
 * Returns only the fields needed for display: id, displayName, displayNameConfirmedAt.
 * No stats queries — ~5x faster than GET /api/profile.
 *
 * Used by: app/home/page.tsx (greeting display)
 * For full profile + stats, use GET /api/profile (ProfileSheet).
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const profile = await prisma.profile.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        email: user.email ?? null,
        name: user.user_metadata?.name || user.email?.split("@")[0],
        avatarUrl: user.user_metadata?.avatar_url,
      },
      select: {
        id: true,
        displayName: true,
        displayNameConfirmedAt: true,
      },
    })

    return NextResponse.json(profile)
  } catch (error) {
    console.error("Error fetching profile name:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
