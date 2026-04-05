"use client"

import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { isSpinInProgress } from "@/lib/room-spin"
import type { Phase, Room } from "../types"

interface SpinControlsProps {
  isCompleted: boolean
  isOwner: boolean
  phase: Phase
  participants: string[]
  room: Room
  countdownValue: number | null
  spinError: string | null
  handleSpin: () => void
  showResult: (room: Room) => void
}

export function SpinControls({
  isCompleted,
  isOwner,
  phase,
  participants,
  room,
  countdownValue,
  spinError,
  handleSpin,
  showResult,
}: SpinControlsProps) {
  return (
    <>
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
    </>
  )
}
