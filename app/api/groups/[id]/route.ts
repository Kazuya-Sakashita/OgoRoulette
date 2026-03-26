import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

// PUT /api/groups/[id] — update group name and/or participants
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { name, participants } = body as { name?: string; participants?: string[] }

    if (!name && !participants) {
      return NextResponse.json({ error: "name または participants が必要です" }, { status: 400 })
    }

    const data: { name?: string; participants?: string[] } = {}
    if (typeof name === "string" && name.trim()) data.name = name.trim()
    if (Array.isArray(participants)) data.participants = participants

    const result = await prisma.userGroup.updateMany({
      where: { id, userId: user.id },
      data,
    })

    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error updating group:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/groups/[id] — delete a cloud group (must be owned by current user)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const result = await prisma.userGroup.deleteMany({
      where: { id, userId: user.id },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error deleting group:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
