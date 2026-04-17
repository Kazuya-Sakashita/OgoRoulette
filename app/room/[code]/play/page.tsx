"use client"

import { useEffect, useRef, useState, useMemo, use, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { isRoomOwner } from "@/lib/room-owner"
import { createClient } from "@/lib/supabase/client"
import { getDisplayName } from "@/lib/display-name"
import { useGroups } from "@/hooks/use-groups"
import { useVideoRecorder } from "@/lib/use-video-recorder"
import type { User } from "@supabase/supabase-js"
import { useRoomSync } from "./use-room-sync"
import { useBill } from "./use-bill"
import { useSpin } from "./use-spin"
import { useEmojiReactions } from "./use-emoji-reactions"
import { RoomPlayOverlays } from "./_components/room-play-overlays"
import { RoomPlayBody } from "./_components/room-play-body"

export default function RoomPlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [isGuestHost, setIsGuestHost] = useState(false)
  const [isGuestHostResolved, setIsGuestHostResolved] = useState(false)
  const guestHostTokenRef = useRef<string | null>(null)

  // ISSUE-141: モバイル端末の実表示域に合わせてルーレットサイズを動的に調整する
  const [wheelSize, setWheelSize] = useState(280)

  // --- Room sync ---
  const { room, setRoom, loading, error, fetchRoom, fetchRanking, roomRanking, channelRef } = useRoomSync(code)

  // --- Auth ---
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user)
      setAuthLoaded(true)
    })
  }, [])

  // --- Derived ---
  // ISSUE-090: profile.name（プロバイダ由来名）は使わない。公開名を優先する。
  const membersKey = room?.members.map(m => m.nickname || (m.profile ? getDisplayName(m.profile) : "ゲスト")).join("\0") ?? ""
  const participants = useMemo(
    () => (membersKey ? membersKey.split("\0") : []),
    [membersKey]
  )

  const isOwner = currentUser
    ? isRoomOwner(room?.members ?? [], currentUser.id)
    : isGuestHost

  const expiresAtMs = room?.expiresAt ? new Date(room.expiresAt).getTime() : null
  const isExpired = expiresAtMs !== null && expiresAtMs < Date.now()
  // ISSUE-062: 残り時間に応じた段階的バリアント
  const expiryHoursLeft = expiresAtMs !== null && !isExpired ? (expiresAtMs - Date.now()) / 3_600_000 : null
  const expiryVariant: "danger" | "warning" | "info" | null =
    expiryHoursLeft === null ? null :
    expiryHoursLeft <= 3  ? "danger" :
    expiryHoursLeft <= 24 ? "warning" :
    expiryHoursLeft <= 72 ? "info" : null

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
    isSlowingDown,
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
    spinSyncChannelRef: channelRef,
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
        await fetchRoom()
        console.warn("[OgoRoulette] respin reset failed:", data.error)
      }
    } catch {
      await fetchRoom()
    }
  }

  // ISSUE-229: 絵文字リアクション hook（waiting フェーズからも使用可能）
  const { floatingEmojis, handleReact } = useEmojiReactions(code)

  // ISSUE-225: 非オーナーメンバーの退室処理
  const handleLeaveRoom = useCallback(async () => {
    if (!window.confirm("ルームを離脱しますか？参加者リストから削除されます。")) return
    try {
      await fetch(`/api/rooms/${code}/members/me`, { method: "DELETE" })
    } catch {
      // エラーでも離脱処理を継続
    }
    router.push("/home")
  }, [code, router])

  // --- Effects ---

  // ISSUE-141: ビューポートサイズに合わせてルーレットホイールのサイズを動的に計算する
  // ISSUE-232: md以上（768px+）の2カラム時は右カラム幅でルーレットサイズを決定
  useEffect(() => {
    const RESERVED_HEIGHT = 440
    const update = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const isMd = vw >= 768
      if (isMd) {
        // ISSUE-227: md:max-w-[760px] container, md:px-8 (64px) → content max 696px
        // grid-cols-[1fr_auto] with gap-8 (32px), keep left col ≥ 260px
        const containerContent = Math.min(760 - 64, vw - 64)
        setWheelSize(Math.min(400, Math.max(280, containerContent - 260 - 32)))
      } else {
        const byWidth = Math.min(360, vw - 40)
        const byHeight = Math.min(360, vh - RESERVED_HEIGHT)
        setWheelSize(Math.max(200, Math.min(byWidth, byHeight)))
      }
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
        <div className="mx-auto max-w-[390px] md:max-w-[760px] min-h-dvh flex flex-col px-5 py-6">
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
        <div className="mx-auto max-w-[390px] md:max-w-[760px] min-h-dvh flex flex-col px-5 py-6">
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
      <RoomPlayOverlays
        recordingPhase={recordingPhase}
        countdownValue={countdownValue}
        wheelRotationRef={wheelRotationRef}
        participants={participants}
        winner={winner}
        recordingCanvasRef={recordingCanvasRef}
        isRecording={isRecording}
        showShareSheet={showShareSheet}
        recordedBlob={recordedBlob}
        setShowShareSheet={setShowShareSheet}
        resetRecording={resetRecording}
        handleRespin={handleRespin}
        isOwner={isOwner}
        showPrismBurst={showPrismBurst}
        showConfetti={showConfetti}
        confettiBurstKey={confettiBurstKey}
        memberCount={room._count.members}
        setWinner={setWinner}
        setPhase={setPhase}
        roomCode={code}
        roomRanking={roomRanking}
        isCurrentGroupSaved={isCurrentGroupSaved}
        handleSaveGroup={handleSaveGroup}
        currentUser={currentUser}
        handleDetailsPhase={handleDetailsPhase}
        isSlowingDown={isSlowingDown}
        floatingEmojis={floatingEmojis}
        handleReact={handleReact}
      />

      <RoomPlayBody
        room={room}
        code={code}
        isOwner={isOwner}
        isGuest={!currentUser}
        phase={phase}
        participants={participants}
        isExpired={isExpired}
        expiryVariant={expiryVariant}
        expiresAtMs={expiresAtMs}
        showBillInput={showBillInput}
        setShowBillInput={setShowBillInput}
        totalBill={totalBill}
        treatAmount={treatAmount}
        setTreatAmount={setTreatAmount}
        splitAmount={splitAmount}
        hasBillInput={hasBillInput}
        handleTotalBillChange={handleTotalBillChange}
        handleTreatAmountChange={handleTreatAmountChange}
        wheelSize={wheelSize}
        wheelRotationRef={wheelRotationRef}
        pendingWinnerIndex={pendingWinnerIndex}
        spinStartedAtMs={spinStartedAtMs}
        spinRemainingMs={spinRemainingMs}
        handleSpinComplete={handleSpinComplete}
        handleSpinStart={handleSpinStart}
        handleSlowingDown={handleSlowingDown}
        handleNearMiss={handleNearMiss}
        countdownValue={countdownValue}
        spinError={spinError}
        handleSpin={handleSpin}
        showResult={showResult}
        handleLeaveRoom={!isOwner && currentUser ? handleLeaveRoom : undefined}
        handleReact={handleReact}
      />
    </main>
  )
}
