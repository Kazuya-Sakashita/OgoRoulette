"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowLeft, Crown, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RouletteWheel } from "@/components/roulette-wheel"
import { SEGMENT_COLORS } from "@/lib/constants"
import { BillInputSection } from "./bill-input-section"
import { SpinControls } from "./spin-controls"
import type { Phase, Room } from "../types"
import type React from "react"

// ISSUE-212: 参加人数に応じた熱量メーター
function HypeBar({ count }: { count: number }) {
  const hype = Math.min(count / 8, 1)
  const label =
    count <= 1 ? "参加者を待っています..." :
    count <= 3 ? "少しずつ集まってきた！" :
    count <= 6 ? "盛り上がってきた！" :
    "いつでもいける！🔥"
  return (
    <div className="w-full mt-2.5">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{label}</span>
        <span>{count}人参加中</span>
      </div>
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-orange-500 rounded-full"
          animate={{ width: `${Math.max(hype * 100, count > 0 ? 6 : 0)}%` }}
          transition={{ type: "spring", stiffness: 280, damping: 30 }}
        />
      </div>
    </div>
  )
}

interface RoomPlayBodyProps {
  room: Room
  code: string
  isOwner: boolean
  isGuest: boolean
  phase: Phase
  participants: string[]
  isExpired: boolean
  expiryVariant: "danger" | "warning" | "info" | null
  expiresAtMs: number | null
  // Bill
  showBillInput: boolean
  setShowBillInput: (v: boolean) => void
  totalBill: number
  treatAmount: number
  setTreatAmount: (v: number) => void
  splitAmount: number
  hasBillInput: boolean
  handleTotalBillChange: (v: number) => void
  handleTreatAmountChange: (v: number) => void
  // Wheel
  wheelSize: number
  wheelRotationRef: React.RefObject<number>
  pendingWinnerIndex: number | undefined
  spinStartedAtMs: number | null
  spinRemainingMs: number
  handleSpinComplete: (winnerName: string, winnerIndex: number) => void
  handleSpinStart: () => void
  handleSlowingDown: () => void
  handleNearMiss: () => void
  // Controls
  countdownValue: number | null
  spinError: string | null
  handleSpin: () => void
  showResult: (room: Room | null) => void
  // ISSUE-225: メンバー退室ボタン
  handleLeaveRoom?: () => void
  // ISSUE-229: 絵文字リアクション
  handleReact?: (emoji: string) => void
}

