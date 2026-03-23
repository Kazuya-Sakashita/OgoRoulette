"use client"

import { motion, AnimatePresence } from "framer-motion"

interface CountdownOverlayProps {
  countdown: number | null
  participants: string[]
  memberCount?: number
}

export function CountdownOverlay({
  countdown,
  participants,
  memberCount,
}: CountdownOverlayProps) {
  return (
    <AnimatePresence>
      {countdown !== null && (
        <motion.div
          className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Dark semi-transparent backdrop — roulette faintly visible underneath */}
          <div className="absolute inset-0 bg-[#0B1B2B]/90 backdrop-blur-[2px]" />

          {/* Floating participant names drift in the background */}
          <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
            {participants.map((name, i) => (
              <motion.div
                key={i}
                className="absolute font-black text-white/10"
                style={{
                  fontSize: `${22 + (i % 3) * 14}px`,
                  top: `${8 + (i * 139) % 82}%`,
                  left: `${(i * 67) % 88}%`,
                }}
                animate={{
                  x: [-12, 8, -6, 10, -12],
                  y: [-6, 10, -14, 4, -6],
                  opacity: [0.07, 0.18, 0.09, 0.16, 0.07],
                }}
                transition={{
                  duration: 3.5 + (i % 2) * 0.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.25,
                }}
              >
                {name}
              </motion.div>
            ))}
          </div>

          {/* Center content */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Label */}
            <motion.p
              className="text-white/40 text-xs tracking-[0.3em] uppercase mb-10"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              運命のカウントダウン
            </motion.p>

            {/* Countdown number — zoom-out + spring each tick */}
            <div className="relative flex items-center justify-center w-52 h-52">
              {/* Pulsing ring behind the number */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary/30"
                animate={{
                  scale: [1, 1.18, 1],
                  opacity: [0.4, 0.1, 0.4],
                }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute inset-4 rounded-full border border-primary/20"
                animate={{
                  scale: [1, 1.12, 1],
                  opacity: [0.3, 0.08, 0.3],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.15,
                }}
              />

              {/* The number */}
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={countdown}
                  className="absolute text-[112px] font-black text-white leading-none select-none tabular-nums"
                  style={{
                    textShadow:
                      "0 0 80px rgba(249,115,22,0.9), 0 0 30px rgba(249,115,22,0.6), 0 4px 20px rgba(0,0,0,0.5)",
                  }}
                  initial={{ scale: 2.6, opacity: 0, filter: "blur(12px)" }}
                  animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                  exit={{ scale: 0.25, opacity: 0, filter: "blur(6px)" }}
                  transition={{
                    enter: {
                      type: "spring",
                      stiffness: 420,
                      damping: 22,
                    },
                    exit: { duration: 0.18, ease: "easeIn" },
                  }}
                >
                  {countdown}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* Member count */}
            {typeof memberCount === "number" && memberCount > 0 && (
              <motion.p
                className="mt-10 text-white/35 text-sm tracking-wide"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {memberCount}人がドキドキ中...
              </motion.p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
