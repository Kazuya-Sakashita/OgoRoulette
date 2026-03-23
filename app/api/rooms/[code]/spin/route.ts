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
// HOW:  1. 参加者リストを DB から取得（クライアント送信値は使わない）
//       2. 当選者を crypto.randomInt で決定
//       3. spinStartedAt = now + SPIN_COUNTDOWN_MS（全員がカウントダウン後に同時開始）
//       4. ルームを IN_SESSION に設定（メンバーはこれを見て spinning UI を表示）
//       5. セッションを SPINNING 状態で作成（startedAt = spinStartedAt）
//       6. winnerIndex / winnerName / spinStartedAt を返す
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await request.json()
    // participants はクライアントから受け取らず DB から取得する（操作防止）
    const { totalAmount, treatAmount } = body

    // 金額バリデーション: 数値なら 0〜9,999,999 の範囲に限定
    if (totalAmount !== null && totalAmount !== undefined) {
      if (typeof totalAmount !== "number" || !Number.isInteger(totalAmount) || totalAmount < 0 || totalAmount > 9_999_999) {
        return NextResponse.json({ error: "合計金額は0〜9,999,999円の整数で入力してください" }, { status: 400 })
      }
    }
    if (treatAmount !== null && treatAmount !== undefined) {
      if (typeof treatAmount !== "number" || !Number.isInteger(treatAmount) || treatAmount < 0 || treatAmount > 9_999_999) {
        return NextResponse.json({ error: "奢り金額は0〜9,999,999円の整数で入力してください" }, { status: 400 })
      }
    }

    const room = await prisma.room.findUnique({
      where: { inviteCode: code.toUpperCase() },
      select: {
        id: true,
        status: true,
        ownerId: true,
        expiresAt: true,
        members: {
          select: {
            nickname: true,
            color: true,
            profileId: true,
            profile: { select: { id: true, name: true } },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    })

    if (!room) {
      return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 })
    }

    // expiresAt を直接チェック（ステータス更新クーロンに依存しない）
    if (room.expiresAt && room.expiresAt < new Date()) {
      return NextResponse.json({ error: "ルームが期限切れです" }, { status: 403 })
    }

    if (room.members.length < 2) {
      return NextResponse.json({ error: "2人以上の参加者が必要です" }, { status: 400 })
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

    // DB メンバーから参加者リストを構築（クライアント送信値は使わない）
    const participants = room.members.map((member, index) => ({
      name: member.nickname || member.profile?.name || "ゲスト",
      color: member.color,
      index,
      profileId: member.profileId ?? null,
    }))

    // サーバーが当選者をランダムに決定（偏りのない暗号的乱数）
    const winnerIndex = randomInt(0, participants.length)
    const winnerParticipant = participants[winnerIndex]
    const winnerName = winnerParticipant.name
    const winnerProfileId = winnerParticipant.profileId ?? null

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
          winnerId: winnerProfileId,
          roomId: room.id,
          totalAmount: hasBill ? totalAmount : null,
          treatAmount: hasBill ? (treatAmount ?? 0) : null,
          perPersonAmount: hasBill ? perPersonAmount : null,
          status: "SPINNING",
          startedAt: spinStartedAt,
          participants: {
            create: participants.map((p) => ({
              name: p.name,
              color: p.color,
              profileId: p.profileId ?? null,
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

    // 当選者の統計を更新（認証ユーザーのみ・失敗してもスピン結果には影響しない）
    if (winnerProfileId) {
      prisma.profile.update({
        where: { id: winnerProfileId },
        data: {
          totalTreated:    { increment: 1 },
          totalAmountPaid: { increment: hasBill ? (treatAmount ?? 0) : 0 },
        },
      }).catch(() => {})
    }

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
