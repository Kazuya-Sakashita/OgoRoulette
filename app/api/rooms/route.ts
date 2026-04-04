import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { SEGMENT_COLORS } from "@/lib/constants"
import { randomInt } from "crypto"
import { signGuestToken } from "@/lib/guest-token"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { getDisplayName } from "@/lib/display-name"

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
  // ISSUE-029/041: フェイルファスト — 必須環境変数の存在・強度を確認
  const guestHostSecret = process.env.GUEST_HOST_SECRET
  if (!guestHostSecret) {
    console.error("[rooms] GUEST_HOST_SECRET is not configured")
    return NextResponse.json({ error: "サーバー設定エラーが発生しました" }, { status: 500 })
  }
  if (guestHostSecret.length < 32) {
    console.error(`[rooms] GUEST_HOST_SECRET is too short (${guestHostSecret.length} chars). Minimum 32 required. Generate with: openssl rand -hex 32`)
    return NextResponse.json({ error: "サーバー設定エラーが発生しました" }, { status: 500 })
  }

  // ISSUE-026: レート制限 — 同一 IP から 1分間に 5ルームまで
  const ip = getClientIp(request.headers)
  const { allowed, resetAt } = await checkRateLimit(ip, "room-create", 5, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらくしてからお試しください。" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) } }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await request.json()
    const { name, maxMembers = 10, guestNickname, isPersistent = false, presetMemberNames } = body

    // ISSUE-023: 事前登録メンバー名のバリデーション
    const validPresetNames: string[] = Array.isArray(presetMemberNames)
      ? presetMemberNames
          .filter((n: unknown): n is string => typeof n === "string" && n.trim().length > 0 && n.trim().length <= 20)
          .map((n: string) => n.trim())
          .slice(0, 19) // ホスト込み最大20人
      : []

    // ISSUE-014: 常設グループはログインユーザーのみ作成可能
    if (isPersistent && !user) {
      return NextResponse.json({ error: "常設グループはログインが必要です" }, { status: 401 })
    }

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
      const providerName =
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.display_name ||
        "LINEユーザー"

      const profile = await prisma.profile.upsert({
        where: { id: user.id },
        update: {},
        create: {
          id: user.id,
          email: user.email,
          name: providerName,
          avatarUrl: user.user_metadata?.avatar_url
        },
        select: { id: true, displayName: true }
      })

      // ISSUE-077: 公開表示名は provider_name ではなく display_name を使う
      const resolvedNickname = getDisplayName({ id: profile.id, displayName: profile.displayName })

      // ISSUE-023: ホスト名と重複するプリセット名を除外
      const filteredPresetNames = validPresetNames.filter(n => n !== resolvedNickname)

      const authRoomInclude = {
        members: { include: { profile: { select: { id: true, name: true, avatarUrl: true } } } },
        _count: { select: { members: true } },
      } as const

      // ISSUE-023 Fix: presetMemberNames カラムが未マイグレーションの場合は空で作成（フォールバック）
      let room
      try {
        room = await prisma.room.create({
          data: {
            ownerId: user.id,
            name: trimmedName || "新しいルーム",
            inviteCode,
            maxMembers: Math.max(maxMembers, filteredPresetNames.length + 2),
            isPersistent: isPersistent === true,
            expiresAt: isPersistent ? null : new Date(Date.now() + 24 * 60 * 60 * 1000),
            presetMemberNames: filteredPresetNames,
            members: { create: { profileId: user.id, isHost: true, color: SEGMENT_COLORS[0], nickname: resolvedNickname } }
          },
          include: authRoomInclude,
        })
      } catch (presetErr: unknown) {
        const msg = String((presetErr as { message?: string })?.message ?? "")
        const isColumnMissing = (presetErr as { code?: string })?.code === "42703" || msg.includes("preset_member_names")
        if (!isColumnMissing) throw presetErr
        console.warn("[rooms] preset_member_names column missing — creating room without presets. Run: npx prisma migrate dev")
        room = await prisma.room.create({
          data: {
            ownerId: user.id,
            name: trimmedName || "新しいルーム",
            inviteCode,
            maxMembers,
            isPersistent: isPersistent === true,
            expiresAt: isPersistent ? null : new Date(Date.now() + 24 * 60 * 60 * 1000),
            members: { create: { profileId: user.id, isHost: true, color: SEGMENT_COLORS[0], nickname: resolvedNickname } }
          },
          include: authRoomInclude,
        })
      }

      return NextResponse.json(room, { status: 201 })
    }

    // --- Guest flow ---
    const guestTrimmedNickname = (guestNickname as string).trim()
    const guestFilteredPresetNames = validPresetNames.filter(n => n !== guestTrimmedNickname)

    const guestRoomInclude = {
      members: { include: { profile: { select: { id: true, name: true, avatarUrl: true } } } },
      _count: { select: { members: true } },
    } as const

    // ISSUE-023 Fix: presetMemberNames カラムが未マイグレーションの場合は空で作成（フォールバック）
    let room
    try {
      room = await prisma.room.create({
        data: {
          ownerId: null,
          name: trimmedName || "新しいルーム",
          inviteCode,
          maxMembers: Math.max(maxMembers, guestFilteredPresetNames.length + 2),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          presetMemberNames: guestFilteredPresetNames,
          members: { create: { profileId: null, isHost: true, color: SEGMENT_COLORS[0], nickname: guestTrimmedNickname } }
        },
        include: guestRoomInclude,
      })
    } catch (presetErr: unknown) {
      const msg = String((presetErr as { message?: string })?.message ?? "")
      const isColumnMissing = (presetErr as { code?: string })?.code === "42703" || msg.includes("preset_member_names")
      if (!isColumnMissing) throw presetErr
      console.warn("[rooms] preset_member_names column missing (guest) — creating room without presets. Run: npx prisma migrate dev")
      room = await prisma.room.create({
        data: {
          ownerId: null,
          name: trimmedName || "新しいルーム",
          inviteCode,
          maxMembers,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          members: { create: { profileId: null, isHost: true, color: SEGMENT_COLORS[0], nickname: guestTrimmedNickname } }
        },
        include: guestRoomInclude,
      })
    }

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
