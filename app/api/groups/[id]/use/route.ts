import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

// POST /api/groups/[id]/use — update lastUsedAt to now (called when group is selected)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const result = await prisma.userGroup.updateMany({
      where: { id, userId: user.id },
      data: { lastUsedAt: new Date() },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error recording group use:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
