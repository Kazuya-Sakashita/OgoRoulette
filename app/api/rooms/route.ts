import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { SEGMENT_COLORS } from "@/lib/constants"
import { randomInt } from "crypto"
import { signGuestToken } from "@/lib/guest-token"

// Generate random invite code (6 characters, avoids confusing chars)
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(randomInt(0, chars.length))
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

    // maxMembers バリデーション
    if (typeof maxMembers !== "number" || !Number.isInteger(maxMembers) || maxMembers < 2 || maxMembers > 20) {
      return NextResponse.json({ error: "参加人数は2〜20人で設定してください" }, { status: 400 })
    }

    // ルーム名の長さ制限
    const trimmedName = typeof name === "string" ? name.trim() : ""
    if (trimmedName.length > 30) {
      return NextResponse.json({ error: "ルーム名は30文字以内で入力してください" }, { status: 400 })
    }

    // Guest requires a nickname
    if (!user) {
      const trimmedNickname = guestNickname?.trim() ?? ""
      if (!trimmedNickname) {
        return NextResponse.json({ error: "ニックネームを入力してください" }, { status: 400 })
      }
      if (trimmedNickname.length > 20) {
        return NextResponse.json({ error: "ニックネームは20文字以内で入力してください" }, { status: 400 })
      }
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
          name: trimmedName || "新しいルーム",
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
        name: trimmedName || "新しいルーム",
        inviteCode,
        maxMembers,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        members: {
          create: {
            profileId: null,
            isHost: true,
            color: SEGMENT_COLORS[0],
            nickname: (guestNickname as string).trim()
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

    // ゲストホストトークンを HMAC で署名してクライアントに返す
    // クライアントはこのトークンを localStorage に保存し、spin / reset / spin-complete で使用する
    const hostMember = room.members.find(m => m.isHost)
    let hostToken: string | null = null
    if (hostMember) {
      try {
        hostToken = signGuestToken(hostMember.id, inviteCode)
      } catch {
        console.error("GUEST_HOST_SECRET is not configured")
        return NextResponse.json({ error: "サーバー設定エラーが発生しました" }, { status: 500 })
      }
    }
    return NextResponse.json({ ...room, hostToken }, { status: 201 })
  } catch (error) {
    console.error("Error creating room:", error)
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 })
  }
}
