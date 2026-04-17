import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getDisplayName } from "@/lib/display-name"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { signResultToken } from "@/lib/result-token"

// GET /api/rooms/[code] - Get room by invite code
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  // ISSUE-250: ルームコード列挙攻撃（ブルートフォース）防止
  // ポーリング: IN_SESSION 中 2s 間隔 × 最大4台同WiFi = ~120 req/min
  // 300/min は正規利用に余裕を持たせつつ自動化攻撃を制限する
  const ip = getClientIp(request.headers)
  const { allowed, resetAt } = await checkRateLimit(ip, "room-read", 300, 60_000)
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
    const { code } = await params

    const room = await prisma.room.findUnique({
      where: { inviteCode: code.toUpperCase() },
      include: {
        owner: {
          select: { id: true, name: true, displayName: true, avatarUrl: true }
        },
        members: {
          include: {
            profile: {
              select: { id: true, name: true, displayName: true, avatarUrl: true }
            }
          },
          orderBy: { joinedAt: 'asc' }
        },
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            participants: {
              where: { isWinner: true },
              take: 1,
              select: { name: true, isWinner: true, color: true, orderIndex: true },
            },
          },
        },
        _count: {
          select: { members: true, sessions: true }
        }
      }
    })

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    // Check if expired
    if (room.expiresAt && room.expiresAt < new Date()) {
      return NextResponse.json({
        error: "このルームは有効期限が切れています",
        expired: true
      }, { status: 410 })
    }

    // ISSUE-090: profileId を持つメンバーの nickname を公開名で上書きする。
    // 過去の参加者が provider由来名（本名）で nickname を保存していた場合も
    // レスポンス時点で安全な公開名に差し替える。ゲスト（profileId=null）はそのまま。
    const sanitizedMembers = room.members.map((m) => ({
      ...m,
      nickname: m.profileId && m.profile
        ? getDisplayName({ id: m.profile.id, displayName: m.profile.displayName })
        : m.nickname,
    }))

    // ISSUE-276: 各セッションの当選者に対して resultToken を計算して付与する。
    // メンバーはこれを share URL に含めることで正式抽選結果として検証可能になる。
    // signResultToken は RESULT_TOKEN_SECRET 未設定時に例外を投げるため、
    // 未設定環境（dev 等）では token なしで続行する。
    const sessionsWithToken = room.sessions.map((session) => {
      const winner = session.participants.find((p) => p.isWinner)
      let resultToken: string | undefined
      try {
        resultToken = winner ? signResultToken(session.id, winner.name) : undefined
      } catch {
        resultToken = undefined
      }
      return { ...session, resultToken }
    })

    return NextResponse.json({ ...room, members: sanitizedMembers, sessions: sessionsWithToken })
  } catch (error) {
    console.error("Error fetching room:", error)
    return NextResponse.json({ error: "Failed to fetch room" }, { status: 500 })
  }
}
