"use client"

import { use, useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Crown, Users, Clock, Copy, Check, Share2 } from "lucide-react"
import { SEGMENT_COLORS } from "@/lib/constants"

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
  createdAt: string
  totalAmount: number | null
  treatAmount: number | null
  perPersonAmount: number | null
  location: string | null
  title: string | null
  participants: Participant[]
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return {
    full: `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`,
    time: `${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`,
    weekday: ["日", "月", "火", "水", "木", "金", "土"][date.getDay()],
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(amount)
}

export default function HistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/sessions/${id}`)
        if (res.status === 404 || res.status === 403) {
          setNotFound(true)
          return
        }
        if (res.ok) {
          const data = await res.json()
          setSession(data)
        }
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    fetchSession()
  }, [id])

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  if (notFound || !session) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">セッションが見つかりません</p>
          <Button asChild variant="outline" className="rounded-2xl border-white/10 text-foreground">
            <Link href="/history">履歴に戻る</Link>
          </Button>
        </div>
      </main>
    )
  }

  const winner = session.participants.find((p) => p.isWinner)
  const nonWinners = session.participants.filter((p) => !p.isWinner)
  const winnerColor = winner
    ? SEGMENT_COLORS[winner.orderIndex % SEGMENT_COLORS.length]
    : SEGMENT_COLORS[0]
  const { full, time, weekday } = formatDate(session.createdAt)

  const handleCopy = () => {
    if (!winner) return
    const perPerson = session.perPersonAmount || 0
    const lines = [
      `${winner.name}さん: ${formatCurrency(session.treatAmount || 0)} (奢り)`,
      ...nonWinners.map((p) => `${p.name}さん: ${formatCurrency(perPerson)}`),
    ]
    navigator.clipboard.writeText(lines.join("\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = () => {
    if (!winner) return
    const text = `OgoRouletteで${winner.name}さんが${session.treatAmount ? formatCurrency(session.treatAmount) + "奢り!" : "奢りに決定!"}`
    if (navigator.share) {
      navigator.share({ text, url: window.location.href })
    } else {
      navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      {/* App Bar */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-[420px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground -ml-2"
            >
              <Link href="/history">
                <ChevronLeft className="w-5 h-5" />
              </Link>
            </Button>
            <h1 className="text-lg font-semibold text-foreground">詳細</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            className="text-muted-foreground hover:text-foreground"
          >
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div className="max-w-[420px] mx-auto px-4 py-6 space-y-6">

        {/* Winner Highlight Card */}
        <div className="relative bg-gradient-to-br from-orange-500 via-pink-500 to-purple-500 rounded-3xl p-8 text-white text-center overflow-hidden shadow-xl">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-4 left-4 w-24 h-24 rounded-full bg-white/30 blur-2xl" />
            <div className="absolute bottom-4 right-4 w-32 h-32 rounded-full bg-white/20 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="flex justify-center mb-2">
              <Crown className="w-10 h-10 text-yellow-300 fill-yellow-300/30" />
            </div>
            <div
              className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-3xl font-black mb-3 border-4 border-white/40 shadow-lg"
              style={{ backgroundColor: winnerColor }}
            >
              {winner?.name.charAt(0) ?? "?"}
            </div>
            <h2 className="text-2xl font-black mb-1">{winner?.name ?? "不明"}さん</h2>
            <p className="text-white/80">が奢りました</p>
          </div>
        </div>

        {/* Session Info Card */}
        <div className="glass-card rounded-3xl p-6 border border-white/10">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">セッション情報</h3>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center">
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">日時</p>
                <p className="font-medium text-foreground">{full}（{weekday}）{time}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center">
                <Users className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">参加者</p>
                <p className="font-medium text-foreground">
                  {session.participants.map((p) => p.name).join("・")}（{session.participants.length}人）
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bill Split Summary */}
        {(session.totalAmount || session.treatAmount) && (
          <div className="glass-card rounded-3xl overflow-hidden border border-white/10">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">支払い内訳</h3>

              <div className="space-y-3">
                {session.totalAmount && (
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>合計金額</span>
                    <span className="font-semibold text-foreground">{formatCurrency(session.totalAmount)}</span>
                  </div>
                )}
                {session.treatAmount && (
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>奢り金額</span>
                    <span className="font-semibold text-primary">{formatCurrency(session.treatAmount)}</span>
                  </div>
                )}
                {session.totalAmount && session.treatAmount && (
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>残り（割り勘）</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(session.totalAmount - session.treatAmount)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-muted-foreground">各自の支払い</h4>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "コピーしました" : "コピー"}
                </button>
              </div>

              <div className="space-y-2">
                {/* Winner */}
                {winner && (
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/10 border border-primary/30">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: winnerColor }}
                      >
                        {winner.name.charAt(0)}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{winner.name}</span>
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary text-white">奢り</span>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency(winner.amountToPay || session.treatAmount || 0)}
                    </span>
                  </div>
                )}

                {/* Non-winners */}
                {nonWinners.map((p) => {
                  const color = SEGMENT_COLORS[p.orderIndex % SEGMENT_COLORS.length]
                  return (
                    <div key={p.id} className="flex items-center justify-between p-4 rounded-2xl bg-secondary">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: color }}
                        >
                          {p.name.charAt(0)}
                        </div>
                        <span className="font-medium text-foreground">{p.name}</span>
                      </div>
                      <span className="text-lg font-bold text-foreground">
                        {formatCurrency(p.amountToPay || session.perPersonAmount || 0)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Share Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={() => {
              const text = `OgoRouletteで${winner?.name ?? ""}さんが奢り!`
              window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank")
            }}
            variant="outline"
            className="flex-1 h-12 rounded-2xl border-white/10 bg-secondary hover:bg-secondary/80 text-foreground font-medium"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Xで共有
          </Button>
          <Button
            onClick={() => {
              const text = `OgoRouletteで${winner?.name ?? ""}さんが奢り!`
              window.open(`https://social-plugins.line.me/lineit/share?text=${encodeURIComponent(text)}`, "_blank")
            }}
            variant="outline"
            className="flex-1 h-12 rounded-2xl border-white/10 bg-secondary hover:bg-secondary/80 text-foreground font-medium"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="#06C755">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
            </svg>
            LINEで共有
          </Button>
        </div>

        {/* Back Button */}
        <Button
          asChild
          className="w-full h-14 rounded-2xl bg-gradient-accent hover:opacity-90 text-white font-semibold text-lg transition-all active:scale-[0.98]"
        >
          <Link href="/home">新しいルーレット</Link>
        </Button>
      </div>
    </main>
  )
}
