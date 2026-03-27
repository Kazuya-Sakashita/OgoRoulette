import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/rooms/[code]/ranking
// WHAT: ルームの全スピン履歴から奢りランキングを集計して返す
// WHY:  GET /api/rooms/[code] のセッション取得は take:5 で制限されており、
//       長期利用の常設グループでランキングが不正確になる (ISSUE-047)
// HOW:  全 COMPLETED セッションの winner participants を name で集計し上位10件を返す
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params

    const room = await prisma.room.findUnique({
      where: { inviteCode: code.toUpperCase() },
      select: { id: true },
    })

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    // 全 COMPLETED セッションの winner を取得して name で集計
    const winners = await prisma.participant.findMany({
      where: {
        isWinner: true,
        session: { roomId: room.id, status: "COMPLETED" },
      },
      select: { name: true },
    })

    const counts: Record<string, number> = {}
    for (const w of winners) {
      counts[w.name] = (counts[w.name] ?? 0) + 1
    }

    const ranking = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return NextResponse.json({ ranking })
  } catch (error) {
    console.error("Error fetching ranking:", error)
    return NextResponse.json({ error: "Failed to fetch ranking" }, { status: 500 })
  }
}
