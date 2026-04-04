"use client"

import { useEffect, useRef, useState, useMemo, use } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { isRoomOwner } from "@/lib/room-owner"
import { isSpinInProgress } from "@/lib/room-spin"
import Link from "next/link"
import { ArrowLeft, Calculator, ChevronDown, ChevronUp, Crown, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RouletteWheel } from "@/components/roulette-wheel"
import { WinnerCard } from "@/components/winner-card"
import { Confetti } from "@/components/confetti"
import { PrismBurst } from "@/components/prism-burst"
import { CountdownOverlay } from "@/components/countdown-overlay"
import { createClient } from "@/lib/supabase/client"
import { getDisplayName } from "@/lib/display-name"
import { SEGMENT_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/format"
import { getTreatTitle } from "@/lib/group-storage"
import { useGroups } from "@/hooks/use-groups"
import { RecordingCanvas } from "@/components/recording-canvas"
import { ShareSheet } from "@/components/share-sheet"
import { useVideoRecorder } from "@/lib/use-video-recorder"
import type { User } from "@supabase/supabase-js"
import type { Member } from "./types"
import { useRoomSync } from "./use-room-sync"
import { useBill, QUICK_AMOUNTS } from "./use-bill"
import { useSpin } from "./use-spin"

// ISSUE-090: profile.name（プロバイダ由来名）は使わない。公開名を優先する。
function getMemberName(member: Member): string {
  return member.nickname || (member.profile ? getDisplayName(member.profile) : "ゲスト")
}

export default function RoomPlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [isGuestHost, setIsGuestHost] = useState(false)
  const [isGuestHostResolved, setIsGuestHostResolved] = useState(false)
  const guestHostTokenRef = useRef<string | null>(null)

  // ISSUE-141: モバイル端末の実表示域に合わせてルーレットサイズを動的に調整する
  const [wheelSize, setWheelSize] = useState(280)

  // --- Room sync ---
  const { room, setRoom, loading, error, fetchRoom, fetchRanking, roomRanking } = useRoomSync(code)

  // --- Auth ---
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user)
      setAuthLoaded(true)
    })
  }, [])

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
  const expiresAtMs = room?.expiresAt ? new Date(room.expiresAt).getTime() : null
  const isExpired = expiresAtMs !== null && expiresAtMs < Date.now()
  const isExpiringSoon = expiresAtMs !== null && !isExpired && expiresAtMs - Date.now() < 24 * 60 * 60 * 1000

  // --- Bill ---
  const {
    showBillInput, setShowBillInput,
    totalBill, treatAmount, setTreatAmount,
    splitAmount, hasBillInput,
    handleTotalBillChange, handleTreatAmountChange,
  } = useBill(participants.length)

  // --- Video recording ---
  const {
    recordingPhase, setRecordingPhase,
    recordedBlob, showShareSheet, setShowShareSheet,
    recordingCanvasRef, wheelRotationRef,
    startRecording, stopRecordingAfterReveal,
    reset: resetRecording, isRecording,
  } = useVideoRecorder()

  // --- Group save ---
  const { groups: savedGroups, saveGroup } = useGroups(currentUser)
  const isCurrentGroupSaved = savedGroups.some(
    (g) =>
      g.participants.length === participants.length &&
      [...g.participants].sort().join() === [...participants].sort().join()
  )
  const handleSaveGroup = async (name: string) => saveGroup(name, participants)

  // --- Spin ---
  const {
    phase, setPhase,
    spinError, pendingWinnerIndex,
    winner, setWinner,
    showConfetti, showPrismBurst, confettiBurstKey,
    spinStartedAtMs, spinRemainingMs,
    countdownValue,
    handleSpin, handleRespin: handleRespinBase,
    showResult, handleSpinComplete,
    handleDetailsPhase,
    handleSlowingDown, handleNearMiss, handleSpinStart,
  } = useSpin({
    code, room, isOwner, currentUser,
    guestHostTokenRef,
    participants,
    hasBillInput, totalBill, treatAmount, splitAmount,
    fetchRoom, fetchRanking,
    stopRecordingAfterReveal, resetRecording,
    setRecordingPhase, startRecording,
  })

  // handleRespin に楽観的更新（setRoom）を組み合わせる
  const handleRespin = async () => {
    setRoom(prev => prev ? { ...prev, status: "WAITING", sessions: [] } : prev)
    await handleRespinBase()
    try {
      const token = guestHostTokenRef.current
      const headers: Record<string, string> = token ? { "X-Guest-Host-Token": token } : {}
      const res = await fetch(`/api/rooms/${code}/reset`, { method: "POST", headers })
      if (!res.ok) {
        const data = await res.json()
        // スピンエラー表示はuse-spin内のsetSpinErrorがないためfetchRoomで最新化
        await fetchRoom()
        console.warn("[OgoRoulette] respin reset failed:", data.error)
      }
    } catch {
      await fetchRoom()
    }
  }

  // --- Effects ---

  // ISSUE-141: ビューポートサイズに合わせてルーレットホイールのサイズを動的に計算する
  useEffect(() => {
    const RESERVED_HEIGHT = 440
    const update = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const byWidth = Math.min(360, vw - 40)
      const byHeight = Math.min(360, vh - RESERVED_HEIGHT)
      setWheelSize(Math.max(200, Math.min(byWidth, byHeight)))
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  useEffect(() => {
    if (currentUser) { setIsGuestHostResolved(true); return }
    if (!room) return
    const stored: string[] = JSON.parse(localStorage.getItem("ogoroulette_host_rooms") || "[]")
    setIsGuestHost(stored.includes(room.inviteCode))
    guestHostTokenRef.current = localStorage.getItem(`ogoroulette_host_token_${room.inviteCode}`)
    setIsGuestHostResolved(true)
  }, [room?.inviteCode, currentUser]) // eslint-disable-line react-hooks/exhaustive-deps

  // スピン中のページ離脱を警告する
  useEffect(() => {
    if (phase !== "spinning" && phase !== "preparing") return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [phase])

  // ISSUE-045: オーナーがスピン中にページを離脱したとき room を WAITING にリセットする
  useEffect(() => {
    if ((phase !== "spinning" && phase !== "preparing") || !isOwner) return
    const handlePageHide = () => {
      const url = `/api/rooms/${code}/reset`
      const token = guestHostTokenRef.current
      if (token) {
        navigator.sendBeacon(url, new Blob([JSON.stringify({ guestToken: token })], { type: "application/json" }))
      } else {
        navigator.sendBeacon(url)
      }
    }
    window.addEventListener("pagehide", handlePageHide)
    return () => window.removeEventListener("pagehide", handlePageHide)
  }, [phase, isOwner, code])

  // --- Render: loading / error ---

  if (loading || !authLoaded || !isGuestHostResolved) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-[390px] md:max-w-lg min-h-dvh flex flex-col px-5 py-6">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-9 h-9 rounded-xl bg-white/10 animate-pulse" />
            <div className="h-5 w-32 rounded-full bg-white/10 animate-pulse" />
            <div className="ml-auto h-5 w-16 rounded-full bg-white/10 animate-pulse" />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-0">
            <div className="rounded-full bg-white/10 animate-pulse" style={{ width: wheelSize, height: wheelSize }} />
            <div className="w-64 h-16 rounded-2xl bg-white/10 animate-pulse" />
          </div>
        </div>
      </main>
    )
  }

  if (error || !room) {
    const isExpiredError = error === "expired"
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-[390px] md:max-w-lg min-h-dvh flex flex-col px-5 py-6">
          <header className="flex items-center gap-4 mb-8">
            <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
              <Link href="/home"><ArrowLeft className="w-5 h-5" /></Link>
            </Button>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-muted-foreground mb-4">
              {isExpiredError ? "このルームは有効期限が切れています" : error}
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              {isExpiredError && (
                <Button asChild className="bg-gradient-accent text-primary-foreground">
                  <Link href="/room/create">新しいルームを作る</Link>
                </Button>
              )}
              <Button asChild variant={isExpiredError ? "outline" : "default"}>
                <Link href="/home">ホームに戻る</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // --- Render: main ---

  return (
    <main className="min-h-screen bg-background overflow-x-clip">
      <RecordingCanvas
        phase={recordingPhase}
        countdown={countdownValue}
        wheelRotationRef={wheelRotationRef}
        participants={participants}
        winnerIndex={winner?.index ?? null}
        winner={winner?.name ?? null}
        winnerColor={winner ? SEGMENT_COLORS[winner.index % SEGMENT_COLORS.length] : SEGMENT_COLORS[0]}
        canvasRef={recordingCanvasRef}
      />

      {isRecording && (
        <div className="fixed top-4 right-4 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/90 text-white text-xs font-bold animate-pulse pointer-events-none">
          ● REC
        </div>
      )}

      {showShareSheet && recordedBlob && winner && (
        <ShareSheet
          blob={recordedBlob}
          winner={winner.name}
          winnerColor={SEGMENT_COLORS[winner.index % SEGMENT_COLORS.length]}
          onClose={() => setShowShareSheet(false)}
          onRespin={isOwner ? () => { resetRecording(); handleRespin() } : undefined}
        />
      )}

      <PrismBurst
        active={showPrismBurst}
        winnerColor={winner ? SEGMENT_COLORS[winner.index % SEGMENT_COLORS.length] : undefined}
      />

      <Confetti
        key={confettiBurstKey}
        active={showConfetti}
        intense={confettiBurstKey === 0 && !!winner}
        winnerColor={winner ? SEGMENT_COLORS[winner.index % SEGMENT_COLORS.length] : undefined}
      />

      <CountdownOverlay
        countdown={countdownValue}
        participants={participants}
        memberCount={room._count.members}
      />

      {winner && (
        <WinnerCard
          winner={winner.name}
          winnerIndex={winner.index}
          onClose={() => { setWinner(null); setPhase("waiting"); resetRecording() }}
          totalBill={winner.totalAmount}
          treatAmount={winner.treatAmount}
          splitAmount={winner.perPersonAmount}
          participants={participants}
          isOwner={isOwner}
          roomCode={code}
          onRespin={isOwner ? handleRespin : undefined}
          treatCount={roomRanking?.find((r) => r.name === winner.name)?.count}
          treatTitle={(() => {
            const c = roomRanking?.find((r) => r.name === winner.name)?.count
            return c ? getTreatTitle(c) : undefined
          })()}
          ranking={roomRanking}
          videoBlob={recordedBlob}
          onShareVideo={() => setShowShareSheet(true)}
          recordingCanvasRef={recordingCanvasRef}
          onSaveGroup={isCurrentGroupSaved ? undefined : handleSaveGroup}
          isGuest={!currentUser}
          onAdvanceToDetails={handleDetailsPhase}
        />
      )}

      <div className="mx-auto max-w-[390px] md:max-w-lg min-h-dvh flex flex-col px-5 py-6">

        {/* Header */}
        <header className="flex items-center gap-3 mb-4">
          <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Link href="/home"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <Link href={`/room/${code}`} className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">{room.name || "ルーレット"}</h1>
            <p className="text-xs text-muted-foreground">{isOwner ? "オーナー" : "参加中"} · {room._count.members}人</p>
          </Link>
        </header>

        {!currentUser && !isOwner && (
          <p className="text-xs text-muted-foreground/60 text-center mb-2">
            ゲスト参加中 · <Link href="/auth/login" className="text-primary hover:underline">ログインして公開名を設定</Link>
          </p>
        )}

        {isExpired && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-between gap-2">
            <p className="text-xs text-red-400 font-medium">このルームは有効期限が切れています</p>
            <Link href="/room/create" className="text-xs text-red-400 underline shrink-0">新しいルームを作る</Link>
          </div>
        )}
        {isExpiringSoon && expiresAtMs && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/25">
            <p className="text-xs text-yellow-400">
              有効期限: {new Date(expiresAtMs).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        )}

        {/* Participants */}
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">参加者</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {room.members.map((member, index) => (
              <div key={member.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-card border border-white/10">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                >
                  {getMemberName(member).charAt(0)}
                </div>
                <span className="text-sm font-medium text-foreground">{getMemberName(member)}</span>
                {member.isHost && <Crown className="w-3 h-3 text-primary" />}
              </div>
            ))}
          </div>
        </section>

        {/* Bill input */}
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
            {showBillInput ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
          </button>

          {showBillInput && (
            <div className="mt-3 p-4 rounded-2xl glass-card border border-white/10 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">合計金額</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">¥</span>
                  <input
                    type="number"
                    value={totalBill || ""}
                    min="0"
                    onChange={(e) => handleTotalBillChange(Number(e.target.value))}
                    className="w-full h-12 pl-9 pr-4 text-xl font-bold text-foreground bg-secondary rounded-xl border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    placeholder="30000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">奢り金額（勝者が払う）</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">¥</span>
                  <input
                    type="number"
                    value={treatAmount || ""}
                    min="0"
                    max={totalBill}
                    onChange={(e) => handleTreatAmountChange(Number(e.target.value))}
                    className="w-full h-12 pl-9 pr-4 text-xl font-bold text-foreground bg-secondary rounded-xl border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    placeholder="20000"
                  />
                </div>
                <div className="flex gap-2 mt-3">
                  {QUICK_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setTreatAmount(Math.min(amount, totalBill || amount))}
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
        <div className="flex-1 flex flex-col items-center justify-center py-4 min-h-0">
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
              size={wheelSize}
              participants={participants}
              targetWinnerIndex={pendingWinnerIndex}
              onSpinComplete={handleSpinComplete}
              onSpinStart={handleSpinStart}
              onSlowingDown={handleSlowingDown}
              onNearMiss={handleNearMiss}
              wheelRotationRef={wheelRotationRef}
              spinRemainingMs={spinRemainingMs}
              spinSeed={spinStartedAtMs ?? undefined}
            />
          </div>

          {spinError && (
            <div className="flex flex-col items-center gap-2 mb-3 px-4">
              <p className="text-sm text-red-400 text-center">{spinError}</p>
              {spinError.includes("再読み込み") && (
                <button onClick={() => window.location.reload()} className="text-xs text-primary hover:underline">
                  ページを再読み込みする →
                </button>
              )}
            </div>
          )}

          <AnimatePresence mode="wait">
            {isCompleted ? (
              <motion.div key="completed" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 w-full max-w-[280px]">
                <Button onClick={() => showResult(room)} className="w-full h-14 text-base font-bold rounded-2xl bg-gradient-accent hover:opacity-90 text-white shadow-lg transition-all">
                  結果を見る
                </Button>
                <Button asChild className="w-full h-12 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all">
                  <Link href="/home">ホームへ戻る</Link>
                </Button>
                {isOwner && (
                  <Button asChild variant="outline" className="w-full h-12 rounded-2xl border-white/20 text-muted-foreground hover:text-foreground transition-all">
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
                animate={
                  phase === "waiting"
                    ? { scale: [1, 1.025, 1], boxShadow: ["0 0 20px rgba(249,115,22,0.3)", "0 0 35px rgba(249,115,22,0.6)", "0 0 20px rgba(249,115,22,0.3)"] }
                    : { scale: 1, boxShadow: "0 0 20px rgba(249,115,22,0.3)" }
                }
                transition={phase === "waiting" ? { duration: 3, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
                whileTap={{ scale: 0.93 }}
              >
                <AnimatePresence mode="wait">
                  {phase === "preparing" ? (
                    <motion.span key="preparing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      準備中...
                    </motion.span>
                  ) : phase === "spinning" ? (
                    <motion.span key="spinning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      回転中...
                    </motion.span>
                  ) : (
                    <motion.span key="ready" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                      🎯 運命を回す
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            ) : (
              <motion.div
                key="member-waiting"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-center py-5 px-6 rounded-2xl glass-card border w-full max-w-[280px] transition-colors duration-500 ${
                  isSpinInProgress(room.status) || phase === "preparing" || phase === "spinning"
                    ? "border-primary/40" : "border-white/10"
                }`}
              >
                {isSpinInProgress(room.status) || phase === "preparing" || phase === "spinning" ? (
                  <>
                    <motion.div className="w-3 h-3 rounded-full bg-green-400 mx-auto mb-3" animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
                    <p className="text-sm font-semibold text-primary">
                      {phase === "preparing" && countdownValue === null ? "ホストが準備中..." : "スピン中！"}
                    </p>
                  </>
                ) : (
                  <>
                    <motion.div className="w-3 h-3 rounded-full bg-primary mx-auto mb-3" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
                    <p className="text-base font-bold text-foreground tracking-wide">
                      誰が奢る
                      <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}>…？</motion.span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">オーナーの回転を待っています</p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {isOwner && (phase === "result" || (phase === "waiting" && participants.length < 2)) && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              {phase === "result" ? "結果カードを閉じると再スピンできます" : "参加者を2人以上追加してください"}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
