"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Calendar, Users, Crown, Sparkles } from "lucide-react"
import { SEGMENT_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/format"

// --- Types ---

interface Participant {
  id: string
  name: string
  color: string
  isWinner: boolean
  amountToPay: number | null
  orderIndex: number
}

interface Session {
  id: string
  hostId: string | null
  createdAt: string
  totalAmount: number | null
  treatAmount: number | null
  perPersonAmount: number | null
  location: string | null
  title: string | null
  room: { name: string | null } | null
  participants: Participant[]
}

// --- Helpers ---

function formatDate(dateString: string) {
  const date = new Date(dateString)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"]
  const weekday = weekdays[date.getDay()]
  return {
    date: `${month}/${day}(${weekday})`,
    time: `${hours}:${minutes}`,
  }
}

/** 支払い種別を判定する純粋関数 */
function getTreatType(
  totalAmount: number | null,
  treatAmount: number | null
): "全額奢り" | "一部奢り" | "割り勘" | null {
  if (!totalAmount) return null
  const treat = treatAmount ?? 0
  if (treat >= totalAmount) return "全額奢り"
  if (treat > 0) return "一部奢り"
  return "割り勘"
}

// ダークベースに映えるバッジカラー
const TREAT_TYPE_STYLE: Record<string, string> = {
  "全額奢り": "bg-primary/20 text-primary",
  "一部奢り": "bg-yellow-500/20 text-yellow-400",
  "割り勘":   "bg-white/10 text-muted-foreground",
}

// --- Component ---

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(true)

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch("/api/sessions")
        if (res.status === 401) {
          setIsLoggedIn(false)
          return
        }
        if (res.ok) {
          const data = await res.json()
          setSessions(data)
        }
      } catch {
        // Network error — silently show empty state
      } finally {
        setLoading(false)
      }
    }
    fetchSessions()
  }, [])

  // Computable stats (no profileId dependency)
  const totalPlays = sessions.length
  const withAmountCount = sessions.filter((s) => s.totalAmount != null && s.totalAmount > 0).length
  const avgParticipants =
    totalPlays > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.participants.length, 0) / totalPlays)
      : 0

  return (
    <main className="min-h-screen bg-background">
      {/* App Bar */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-[420px] mx-auto px-4 h-14 flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground -ml-2"
          >
            <Link href="/home">
              <ChevronLeft className="w-5 h-5" />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold text-foreground">履歴</h1>
        </div>
      </header>

      <div className="max-w-[420px] mx-auto px-4 py-6">

        {/* Not logged in */}
        {!isLoggedIn && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
              <Crown className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-foreground font-semibold mb-1">ログインが必要です</p>
            <p className="text-sm text-muted-foreground mb-6">
              履歴を保存するにはGoogleアカウントでログインしてください
            </p>
            <Button asChild className="h-12 px-6 rounded-2xl bg-gradient-accent text-white font-semibold">
              <Link href="/">ログインする</Link>
            </Button>
          </div>
        )}

        {/* Loading */}
        {isLoggedIn && loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Loaded */}
        {isLoggedIn && !loading && (
          <>
            {/* Stats Summary */}
            <section className="mb-6">
              <div className="glass-card rounded-3xl p-6 border border-white/10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-gradient-accent flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">合計統計</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-2xl bg-secondary">
                    <p className="text-3xl font-bold text-foreground">{totalPlays}</p>
                    <p className="text-xs text-muted-foreground mt-1">回プレイ</p>
                  </div>
                  <div className="text-center p-3 rounded-2xl bg-primary/10">
                    <p className="text-3xl font-bold text-primary">{withAmountCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">金額記録</p>
                  </div>
                  <div className="text-center p-3 rounded-2xl bg-secondary">
                    <p className="text-3xl font-bold text-foreground">{avgParticipants}</p>
                    <p className="text-xs text-muted-foreground mt-1">平均人数</p>
                  </div>
                </div>
              </div>
            </section>

            {/* History List */}
            {sessions.length > 0 ? (
              <section>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2 px-1">
                  <Calendar className="w-4 h-4" />
                  過去の結果
                </h2>

                <div className="space-y-3">
                  {sessions.map((session) => {
                    const winner = session.participants.find((p) => p.isWinner)
                    if (!winner) return null

                    const winnerColor = SEGMENT_COLORS[winner.orderIndex % SEGMENT_COLORS.length]
                    const { date, time } = formatDate(session.createdAt)
                    const label = session.room?.name || session.title || session.location || "ルーレット"
                    const treatType = getTreatType(session.totalAmount, session.treatAmount)

                    return (
                      <Link key={session.id} href={`/history/${session.id}`} className="block">
                        <div className="glass-card rounded-3xl p-4 border border-white/10 hover:border-white/20 transition-all active:scale-[0.98]">

                          {/* Header row: date + badge + chevron */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="text-xs text-muted-foreground shrink-0">{date} {time}</p>
                              {treatType && (
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${TREAT_TYPE_STYLE[treatType]}`}>
                                  {treatType}
                                </span>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          </div>

                          {/* Room / label */}
                          <p className="text-sm font-semibold text-foreground mb-3 truncate">{label}</p>

                          {/* Winner + amount row */}
                          <div className="flex items-center justify-between">
                            {/* Winner */}
                            <div className="flex items-center gap-3">
                              <div
                                className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm relative"
                                style={{ backgroundColor: winnerColor }}
                              >
                                {winner.name.charAt(0)}
                                <Crown
                                  className="w-4 h-4 absolute -top-1 -right-1 text-primary drop-shadow-lg"
                                  fill="currentColor"
                                />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">{winner.name}さん</p>
                                <p className="text-xs text-muted-foreground">が奢り</p>
                              </div>
                            </div>

                            {/* Amount */}
                            <div className="text-right">
                              {session.totalAmount ? (
                                <>
                                  <p className="text-sm font-bold text-foreground">
                                    {formatCurrency(session.totalAmount)}
                                  </p>
                                  {session.perPersonAmount != null && session.participants.length > 1 && (
                                    <p className="text-xs text-muted-foreground">
                                      割り勘 {formatCurrency(session.perPersonAmount)}/人
                                    </p>
                                  )}
                                </>
                              ) : (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Users className="w-3 h-3" />
                                  <span className="text-xs">{session.participants.length}人</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Participant avatars row */}
                          {session.participants.length > 0 && (
                            <div className="flex items-center gap-1 mt-3">
                              {session.participants.slice(0, 6).map((p) => (
                                <div
                                  key={p.id}
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold border border-white/20"
                                  style={{ backgroundColor: SEGMENT_COLORS[p.orderIndex % SEGMENT_COLORS.length] }}
                                  title={p.name}
                                >
                                  {p.name.charAt(0)}
                                </div>
                              ))}
                              {session.participants.length > 6 && (
                                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs text-muted-foreground border border-white/10">
                                  +{session.participants.length - 6}
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            ) : (
              /* Empty State */
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="text-foreground font-semibold mb-1">まだ履歴がありません</p>
                <p className="text-sm text-muted-foreground mb-6">
                  ルーレットを回して履歴を作りましょう
                </p>
                <Button asChild className="h-12 px-6 rounded-2xl bg-gradient-accent text-white font-semibold">
                  <Link href="/home">
                    <Sparkles className="w-4 h-4 mr-2" />
                    ルーレットを始める
                  </Link>
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
