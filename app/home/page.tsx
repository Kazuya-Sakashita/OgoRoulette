"use client"

import { Button } from "@/components/ui/button"
import { RouletteWheel } from "@/components/roulette-wheel"
import { Confetti } from "@/components/confetti"
import { WinnerCard } from "@/components/winner-card"
import { CountdownOverlay } from "@/components/countdown-overlay"
import { QrCode, Sparkles, Plus, X as XIcon, History, ChevronDown, ChevronUp, Calculator, LogOut } from "lucide-react"
import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { SEGMENT_COLORS } from "@/lib/constants"
import { calculateBillSplit } from "@/lib/bill-calculator"
import { formatCurrency } from "@/lib/format"

export default function HomePage() {
  const [isSpinning, setIsSpinning] = useState(false)
  const [participants, setParticipants] = useState(["A", "B", "C", "D"])
  const [showAddInput, setShowAddInput] = useState(false)
  const [newName, setNewName] = useState("")
  const [winner, setWinner] = useState<{ name: string; index: number } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()

  // Partial Treat Split state
  const [showBillInput, setShowBillInput] = useState(false)
  const [totalBill, setTotalBill] = useState<number>(0)
  const [treatAmount, setTreatAmount] = useState<number>(0)

  const { remainingAmount, splitAmount, isActive: hasBillInput } = calculateBillSplit(
    totalBill,
    treatAmount,
    participants.length
  )

  useEffect(() => {
    const supabase = createClient()
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  useEffect(() => () => clearTimeout(confettiTimerRef.current ?? undefined), [])
  useEffect(() => () => countdownTimersRef.current.forEach(clearTimeout), [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleSpin = () => {
    if (isSpinning || participants.length < 2 || countdown !== null) return
    setWinner(null)
    setCountdown(3)
    countdownTimersRef.current.forEach(clearTimeout)
    countdownTimersRef.current = [
      setTimeout(() => setCountdown(2), 1000),
      setTimeout(() => setCountdown(1), 2000),
      setTimeout(() => { setCountdown(null); setIsSpinning(true) }, 3000),
    ]
  }

  const handleSpinComplete = useCallback((winnerName: string, winnerIndex: number) => {
    setIsSpinning(false)
    setWinner({ name: winnerName, index: winnerIndex })
    setShowConfetti(true)
    clearTimeout(confettiTimerRef.current ?? undefined)
    confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 4000)

    // Save session to DB (fire-and-forget — don't block the UX)
    if (user) {
      fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalAmount: hasBillInput ? totalBill : null,
          treatAmount: hasBillInput ? treatAmount : null,
          perPersonAmount: hasBillInput ? splitAmount : null,
          winnerName,
          winnerIndex,
          participants: participants.map((name, index) => ({
            name,
            color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
            index,
          })),
        }),
      }).catch(() => {
        // Silently ignore — session save failure must not interrupt the spin experience
      })
    }
  }, [user, hasBillInput, totalBill, treatAmount, splitAmount, participants])

  const closeWinnerCard = () => {
    setWinner(null)
  }

  const addParticipant = () => {
    if (newName.trim() && participants.length < 8) {
      setParticipants([...participants, newName.trim()])
      setNewName("")
      setShowAddInput(false)
    }
  }

  const removeParticipant = (index: number) => {
    if (participants.length > 2) {
      setParticipants(participants.filter((_, i) => i !== index))
    }
  }

  // Quick amount presets
  const quickAmounts = [5000, 10000, 15000, 20000]

  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      {/* Countdown overlay — shown before spin starts */}
      <CountdownOverlay countdown={countdown} participants={participants} />

      {/* Confetti effect — intense + winner color during result reveal */}
      <Confetti
        active={showConfetti}
        intense={!!winner}
        winnerColor={winner ? SEGMENT_COLORS[winner.index % SEGMENT_COLORS.length] : undefined}
      />

      {/* Winner Card Modal with payment breakdown */}
      {winner && (
        <WinnerCard
          winner={winner.name}
          winnerIndex={winner.index}
          onClose={closeWinnerCard}
          totalBill={hasBillInput ? totalBill : undefined}
          treatAmount={hasBillInput ? treatAmount : undefined}
          splitAmount={hasBillInput ? splitAmount : undefined}
          participants={participants}
        />
      )}

      {/* Mobile-first container - max 390px as per spec */}
      <div className="mx-auto max-w-[390px] min-h-screen flex flex-col px-5 py-6">

        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Image
              src="/images/logo-icon.png"
              alt="OgoRoulette"
              width={36}
              height={36}
              className="w-9 h-9"
              priority
            />
            <span className="text-lg font-bold tracking-tight">
              <span className="text-foreground">Ogo</span>
              <span className="text-gradient">Roulette</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            {user && (
              <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Link href="/history">
                  <History className="w-5 h-5" />
                </Link>
              </Button>
            )}
            {user ? (
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            ) : (
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm">
                <Link href="/auth/login">
                  ログイン
                </Link>
              </Button>
            )}
          </div>
        </header>

        {/* User greeting if logged in */}
        {user && (
          <div className="mb-4 px-4 py-3 rounded-2xl glass-card border border-white/10">
            <p className="text-sm text-muted-foreground">
              ようこそ、<span className="text-foreground font-medium">{user.user_metadata?.full_name || user.email?.split('@')[0]}</span> さん
            </p>
          </div>
        )}

        {/* Tagline */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-foreground tracking-tight mb-1">
            今日の<span className="text-gradient">奢り</span>は誰だ？
          </h1>
          <p className="text-muted-foreground text-sm">
            楽しく、平和に、運命で決めよう。
          </p>
        </div>

        {/* Social Proof Chips */}
        <div className="flex flex-wrap justify-center gap-2 mb-4">
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20">
            飲み会で盛り上がる
          </span>
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-accent/10 text-accent border border-accent/20">
            すぐ使える
          </span>
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20">
            みんなで参加
          </span>
        </div>

        {/* Partial Treat Split Input */}
        <section className="mb-4">
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
            {showBillInput ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          {showBillInput && (
            <div className="mt-3 p-4 rounded-2xl glass-card border border-white/10 space-y-4">
              {/* Total Bill Input */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  合計金額
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">¥</span>
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

              {/* Treat Amount Input */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  奢り金額（勝者が払う）
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">¥</span>
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

                {/* Quick amount buttons */}
                <div className="flex gap-2 mt-3">
                  {quickAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setTreatAmount(Math.min(amount, totalBill || amount))}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                        treatAmount === amount
                          ? 'bg-gradient-accent text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:text-foreground border border-white/10'
                      }`}
                    >
                      ¥{amount.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Calculation Preview */}
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
                    <div className="flex justify-between">
                      <span className="opacity-80">残り</span>
                      <span className="font-semibold">{formatCurrency(remainingAmount)}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="font-medium">1人あたり（÷{participants.length - 1}人）</span>
                      <span className="text-lg font-bold">{formatCurrency(splitAmount)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Roulette Wheel - Centerpiece */}
        <div className="flex-1 flex flex-col items-center justify-center py-4">
          <div className="relative mb-6">
            {/* Ambient background glow */}
            <div className="absolute inset-0 scale-[1.6] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

            <RouletteWheel
              isSpinning={isSpinning}
              size={280}
              participants={participants}
              onSpinComplete={handleSpinComplete}
            />
          </div>

          {/* SPIN Button */}
          <Button
            onClick={handleSpin}
            disabled={isSpinning || participants.length < 2 || countdown !== null}
            className="w-full max-w-[280px] h-16 text-xl font-bold rounded-2xl bg-gradient-accent hover:opacity-90 text-white shadow-lg glow-primary press-effect disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase tracking-wider animate-pulse-glow"
          >
            {isSpinning ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                回転中...
              </span>
            ) : (
              "SPIN"
            )}
          </Button>
        </div>

        {/* Participants Section */}
        <section className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              参加者
            </h2>
            <span className="text-xs text-muted-foreground">
              {participants.length}/8人
            </span>
          </div>

          {/* Participant list */}
          <div className="flex flex-wrap gap-2 mb-3">
            {participants.map((name, index) => (
              <div
                key={index}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-full glass-card border border-white/10 transition-all hover:border-primary/30"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground"
                  style={{
                    background: `linear-gradient(135deg, ${['#F59E0B', '#F43F5E', '#8B5CF6', '#3B82F6', '#22C55E', '#FBBF24'][index % 6]}, ${['#FBBF24', '#FB7185', '#A78BFA', '#60A5FA', '#4ADE80', '#FCD34D'][index % 6]})`
                  }}
                >
                  {name.charAt(0)}
                </div>
                <span className="text-sm font-medium text-foreground">{name}</span>
                {participants.length > 2 && (
                  <button
                    onClick={() => removeParticipant(index)}
                    className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-destructive/20 flex items-center justify-center text-destructive hover:bg-destructive/30 transition-all"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add participant */}
          {showAddInput ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
                placeholder="名前を入力"
                maxLength={10}
                className="flex-1 h-10 px-4 rounded-xl bg-secondary border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                autoFocus
              />
              <Button
                onClick={addParticipant}
                disabled={!newName.trim()}
                className="h-10 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm"
              >
                追加
              </Button>
              <Button
                onClick={() => { setShowAddInput(false); setNewName(""); }}
                variant="ghost"
                className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground"
              >
                <XIcon className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setShowAddInput(true)}
              disabled={participants.length >= 8}
              variant="outline"
              className="w-full h-10 rounded-xl border-dashed border-white/20 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all text-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              プレイヤーを追加
            </Button>
          )}
        </section>

        {/* Bottom Actions */}
        <section className="mt-6 space-y-3">
          <Button
            asChild
            className="w-full h-14 rounded-2xl bg-gradient-accent hover:opacity-90 text-primary-foreground font-bold press-effect text-base"
          >
            <Link href="/room/create">
              <Sparkles className="w-5 h-5 mr-2" />
              ルームを作成
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full h-12 rounded-xl border-white/10 bg-secondary hover:bg-white/10 text-foreground font-semibold press-effect text-sm"
          >
            <Link href="/scan">
              <QrCode className="w-4 h-4 mr-2" />
              QRで参加
            </Link>
          </Button>
        </section>

        {/* Footer */}
        <footer className="mt-6 pt-4 border-t border-white/5">
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">プライバシー</Link>
            <span>・</span>
            <Link href="/terms" className="hover:text-foreground transition-colors">利用規約</Link>
            <span>・</span>
            <Link href="/how-to-use" className="hover:text-foreground transition-colors">使い方</Link>
            <span>・</span>
            <Link href="/help" className="hover:text-foreground transition-colors">ヘルプ</Link>
          </div>
          <p className="text-center text-xs text-muted-foreground/60 mt-2">
            © 2026 OgoRoulette
          </p>
        </footer>
      </div>
    </main>
  )
}
