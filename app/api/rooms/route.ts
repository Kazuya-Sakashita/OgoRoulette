import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { SEGMENT_COLORS } from "@/lib/constants"

// Generate random invite code (6 characters, avoids confusing chars)
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Generate a unique invite code (retries up to 10 times)
async function generateUniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateInviteCode()
    const existing = await prisma.room.findUnique({ where: { inviteCode: code } })
    if (!existing) return code
  }
  return generateInviteCode() // Fallback (collision extremely unlikely)
}

// GET /api/rooms - List rooms for the authenticated user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rooms = await prisma.room.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { members: { some: { profileId: user.id } } }
        ]
      },
      include: {
        members: {
          include: {
            profile: { select: { id: true, name: true, avatarUrl: true } }
          }
        },
        _count: { select: { members: true, sessions: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(rooms)
  } catch (error) {
    console.error("Error fetching rooms:", error)
    return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 })
  }
}

// POST /api/rooms - Create a new room (authenticated or guest)
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await request.json()
    const { name, maxMembers = 10, guestNickname } = body

    // Guest requires a nickname
    if (!user && !guestNickname?.trim()) {
      return NextResponse.json({ error: "ニックネームを入力してください" }, { status: 400 })
    }

    const inviteCode = await generateUniqueInviteCode()

    if (user) {
      // --- Authenticated flow ---
      await prisma.profile.upsert({
        where: { id: user.id },
        update: {},
        create: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.email?.split('@')[0],
          avatarUrl: user.user_metadata?.avatar_url
        }
      })

      const room = await prisma.room.create({
        data: {
          ownerId: user.id,
          name: name || "新しいルーム",
          inviteCode,
          maxMembers,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          members: {
            create: {
              profileId: user.id,
              isHost: true,
              color: SEGMENT_COLORS[0],
              nickname: user.user_metadata?.name || user.email?.split('@')[0]
            }
          }
        },
        include: {
          members: {
            include: {
              profile: { select: { id: true, name: true, avatarUrl: true } }
            }
          },
          _count: { select: { members: true } }
        }
      })

      return NextResponse.json(room, { status: 201 })
    }

    // --- Guest flow ---
    const room = await prisma.room.create({
      data: {
        ownerId: null,
        name: name || "新しいルーム",
        inviteCode,
        maxMembers,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        members: {
          create: {
            profileId: null,
            isHost: true,
            color: SEGMENT_COLORS[0],
            nickname: guestNickname.trim()
          }
        }
      },
      include: {
        members: {
          include: {
            profile: { select: { id: true, name: true, avatarUrl: true } }
          }
        },
        _count: { select: { members: true } }
      }
    })

    return NextResponse.json(room, { status: 201 })
  } catch (error) {
    console.error("Error creating room:", error)
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 })
  }
}
