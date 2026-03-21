import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { calculateBillSplit } from "@/lib/bill-calculator"
import { randomInt } from "crypto"
import { SPIN_COUNTDOWN_MS } from "@/lib/constants"

// POST /api/rooms/[code]/spin
// WHAT: オーナー専用。サーバーが当選者を決定し、全クライアントが使う spinStartedAt を返す。
// WHY:  クライアント側の当選者決定は不正可能。spinStartedAt を共有することでオーナー・メンバー間の
//       アニメーション開始タイミングをサーバー基準で統一する。
// HOW:  1. 当選者を crypto.randomInt で決定
//       2. spinStartedAt = now + SPIN_COUNTDOWN_MS（全員がカウントダウン後に同時開始）
//       3. ルームを IN_SESSION に設定（メンバーはこれを見て spinning UI を表示）
//       4. セッションを SPINNING 状態で作成（startedAt = spinStartedAt）
//       5. winnerIndex / winnerName / spinStartedAt / spinDurationMs を返す
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await request.json()
    const { participants, totalAmount, treatAmount } = body
    // participants: { name: string; color: string; index: number }[]

    if (!Array.isArray(participants) || participants.length < 2) {
      return NextResponse.json({ error: "2人以上の参加者が必要です" }, { status: 400 })
    }

    const room = await prisma.room.findUnique({
      where: { inviteCode: code.toUpperCase() },
      select: { id: true, status: true, ownerId: true },
    })

    if (!room) {
      return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 })
    }

    if (room.status === "COMPLETED" || room.status === "EXPIRED") {
      return NextResponse.json({ error: "このルームはすでに終了しています" }, { status: 409 })
    }
    if (room.status === "IN_SESSION") {
      return NextResponse.json({ error: "スピンが進行中です" }, { status: 409 })
    }

    // 認証ルームへの未認証アクセスは拒否
    if (room.ownerId && !user) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 })
    }

    if (user) {
      // 認証ユーザーはオーナー検証必須
      const ownerMembership = await prisma.roomMember.findFirst({
        where: { roomId: room.id, isHost: true, profileId: user.id },
        select: { id: true },
      })
      if (!ownerMembership) {
        return NextResponse.json({ error: "オーナーのみスピンできます" }, { status: 403 })
      }
    } else {
      // ゲストルーム: X-Guest-Host-Token でホストメンバーIDを検証
      const guestToken = request.headers.get("X-Guest-Host-Token")
      if (!guestToken) {
        return NextResponse.json({ error: "オーナーのみスピンできます" }, { status: 403 })
      }
      const guestMember = await prisma.roomMember.findFirst({
        where: { id: guestToken, roomId: room.id, isHost: true, profileId: null },
        select: { id: true },
      })
      if (!guestMember) {
        return NextResponse.json({ error: "オーナーのみスピンできます" }, { status: 403 })
      }
    }

    // Ensure host profile exists (authenticated only)
    if (user) {
      await prisma.profile.upsert({
        where: { id: user.id },
        update: {},
        create: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || null,
          avatarUrl: user.user_metadata?.avatar_url || null,
        },
      })
    }

    // サーバーが当選者をランダムに決定（偏りのない暗号的乱数）
    const winnerIndex = randomInt(0, participants.length)
    const winnerParticipant = participants[winnerIndex] as { name: string }
    const winnerName = winnerParticipant.name

    // 全クライアント共有の animation 開始時刻
    // SPIN_COUNTDOWN_MS 後にアニメーションが始まる = 3秒ポーリングのメンバーも間に合う
    const spinStartedAt = new Date(Date.now() + SPIN_COUNTDOWN_MS)

    // 金額計算
    const hasBill = typeof totalAmount === "number" && totalAmount > 0
    const { splitAmount: perPersonAmount } = hasBill
      ? calculateBillSplit(totalAmount, treatAmount ?? 0, participants.length)
      : { splitAmount: 0 }

    // アトミック: room を IN_SESSION に設定 + SPINNING セッションを作成
    const session = await prisma.$transaction(async (tx) => {
      const lockResult = await tx.room.updateMany({
        where: { id: room.id, status: "WAITING" },
        data: { status: "IN_SESSION" },
      })

      if (lockResult.count === 0) {
        const existing = await tx.room.findUnique({ where: { id: room.id }, select: { status: true } })
        if (!existing) throw Object.assign(new Error("ルームが見つかりません"), { statusCode: 404 })
        if (existing.status === "EXPIRED") throw Object.assign(new Error("ルームが期限切れです"), { statusCode: 403 })
        throw Object.assign(new Error("このルームはすでにスピン済みです"), { statusCode: 409 })
      }

      return tx.rouletteSession.create({
        data: {
          hostId: user?.id ?? null,
          roomId: room.id,
          totalAmount: hasBill ? totalAmount : null,
          treatAmount: hasBill ? (treatAmount ?? 0) : null,
          perPersonAmount: hasBill ? perPersonAmount : null,
          status: "SPINNING",
          startedAt: spinStartedAt,
          participants: {
            create: (participants as { name: string; color: string; index: number }[]).map((p) => ({
              name: p.name,
              color: p.color,
              isWinner: p.index === winnerIndex,
              amountToPay: p.index === winnerIndex
                ? (hasBill ? (treatAmount ?? 0) : null)
                : (hasBill ? perPersonAmount : null),
              orderIndex: p.index,
            })),
          },
        },
        select: { id: true },
      })
    })

    return NextResponse.json({
      winnerIndex,
      winnerName,
      sessionId: session.id,
      spinStartedAt: spinStartedAt.getTime(), // Unix ms — 全クライアントが基準にする
    })
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode
    if (statusCode) {
      return NextResponse.json({ error: (error as Error).message }, { status: statusCode })
    }
    console.error("Error in spin:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
