"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { RecordingCanvas } from "@/components/recording-canvas"
import { ShareSheet } from "@/components/share-sheet"
import { PrismBurst } from "@/components/prism-burst"
import { Confetti } from "@/components/confetti"
import { CountdownOverlay } from "@/components/countdown-overlay"
import { WinnerCard } from "@/components/winner-card"
import { SEGMENT_COLORS } from "@/lib/constants"
import { getTreatTitle } from "@/lib/group-storage"
import type { RecordingPhase } from "@/components/recording-canvas"
import type { FloatingEmoji } from "../use-emoji-reactions"
import type { WinnerData, Phase } from "../types"
import type { User } from "@supabase/supabase-js"
import type React from "react"

interface RoomPlayOverlaysProps {
  // RecordingCanvas
  recordingPhase: RecordingPhase
  countdownValue: number | null
  wheelRotationRef: React.RefObject<number>
  participants: string[]
  winner: WinnerData | null
  recordingCanvasRef: React.RefObject<HTMLCanvasElement | null>
  // REC indicator
  isRecording: boolean
  // ShareSheet
  showShareSheet: boolean
  recordedBlob: Blob | null
  setShowShareSheet: (v: boolean) => void
  resetRecording: () => void
  handleRespin: () => void
  isOwner: boolean
  // PrismBurst / Confetti
  showPrismBurst: boolean
  showConfetti: boolean
  confettiBurstKey: number
  // CountdownOverlay
  memberCount: number
  // WinnerCard
  setWinner: (w: WinnerData | null) => void
  setPhase: (p: Phase) => void
  roomCode: string
  roomRanking: { name: string; count: number }[] | undefined
  isCurrentGroupSaved: boolean
  handleSaveGroup: (name: string) => Promise<void>
  currentUser: User | null
  handleDetailsPhase: () => void
  // ISSUE-207: 感情ピーク演出
  isSlowingDown: boolean
  // ISSUE-229: 絵文字リアクション（use-emoji-reactions hook から渡す）
  floatingEmojis: FloatingEmoji[]
  handleReact: (emoji: string) => void
}

export function RoomPlayOverlays({
  recordingPhase,
  countdownValue,
  wheelRotationRef,
  participants,
  winner,
  recordingCanvasRef,
  isRecording,
  showShareSheet,
  recordedBlob,
  setShowShareSheet,
  resetRecording,
  handleRespin,
  isOwner,
  showPrismBurst,
  showConfetti,
  confettiBurstKey,
  memberCount,
  setWinner,
  setPhase,
  roomCode,
  roomRanking,
  isCurrentGroupSaved,
  handleSaveGroup,
  currentUser,
  handleDetailsPhase,
  isSlowingDown,
  floatingEmojis,
  handleReact,
}: RoomPlayOverlaysProps) {
  const winnerColor = winner ? SEGMENT_COLORS[winner.index % SEGMENT_COLORS.length] : SEGMENT_COLORS[0]

  // ISSUE-207: 停止フラッシュ — winner が確定した瞬間に 0.2秒フラッシュ
  const [showFlash, setShowFlash] = useState(false)

  useEffect(() => {
    if (!winner) return
    setShowFlash(true)
    const t = setTimeout(() => setShowFlash(false), 200)
    return () => clearTimeout(t)
  }, [winner])

  // ISSUE-207: 名前リビール — winner 確定から 0.8秒後に WinnerCard を表示
  const [showWinnerCard, setShowWinnerCard] = useState(false)
  useEffect(() => {
    if (!winner) { setShowWinnerCard(false); return }
    const t = setTimeout(() => setShowWinnerCard(true), 800)
    return () => clearTimeout(t)
  }, [winner])

  return (
    <>
      <RecordingCanvas
        phase={recordingPhase}
        countdown={countdownValue}
        wheelRotationRef={wheelRotationRef}
        participants={participants}
        winnerIndex={winner?.index ?? null}
        winner={winner?.name ?? null}
        winnerColor={winnerColor}
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
          winnerColor={winnerColor}
          onClose={() => setShowShareSheet(false)}
          onRespin={isOwner ? () => { resetRecording(); handleRespin() } : undefined}
        />
      )}

      <PrismBurst
        active={showPrismBurst}
        winnerColor={winner ? winnerColor : undefined}
      />

      <Confetti
        key={confettiBurstKey}
        active={showConfetti}
        intense={confettiBurstKey === 0 && !!winner}
        winnerColor={winner ? winnerColor : undefined}
      />

      <CountdownOverlay
        countdown={countdownValue}
        participants={participants}
        memberCount={memberCount}
      />

      {/* ISSUE-207: スロービルドアップ — 停止前の緊張感オーバーレイ */}
      {isSlowingDown && (
        <div
          className="fixed inset-0 pointer-events-none z-10 animate-pulse"
          style={{ background: "radial-gradient(ellipse at center, rgba(251,191,36,0.12) 0%, transparent 70%)" }}
        />
      )}

      {/* ISSUE-207: 停止フラッシュ */}
      {showFlash && (
        <div className="fixed inset-0 pointer-events-none z-20 bg-white/25 transition-opacity duration-200" />
      )}

      {/* ISSUE-207: 当選者発表リビール（0.8秒の中間演出） */}
      {winner && !showWinnerCard && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-40 pointer-events-none">
          <p
            className="text-4xl font-black tracking-tight animate-bounce"
            style={{ color: winnerColor, textShadow: `0 0 24px ${winnerColor}88` }}
          >
            🎯 当選者発表！
          </p>
        </div>
      )}

      {/* ISSUE-218: winner && ガードを追加して winner=null 時の winner!.name TypeError を防ぐ */}
      {showWinnerCard && winner && (
        <WinnerCard
          winner={winner.name}
          winnerIndex={winner.index}
          onClose={() => { setWinner(null); setPhase("waiting"); resetRecording() }}
          totalBill={winner.totalAmount}
          treatAmount={winner.treatAmount}
          splitAmount={winner.perPersonAmount}
          participants={participants}
          isOwner={isOwner}
          roomCode={roomCode}
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
          onReact={handleReact}
          sessionId={winner.sessionId}
          resultToken={winner.resultToken}
        />
      )}

      {/* ISSUE-213: フローティング絵文字 */}
      <AnimatePresence>
        {floatingEmojis.map(({ id, emoji, x }) => (
          <motion.div
            key={id}
            className="fixed text-4xl pointer-events-none z-50"
            style={{ left: `${x}%`, bottom: "25%" }}
            initial={{ opacity: 1, y: 0, scale: 0.8 }}
            animate={{ opacity: 0, y: -220, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.0, ease: "easeOut" }}
          >
            {emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </>
  )
}