export function RoomPlayBody({
  room,
  code,
  isOwner,
  isGuest,
  phase,
  participants,
  isExpired,
  expiryVariant,
  expiresAtMs,
  showBillInput, setShowBillInput,
  totalBill, treatAmount, setTreatAmount,
  splitAmount, hasBillInput,
  handleTotalBillChange, handleTreatAmountChange,
  wheelSize, wheelRotationRef,
  pendingWinnerIndex, spinStartedAtMs, spinRemainingMs,
  handleSpinComplete, handleSpinStart, handleSlowingDown, handleNearMiss,
  countdownValue, spinError, handleSpin, showResult, handleLeaveRoom, handleReact,
}: RoomPlayBodyProps) {
  // ISSUE-212: 新規参加者を検出して ✨ スパーク演出
  const isFirstRenderRef = useRef(true)
  const prevMemberIdsRef = useRef<Set<string>>(new Set())
  const [newMemberIds, setNewMemberIds] = useState<Set<string>>(new Set())

  // ISSUE-226: 参加者が2人以上になったとき、金額入力を1度だけ自動展開する
  const hasAutoOpenedBillRef = useRef(false)

  useEffect(() => {
    if (isOwner && participants.length >= 2 && !hasAutoOpenedBillRef.current) {
      hasAutoOpenedBillRef.current = true
      setShowBillInput(true)
    }
  }, [participants.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const currentIds = new Set(room.members.map((m) => m.id))
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      prevMemberIdsRef.current = currentIds
      return
    }
    const added = new Set<string>()
    currentIds.forEach((id) => {
      if (!prevMemberIdsRef.current.has(id)) added.add(id)
    })
    prevMemberIdsRef.current = currentIds
    if (added.size > 0) {
      setNewMemberIds(added)
      const timer = setTimeout(() => setNewMemberIds(new Set()), 900)
      return () => clearTimeout(timer)
    }
  }, [room.members])

  return (
    <div className="mx-auto max-w-[390px] md:max-w-[680px] min-h-dvh flex flex-col px-5 py-6 md:px-8">

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

      {isGuest && !isOwner && (
        <p className="text-xs text-muted-foreground/60 text-center mb-2">
          ゲスト参加中 · <Link href="/auth/login" className="text-primary hover:underline">ログインして公開名を設定</Link>
        </p>
      )}

      {/* ISSUE-062: 段階的有効期限バナー */}
      {isExpired && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-between gap-2">
          <p className="text-xs text-red-400 font-medium">このルームは有効期限が切れています</p>
          <Link href="/room/create" className="text-xs text-red-400 underline shrink-0">新しいルームを作る</Link>
        </div>
      )}
      {!isExpired && expiryVariant && expiresAtMs && (
        <div className={`mb-3 px-3 py-2 rounded-xl ${
          expiryVariant === "danger"  ? "bg-red-500/15 border border-red-500/30" :
          expiryVariant === "warning" ? "bg-yellow-500/10 border border-yellow-500/25" :
                                        "bg-blue-500/10 border border-blue-500/20"
        }`}>
          <p className={`text-xs ${
            expiryVariant === "danger"  ? "text-red-400 font-medium" :
            expiryVariant === "warning" ? "text-yellow-400" :
                                          "text-blue-400"
          }`}>
            {expiryVariant === "danger" ? "⚠️ まもなく期限切れ — " : "有効期限: "}
            {new Date(expiresAtMs).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      )}

      {/* ISSUE-232: md以上で2カラムグリッド */}
      <div className="flex-1 flex flex-col md:grid md:grid-cols-[1fr_auto] md:gap-8 md:items-start">

        {/* 左カラム: 参加者 + 金額入力 */}
        <div className="md:pt-2">
          {/* Participants */}
          <section className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">参加者</span>
            </div>
            {/* ISSUE-212: 参加者チップに入場スプリングアニメーション */}
            <div className="flex flex-wrap gap-2">
              {room.members.map((member, index) => (
                <motion.div
                  key={member.id}
                  className="relative"
                  initial={{ scale: 0, rotate: -8, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 18 }}
                >
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-card border border-white/10">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                    >
                      {(participants[index] ?? "?").charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-foreground">{participants[index]}</span>
                    {member.isHost && <Crown className="w-3 h-3 text-primary" />}
                  </div>
                  {/* 新規入場時 ✨ スパーク */}
                  {newMemberIds.has(member.id) && (
                    <motion.span
                      className="absolute -top-1.5 -right-1 text-xs pointer-events-none"
                      initial={{ opacity: 1, y: 0, scale: 1 }}
                      animate={{ opacity: 0, y: -14, scale: 1.4 }}
                      transition={{ delay: 0.15, duration: 0.7 }}
                    >
                      ✨
                    </motion.span>
                  )}
                </motion.div>
              ))}
            </div>
            {/* ISSUE-212: 熱量メーター + スピン促進テキスト */}
            <HypeBar count={room.members.length} />
            {isOwner && phase === "waiting" && participants.length >= 3 && (
              <motion.p
                className="text-xs text-primary font-semibold text-center mt-2"
                animate={{ opacity: [0.55, 1, 0.55] }}
                transition={{ repeat: Infinity, duration: 1.8 }}
              >
                🎯 全員揃ったらスピン！
              </motion.p>
            )}
          </section>

          {/* Bill input */}
          <BillInputSection
            phase={phase}
            showBillInput={showBillInput}
            setShowBillInput={setShowBillInput}
            totalBill={totalBill}
            treatAmount={treatAmount}
            splitAmount={splitAmount}
            hasBillInput={hasBillInput}
            handleTotalBillChange={handleTotalBillChange}
            handleTreatAmountChange={handleTreatAmountChange}
            setTreatAmount={setTreatAmount}
          />
        </div>

        {/* 右カラム: ルーレット + SPIN */}
        <div className="flex flex-col items-center justify-center py-4 md:py-2 min-h-0">
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

          <SpinControls
            isCompleted={room.status === "COMPLETED"}
            isOwner={isOwner}
            phase={phase}
            participants={participants}
            room={room}
            countdownValue={countdownValue}
            spinError={spinError}
            handleSpin={handleSpin}
            showResult={showResult}
            handleLeaveRoom={handleLeaveRoom}
            handleReact={handleReact}
          />

          {isOwner && (phase === "result" || (phase === "waiting" && participants.length < 2)) && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              {phase === "result" ? "結果カードを閉じると再スピンできます" : "参加者を2人以上追加してください"}
            </p>
          )}
        </div>

      </div>
    </div>
  )
}
