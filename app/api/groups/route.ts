import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

// GET /api/groups — list logged-in user's cloud groups
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const groups = await prisma.userGroup.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    })
    return NextResponse.json(groups)
  } catch (error) {
    console.error("Error fetching groups:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/groups — upsert group by name (idempotent)
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Ensure profile exists
    await prisma.profile.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        email: user.email,
        name:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          null,
        avatarUrl: user.user_metadata?.avatar_url || null,
      },
    })

    const body = await request.json()
    const { name, participants } = body

    if (typeof name !== "string" || !name.trim() || !Array.isArray(participants)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const group = await prisma.userGroup.upsert({
      where: { userId_name: { userId: user.id, name: name.trim() } },
      update: { participants },
      create: { userId: user.id, name: name.trim(), participants },
    })

    return NextResponse.json(group, { status: 201 })
  } catch (error) {
    console.error("Error saving group:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
