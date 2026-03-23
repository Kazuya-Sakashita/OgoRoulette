"use client"

import { useEffect, useRef, useState, useMemo, use } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { calculateBillSplit } from "@/lib/bill-calculator"
import { isRoomOwner } from "@/lib/room-owner"
import { isSpinInProgress } from "@/lib/room-spin"
import { vibrate, HapticPattern } from "@/lib/haptic"
import { playPressSound, playSpinStartSound, playTickSound, playResultSound } from "@/lib/spin-sound"
import Link from "next/link"
import { ArrowLeft, Calculator, ChevronDown, ChevronUp, Crown, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RouletteWheel } from "@/components/roulette-wheel"
import { WinnerCard } from "@/components/winner-card"
import { Confetti } from "@/components/confetti"
import { CountdownOverlay } from "@/components/countdown-overlay"
import { createClient } from "@/lib/supabase/client"
import { SEGMENT_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/format"
import type { User } from "@supabase/supabase-js"

// --- Types ---

// Phase state machine: waiting → preparing → spinning → result
// waiting:   初期状態。SPINボタン押下可能。
// preparing: オーナーがAPI呼び出し中 / メンバーが spinStartedAt まで待機中。
// spinning:  ルーレットアニメーション実行中。
// result:    当選者決定。WinnerCard 表示。
type Phase = "waiting" | "preparing" | "spinning" | "result"

interface Member {
  id: string
  nickname: string | null
  color: string
  isHost: boolean
  profile: { id: string; name: string | null; avatarUrl: string | null } | null
}

interface SessionWinner {
  name: string
  isWinner: boolean
  color: string
  orderIndex: number
}

interface Session {
  id: string
  status: string
  startedAt: string | null
  totalAmount: number | null
  treatAmount: number | null
  perPersonAmount: number | null
  participants: SessionWinner[]
}

interface Room {
  id: string
  name: string | null
  inviteCode: string
  maxMembers: number
  status: string
  members: Member[]
  sessions: Session[]
  _count: { members: number }
}

interface WinnerData {
  name: string
  index: number
  totalAmount?: number
  treatAmount?: number
  perPersonAmount?: number
}

// --- Helpers ---

function getMemberName(member: Member): string {
  return member.nickname || member.profile?.name || "ゲスト"
}

// --- Component ---

export default function RoomPlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)

  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)

  // Phase-based roulette state
  const [phase, setPhase] = useState<Phase>("waiting")
  const [spinError, setSpinError] = useState<string | null>(null)
  const [pendingWinnerIndex, setPendingWinnerIndex] = useState<number | undefined>(undefined)
  const [winner, setWinner] = useState<WinnerData | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)

  // Bill input
  const [showBillInput, setShowBillInput] = useState(false)
  const [totalBill, setTotalBill] = useState(0)
  const [treatAmount, setTreatAmount] = useState(0)

  // Tracks latest known session ID to detect new results across polls
  const prevSessionIdRef = useRef<string | null | undefined>(undefined)
  // Prevents double-scheduling the animation setTimeout (owner and member share this guard)
  const spinScheduledRef = useRef(false)
  // Member: stores server-confirmed winner while local wheel animation runs
  const pendingMemberWinnerRef = useRef<WinnerData | null>(null)

  // Countdown display — driven by spinStartedAtMs vs Date.now()
  const [spinStartedAtMs, setSpinStartedAtMs] = useState<number | null>(null)
  const [countdownValue, setCountdownValue] = useState<number | null>(null)

  // Guest host detection
  const [isGuestHost, setIsGuestHost] = useState(false)
  // Guest host token — used as X-Guest-Host-Token header for server-side auth
  const guestHostTokenRef = useRef<string | null>(null)
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // --- Derived ---

  const membersKey = room?.members.map(getMemberName).join("\0") ?? ""
  const participants = useMemo(
    () => (membersKey ? membersKey.split("\0") : []),
    [membersKey]
  )

  const isOwner = currentUser
    ? isRoomOwner(room?.members ?? [], currentUser.id)
    : isGuestHost

  const isCompleted = room?.status === "COMPLETED"

  const { splitAmount, isActive: hasBillInput } = calculateBillSplit(
    totalBill,
    treatAmount,
    participants.length
  )

  const quickAmounts = [5000, 10000, 15000, 20000]

  // --- Effects ---

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user)
      setAuthLoaded(true)
    })
  }, [])

  const fetchRoom = async () => {
    try {
      const res = await fetch(`/api/rooms/${code}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "ルームが見つかりません")
        return
      }

      // Skip re-render when key fields are unchanged (avoids unnecessary effects)
      setRoom(prev => {
        if (
          prev &&
          prev.status === data.status &&
          prev._count.members === data._count.members &&
          (prev.sessions?.length ?? 0) === (data.sessions?.length ?? 0)
        ) return prev
        return data
      })
    } catch {
      setError("ルームの取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  // Always poll — phase-based detection (spinScheduledRef / prevSessionIdRef) prevents re-triggering
  useEffect(() => {
    fetchRoom()
    const interval = setInterval(() => fetchRoom(), 3000)
    return () => clearInterval(interval)
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(confettiTimerRef.current ?? undefined), [])

  // Drive countdown display from spinStartedAtMs while in preparing phase.
  // Polls at 200 ms for smooth second-level accuracy.
  useEffect(() => {
    if (phase !== "preparing" || spinStartedAtMs === null) {
      setCountdownValue(null)
      return
    }
    const tick = () => {
      const remaining = spinStartedAtMs - Date.now()
      if (remaining <= 0) {
        setCountdownValue(null)
        return
      }
      setCountdownValue(Math.ceil(remaining / 1000))
    }
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [phase, spinStartedAtMs])

  // スピン中のページ離脱を警告する
  useEffect(() => {
    if (phase !== "spinning" && phase !== "preparing") return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [phase])

  useEffect(() => {
    if (!room) return
    const stored: string[] = JSON.parse(
      localStorage.getItem("ogoroulette_host_rooms") || "[]"
    )
    setIsGuestHost(stored.includes(room.inviteCode))
    guestHostTokenRef.current = localStorage.getItem(`ogoroulette_host_token_${room.inviteCode}`)
  }, [room?.inviteCode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ゲストホスト専用: サーバー認可用ヘッダーを組み立てる
  const buildGuestAuthHeaders = (): Record<string, string> => {
    if (currentUser || !guestHostTokenRef.current) return {}
    return { "X-Guest-Host-Token": guestHostTokenRef.current }
  }

  // Member: react to polling results, sync animation start to server's spinStartedAt
  useEffect(() => {
    if (!room || isOwner) return

    const latestSession = room.sessions?.[0] ?? null
    const latestId = latestSession?.id ?? null

    // Schedule animation aligned to server spinStartedAt
    // spinScheduledRef prevents double-scheduling on consecutive polls
    const scheduleSpin = (session: Session) => {
      if (spinScheduledRef.current) return
      const wp = session.participants?.find((p) => p.isWinner)
      if (!wp) return

      pendingMemberWinnerRef.current = {
        name: wp.name,
        index: wp.orderIndex,
        totalAmount: session.totalAmount ?? undefined,
        treatAmount: session.treatAmount ?? undefined,
        perPersonAmount: session.perPersonAmount ?? undefined,
      }
      setPendingWinnerIndex(wp.orderIndex)

      // Align to server spinStartedAt — if in the past, starts immediately
      const startMs = session.startedAt ? new Date(session.startedAt).getTime() : Date.now()
      const delay = Math.max(0, startMs - Date.now())
      setSpinStartedAtMs(startMs)
      spinScheduledRef.current = true
      setPhase("preparing")
      setTimeout(() => setPhase("spinning"), delay)
    }

    // First load
    if (prevSessionIdRef.current === undefined) {
      prevSessionIdRef.current = latestId

      if (latestSession) {
        if (room.status === "COMPLETED") {
          // Reload of finished room → show without animation
          const wp = latestSession.participants?.find((p) => p.isWinner)
          if (wp) {
            setWinner({
              name: wp.name,
              index: wp.orderIndex,
              totalAmount: latestSession.totalAmount ?? undefined,
              treatAmount: latestSession.treatAmount ?? undefined,
              perPersonAmount: latestSession.perPersonAmount ?? undefined,
            })
            setPhase("result")
          }
        } else if (room.status === "IN_SESSION") {
          // Mid-spin join → schedule using startedAt
          scheduleSpin(latestSession)
        }
      }
      return
    }

    // Subsequent polls: detect new session
    if (latestId && latestId !== prevSessionIdRef.current) {
      prevSessionIdRef.current = latestId
      if (latestSession) scheduleSpin(latestSession)
    } else {
      prevSessionIdRef.current = latestId
    }
  }, [room, isOwner]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Handlers ---

  // 減速フェーズ（結果直前）の演出: tick 音 × 3回 + 振動
  const handleSlowingDown = () => {
    const delays = [0, 500, 950]
    delays.forEach((d) => {
      setTimeout(() => {
        playTickSound()
        vibrate(HapticPattern.tick)
      }, d)
    })
  }

  // 回転開始直後の演出（RouletteWheel からコールバック）
  const handleSpinStart = () => {
    playSpinStartSound()
    vibrate(HapticPattern.start)
  }

  const handleSpin = async () => {
    if (phase !== "waiting" || participants.length < 2) return

    // 押下フィードバック（音・振動）は即時
    playPressSound()
    vibrate(HapticPattern.press)

    setSpinError(null)
    setPhase("preparing")
    setWinner(null)
    spinScheduledRef.current = false

    try {
      const res = await fetch(`/api/rooms/${code}/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildGuestAuthHeaders() },
        body: JSON.stringify({
          totalAmount: hasBillInput ? totalBill : null,
          treatAmount: hasBillInput ? treatAmount : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setSpinError(data.error || "スピンに失敗しました")
        setPhase("waiting")
        return
      }

      const data = await res.json()
      // サーバーが決定した spinStartedAt まで待ってからアニメーション開始
      const delay = Math.max(0, data.spinStartedAt - Date.now())
      setSpinStartedAtMs(data.spinStartedAt)
      setPendingWinnerIndex(data.winnerIndex)
      setTimeout(() => {
        if (!spinScheduledRef.current) {
          spinScheduledRef.current = true
          setPhase("spinning")
        }
      }, delay)
    } catch {
      setSpinError("ネットワークエラーが発生しました")
      setPhase("waiting")
    }
  }

  const handleRespin = async () => {
    setWinner(null)
    setPhase("waiting")
    setPendingWinnerIndex(undefined)
    setSpinError(null)
    setSpinStartedAtMs(null)
    spinScheduledRef.current = false
    prevSessionIdRef.current = null
    pendingMemberWinnerRef.current = null

    try {
      const res = await fetch(`/api/rooms/${code}/reset`, {
        method: "POST",
        headers: buildGuestAuthHeaders(),
      })
      if (res.ok) {
        setRoom(prev => prev ? { ...prev, status: "WAITING", sessions: [] } : prev)
      } else {
        const data = await res.json()
        setSpinError(data.error || "リセットに失敗しました")
      }
    } catch {
      setSpinError("ネットワークエラーが発生しました")
    }
  }

  const showResult = () => {
    const latestSession = room?.sessions?.[0]
    if (!latestSession) return
    const wp = latestSession.participants?.find((p) => p.isWinner)
    if (wp) {
      setWinner({
        name: wp.name,
        index: wp.orderIndex,
        totalAmount: latestSession.totalAmount ?? undefined,
        treatAmount: latestSession.treatAmount ?? undefined,
        perPersonAmount: latestSession.perPersonAmount ?? undefined,
      })
      setPhase("result")
    }
  }

  const handleSpinComplete = (winnerName: string, winnerIndex: number) => {
    setPhase("result")
    spinScheduledRef.current = false
    setPendingWinnerIndex(undefined)

    if (isOwner) {
      setWinner({
        name: winnerName,
        index: winnerIndex,
        totalAmount: hasBillInput ? totalBill : undefined,
        treatAmount: hasBillInput ? treatAmount : undefined,
        perPersonAmount: hasBillInput ? splitAmount : undefined,
      })
      playResultSound()
      vibrate(HapticPattern.result)
      setShowConfetti(true)
      clearTimeout(confettiTimerRef.current ?? undefined)
      confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 4000)
      // ルームとセッションを COMPLETED にする（非クリティカル: ポーリングでメンバーに伝わる）
      fetch(`/api/rooms/${code}/spin-complete`, {
        method: "POST",
        headers: buildGuestAuthHeaders(),
      }).catch(() => {})
    } else {
      // Member: サーバー確定の当選者を使う
      const serverWinner = pendingMemberWinnerRef.current
      if (serverWinner) {
        setWinner(serverWinner)
        pendingMemberWinnerRef.current = null
        playResultSound()
        vibrate(HapticPattern.result)
        setShowConfetti(true)
        clearTimeout(confettiTimerRef.current ?? undefined)
        confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 4000)
      }
    }
  }

  // --- Render: loading / error ---

  if (loading || !authLoaded) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </main>
    )
  }

  if (error || !room) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-[390px] min-h-screen flex flex-col px-5 py-6">
          <header className="flex items-center gap-4 mb-8">
            <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
              <Link href="/home">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button asChild>
              <Link href={`/room/${code}`}>ルームに戻る</Link>
            </Button>
          </div>
        </div>
      </main>
    )
  }

  // --- Render: main ---

  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Confetti
        active={showConfetti}
        intense={!!winner}
        winnerColor={winner ? SEGMENT_COLORS[winner.index % SEGMENT_COLORS.length] : undefined}
      />

      {/* Countdown overlay — shows 3→2→1 during preparing phase */}
      <CountdownOverlay
        countdown={countdownValue}
        participants={participants}
        memberCount={room._count.members}
      />

      {winner && (
        <WinnerCard
          winner={winner.name}
          winnerIndex={winner.index}
          onClose={() => {
            setWinner(null)
            setPhase("waiting")
          }}
          totalBill={winner.totalAmount}
          treatAmount={winner.treatAmount}
          splitAmount={winner.perPersonAmount}
          participants={participants}
          isOwner={isOwner}
          roomCode={code}
          onRespin={isOwner ? handleRespin : undefined}
        />
      )}

      <div className="mx-auto max-w-[390px] min-h-screen flex flex-col px-5 py-6">

        {/* Header */}
        <header className="flex items-center gap-3 mb-4">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <Link href="/home">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <Link href={`/room/${code}`} className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">
              {room.name || "ルーレット"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isOwner ? "オーナー" : "参加中"} · {room._count.members}人
            </p>
          </Link>
        </header>

        {/* Participants */}
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              参加者
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {room.members.map((member, index) => (
              <div
                key={member.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-card border border-white/10"
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                >
                  {getMemberName(member).charAt(0)}
                </div>
                <span className="text-sm font-medium text-foreground">
                  {getMemberName(member)}
                </span>
                {member.isHost && <Crown className="w-3 h-3 text-primary" />}
              </div>
            ))}
          </div>
        </section>

        {/* Bill input — hidden while spinning or in result */}
        <section className={`mb-4 ${phase !== "waiting" ? "hidden" : ""}`}>
          <button
            onClick={() => setShowBillInput(!showBillInput)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl glass-card border border-white/10 hover:border-primary/30 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-accent flex items-center justify-center">
                <Calculator className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="text-left">
                <span className="text-sm font-medium text-foreground">金額を設定</span>
                {hasBillInput && (
                  <p className="text-xs text-muted-foreground">
                    奢り {formatCurrency(treatAmount)} / 割り勘 {formatCurrency(splitAmount)}
                  </p>
                )}
              </div>
            </div>
            {showBillInput
              ? <ChevronUp className="w-5 h-5 text-muted-foreground" />
              : <ChevronDown className="w-5 h-5 text-muted-foreground" />
            }
          </button>

          {showBillInput && (
            <div className="mt-3 p-4 rounded-2xl glass-card border border-white/10 space-y-4">
              {/* Total bill */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  合計金額
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">
                    ¥
                  </span>
                  <input
                    type="number"
                    value={totalBill || ""}
                    min="0"
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value))
                      setTotalBill(val)
                      if (treatAmount > val) setTreatAmount(val)
                    }}
                    className="w-full h-12 pl-9 pr-4 text-xl font-bold text-foreground bg-secondary rounded-xl border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    placeholder="30000"
                  />
                </div>
              </div>

              {/* Treat amount */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  奢り金額（勝者が払う）
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">
                    ¥
                  </span>
                  <input
                    type="number"
                    value={treatAmount || ""}
                    min="0"
                    max={totalBill}
                    onChange={(e) =>
                      setTreatAmount(Math.min(Math.max(0, Number(e.target.value)), totalBill))
                    }
                    className="w-full h-12 pl-9 pr-4 text-xl font-bold text-foreground bg-secondary rounded-xl border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    placeholder="20000"
                  />
                </div>
                <div className="flex gap-2 mt-3">
                  {quickAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() =>
                        setTreatAmount(Math.min(amount, totalBill || amount))
                      }
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                        treatAmount === amount
                          ? "bg-gradient-accent text-primary-foreground"
                          : "bg-secondary text-muted-foreground hover:text-foreground border border-white/10"
                      }`}
                    >
                      ¥{amount.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live preview */}
              {hasBillInput && (
                <div className="p-4 rounded-xl bg-gradient-accent text-primary-foreground">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="opacity-80">合計</span>
                      <span className="font-semibold">{formatCurrency(totalBill)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-80">奢り</span>
                      <span className="font-semibold">- {formatCurrency(treatAmount)}</span>
                    </div>
                    <div className="h-px bg-white/30" />
                    <div className="flex justify-between pt-1">
                      <span className="font-medium">1人あたり</span>
                      <span className="text-lg font-bold">{formatCurrency(splitAmount)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Roulette wheel */}
        <div className="flex-1 flex flex-col items-center justify-center py-4">
          {/* ホイール周囲のグロー: spinning 中に拡大 */}
          <div className="relative mb-6">
            <motion.div
              className="absolute inset-0 rounded-full pointer-events-none"
              animate={{
                scale: phase === "spinning" ? [1.5, 1.7, 1.5] : 1.5,
                opacity: phase === "spinning" ? [0.15, 0.25, 0.15] : 0.1,
              }}
              transition={phase === "spinning"
                ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.5 }
              }
              style={{ background: "radial-gradient(circle, #F97316 0%, transparent 70%)", filter: "blur(30px)" }}
            />
            <RouletteWheel
              isSpinning={phase === "spinning"}
              size={280}
              participants={participants}
              targetWinnerIndex={pendingWinnerIndex}
              onSpinComplete={handleSpinComplete}
              onSpinStart={handleSpinStart}
              onSlowingDown={handleSlowingDown}
            />
          </div>

          {spinError && (
            <p className="text-sm text-red-400 text-center mb-3 px-4">{spinError}</p>
          )}

          <AnimatePresence mode="wait">
            {isCompleted ? (
              <motion.div
                key="completed"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 w-full max-w-[280px]"
              >
                <Button
                  onClick={showResult}
                  className="w-full h-14 text-base font-bold rounded-2xl bg-gradient-accent hover:opacity-90 text-white shadow-lg transition-all"
                >
                  結果を見る
                </Button>
                <Button
                  asChild
                  className="w-full h-12 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all"
                >
                  <Link href="/home">ホームへ戻る</Link>
                </Button>
                {isOwner && (
                  <Button
                    asChild
                    variant="outline"
                    className="w-full h-12 rounded-2xl border-white/20 text-muted-foreground hover:text-foreground transition-all"
                  >
                    <Link href="/room/create">新しい抽選を作る</Link>
                  </Button>
                )}
              </motion.div>
            ) : isOwner ? (
              <motion.button
                key="spin-btn"
                onClick={handleSpin}
                disabled={phase !== "waiting" || participants.length < 2}
                className="w-full max-w-[280px] h-16 text-xl font-bold rounded-2xl bg-gradient-accent text-white shadow-lg glow-primary disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                // 待機中: ゆったりした呼吸感。押下中: scale down。準備中以降: アニメーション停止。
                animate={
                  phase === "waiting"
                    ? { scale: [1, 1.025, 1], boxShadow: ["0 0 20px rgba(249,115,22,0.3)", "0 0 35px rgba(249,115,22,0.6)", "0 0 20px rgba(249,115,22,0.3)"] }
                    : { scale: 1, boxShadow: "0 0 20px rgba(249,115,22,0.3)" }
                }
                transition={phase === "waiting"
                  ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.2 }
                }
                whileTap={{ scale: 0.93 }}
              >
                <AnimatePresence mode="wait">
                  {phase === "preparing" ? (
                    <motion.span
                      key="preparing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2"
                    >
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      準備中...
                    </motion.span>
                  ) : phase === "spinning" ? (
                    <motion.span
                      key="spinning"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2"
                    >
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      回転中...
                    </motion.span>
                  ) : (
                    <motion.span
                      key="ready"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                    >
                      🎯 運命を回す
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            ) : (
              // メンバー待機表示
              <motion.div
                key="member-waiting"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-center py-5 px-6 rounded-2xl glass-card border w-full max-w-[280px] transition-colors duration-500 ${
                  isSpinInProgress(room.status) || phase === "preparing" || phase === "spinning"
                    ? "border-primary/40"
                    : "border-white/10"
                }`}
              >
                {isSpinInProgress(room.status) || phase === "preparing" || phase === "spinning" ? (
                  <>
                    <motion.div
                      className="w-3 h-3 rounded-full bg-green-400 mx-auto mb-3"
                      animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                    <p className="text-sm font-semibold text-primary">スピン中！</p>
                  </>
                ) : (
                  <>
                    <motion.div
                      className="w-3 h-3 rounded-full bg-primary mx-auto mb-3"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <p className="text-base font-bold text-foreground tracking-wide">
                      誰が奢る
                      <motion.span
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      >
                        …？
                      </motion.span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">オーナーの回転を待っています</p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  )
}
