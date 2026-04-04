import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { SEGMENT_COLORS } from "@/lib/constants"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { getDisplayName } from "@/lib/display-name"

// POST /api/rooms/join - Join a room with invite code
export async function POST(request: Request) {
  // レート制限: 同一 IP から 1分間に 10回まで
  const ip = getClientIp(request.headers)
  const { allowed, resetAt } = await checkRateLimit(ip, "join", 10, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらくしてからお試しください。" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) },
      }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await request.json()
    const { inviteCode, guestName } = body

    if (!inviteCode) {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 })
    }

    // Find room by invite code
    const room = await prisma.room.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
      include: {
        members: true,
        _count: { select: { members: true } }
      }
    })

    if (!room) {
      return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 })
    }

    if (room.status === 'EXPIRED' || (room.expiresAt && room.expiresAt < new Date())) {
      return NextResponse.json({ error: "このルームは有効期限が切れています" }, { status: 400 })
    }

    if (room.status === 'COMPLETED') {
      return NextResponse.json({ error: "このルームは既に終了しています" }, { status: 400 })
    }

    if (room.status === 'IN_SESSION') {
      return NextResponse.json({ error: "ルーレットが進行中のため参加できません" }, { status: 400 })
    }

    if (room._count.members >= room.maxMembers) {
      return NextResponse.json({ error: "ルームが満員です" }, { status: 400 })
    }

    // Authenticated user flow
    if (user) {
      // Check if already a member
      const existingMember = room.members.find(m => m.profileId === user.id)
      if (existingMember) {
        return NextResponse.json({
          message: "Already a member",
          room: { id: room.id, inviteCode: room.inviteCode }
        })
      }

      // Ensure profile exists
      // ISSUE-090: provider由来名は Profile.name（内部保持用）にのみ保存する
      // nickname には getDisplayName() で得た公開名を使う
      const providerName =
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.display_name ||
        "ユーザー"

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

      const resolvedNickname = getDisplayName({ id: profile.id, displayName: profile.displayName })

      // アトミック: 現在のメンバー数を再確認 → 色決定 → メンバー作成
      // ISSUE-043: 同時参加での色衝突防止 / ISSUE-048: 定員超過防止
      try {
        await prisma.$transaction(async (tx) => {
          const currentCount = await tx.roomMember.count({ where: { roomId: room.id } })
          if (currentCount >= room.maxMembers) {
            throw Object.assign(new Error("ルームが満員です"), { statusCode: 400 })
          }
          return tx.roomMember.create({
            data: {
              roomId: room.id,
              profileId: user.id,
              isHost: false,
              color: SEGMENT_COLORS[currentCount % SEGMENT_COLORS.length],
              nickname: resolvedNickname,
            },
          })
        })
      } catch (txErr) {
        if ((txErr as { statusCode?: number }).statusCode === 400) {
          return NextResponse.json({ error: (txErr as Error).message }, { status: 400 })
        }
        throw txErr
      }

      return NextResponse.json({
        success: true,
        room: { id: room.id, inviteCode: room.inviteCode, name: room.name }
      })
    }

    // Guest flow — requires a name, then save to DB
    if (!guestName) {
      return NextResponse.json({
        requiresName: true,
        room: { id: room.id, name: room.name }
      })
    }

    const trimmedGuestName = (guestName as string).trim()
    if (trimmedGuestName.length > 20) {
      return NextResponse.json({ error: "名前は20文字以内で入力してください" }, { status: 400 })
    }

    // ISSUE-024: 同一ニックネームの重複参加を防止
    const duplicateGuest = room.members.find(
      m => m.profileId === null && m.nickname === trimmedGuestName
    )
    if (duplicateGuest) {
      return NextResponse.json({
        success: true,
        room: { id: room.id, inviteCode: room.inviteCode, name: room.name }
      })
    }

    // アトミック: 現在のメンバー数を再確認 → 色決定 → メンバー作成
    // ISSUE-043: 同時参加での色衝突防止 / ISSUE-048: 定員超過防止
    try {
      await prisma.$transaction(async (tx) => {
        const currentCount = await tx.roomMember.count({ where: { roomId: room.id } })
        if (currentCount >= room.maxMembers) {
          throw Object.assign(new Error("ルームが満員です"), { statusCode: 400 })
        }
        return tx.roomMember.create({
          data: {
            roomId: room.id,
            profileId: null,
            isHost: false,
            color: SEGMENT_COLORS[currentCount % SEGMENT_COLORS.length],
            nickname: trimmedGuestName,
          },
        })
      })
    } catch (txErr) {
      if ((txErr as { statusCode?: number }).statusCode === 400) {
        return NextResponse.json({ error: (txErr as Error).message }, { status: 400 })
      }
      throw txErr
    }

    return NextResponse.json({
      success: true,
      room: { id: room.id, inviteCode: room.inviteCode, name: room.name }
    })

  } catch (error) {
    console.error("Error joining room:", error)
    return NextResponse.json({ error: "Failed to join room" }, { status: 500 })
  }
}
