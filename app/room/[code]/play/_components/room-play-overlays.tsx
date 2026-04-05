"use client"

import { RecordingCanvas } from "@/components/recording-canvas"
import { ShareSheet } from "@/components/share-sheet"
import { PrismBurst } from "@/components/prism-burst"
import { Confetti } from "@/components/confetti"
import { CountdownOverlay } from "@/components/countdown-overlay"
import { WinnerCard } from "@/components/winner-card"
import { SEGMENT_COLORS } from "@/lib/constants"
import { getTreatTitle } from "@/lib/group-storage"
import type { RecordingPhase } from "@/components/recording-canvas"
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
}: RoomPlayOverlaysProps) {
  const winnerColor = winner ? SEGMENT_COLORS[winner.index % SEGMENT_COLORS.length] : SEGMENT_COLORS[0]

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
        />
      )}
    </>
  )
}
