"use client"

import { useEffect, useState, useRef, useCallback, MutableRefObject } from "react"
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion"
import { SEGMENT_COLORS } from "@/lib/constants"

interface RouletteWheelProps {
  isSpinning?: boolean
  size?: number
  participants?: string[]
  targetWinnerIndex?: number
  onSpinComplete?: (winner: string, index: number) => void
  // 演出フック: 呼び出し元（play/page.tsx）が音・振動を担当する
  onSpinStart?: () => void
  onSlowingDown?: () => void  // 減速フェーズ開始時（結果直前）
  onNearMiss?: () => void     // ISSUE-098: ニアミス演出直前（当選確定の280ms前）
  /** Ref written each frame with the current rotation in degrees — used by RecordingCanvas */
  wheelRotationRef?: MutableRefObject<number>
  /** ルーム同期: アニメーションの残り ms。この値を duration として使用する */
  spinRemainingMs?: number
  /** ルーム同期: minSpins 決定論化のための seed（spinStartedAt ms）。全クライアントで同値 */
  spinSeed?: number
}

export function RouletteWheel({
  isSpinning = false,
  size = 280,
  participants = ["A", "B", "C", "D"],
  targetWinnerIndex,
  onSpinComplete,
  onSpinStart,
  onSlowingDown,
  onNearMiss,
  wheelRotationRef,
  spinRemainingMs,
  spinSeed,
}: RouletteWheelProps) {
  const rotation = useMotionValue(0)
  const [glowIntensity, setGlowIntensity] = useState(0.2)
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null)
  // ISSUE-236: 2番手ハイライト — 400ms間だけ gold border を表示
  const [nearMissIndex, setNearMissIndex] = useState<number | null>(null)
  const [isSlowingDown, setIsSlowingDown] = useState(false)
  const lastRotation = useRef(0)

  // Keep wheelRotationRef in sync — used by RecordingCanvas to read current rotation
  useEffect(() => {
    if (!wheelRotationRef) return
    return rotation.on("change", (v) => { wheelRotationRef.current = v })
  }, [rotation, wheelRotationRef])

  // Stable callback refs — prevents animation re-runs when parent re-renders
  const onSpinCompleteRef = useRef(onSpinComplete)
  useEffect(() => { onSpinCompleteRef.current = onSpinComplete }, [onSpinComplete])
  const onSpinStartRef = useRef(onSpinStart)
  useEffect(() => { onSpinStartRef.current = onSpinStart }, [onSpinStart])
  const onSlowingDownRef = useRef(onSlowingDown)
  useEffect(() => { onSlowingDownRef.current = onSlowingDown }, [onSlowingDown])
  const onNearMissRef = useRef(onNearMiss)
  useEffect(() => { onNearMissRef.current = onNearMiss }, [onNearMiss])

  const spinRemainingMsRef = useRef(spinRemainingMs)
  useEffect(() => { spinRemainingMsRef.current = spinRemainingMs }, [spinRemainingMs])
  const spinSeedRef = useRef(spinSeed)
  useEffect(() => { spinSeedRef.current = spinSeed }, [spinSeed])

  // Stable participants snapshot captured at spin start — prevents mid-animation re-runs
  // スピン中は更新しない: mid-spin 参加者変化でレイアウトと角度計算がズレるのを防ぐ
  const participantsRef = useRef(participants)
  const spinActiveRef = useRef(false)
  useEffect(() => {
    if (!spinActiveRef.current) participantsRef.current = participants
  }, [participants])

  // Keep targetWinnerIndex stable for the current spin
  const targetWinnerIndexRef = useRef(targetWinnerIndex)
  useEffect(() => { targetWinnerIndexRef.current = targetWinnerIndex }, [targetWinnerIndex])

  const runSpin = useCallback(() => {
    setWinnerIndex(null)
    setIsSlowingDown(false)
    setGlowIntensity(0.6)
    spinActiveRef.current = true

    onSpinStartRef.current?.()

    const snapshotParticipants = participantsRef.current
    const segments = snapshotParticipants.length
    const segmentAngle = 360 / segments

    // Winner is pre-determined by the caller (separation of selection from animation).
    // Fall back to random only when no target is provided.
    const resolvedIdx = (targetWinnerIndexRef.current !== undefined)
      ? ((targetWinnerIndexRef.current % segments) + segments) % segments
      : Math.floor(Math.random() * segments)

    // Calculate the target rotation so the wheel stops exactly at resolvedIdx's segment center.
    // The pointer is at the top (0°). Segment 0 starts at -90° (top).
    // effectiveAngle = (360 - normalizedRotation) % 360 → maps rotation to a segment index.
    // To land on resolvedIdx: effectiveAngle = resolvedIdx * segmentAngle + segmentAngle / 2
    const targetEffectiveAngle = resolvedIdx * segmentAngle + segmentAngle / 2
    const targetNormalized = (360 - targetEffectiveAngle % 360 + 360) % 360

    const currentRotation = rotation.get()
    const currentNormalized = ((currentRotation % 360) + 360) % 360
    let angleDiff = targetNormalized - currentNormalized
    if (angleDiff <= 0) angleDiff += 360

    // 整数スピン数: 360 * integer は必ず 360 の倍数 → targetRotation % 360 === targetNormalized を保証
    // 非整数にすると各クライアントで停止角度がズレ、ポインターが異なる人を指す
    // ルーム同期: spinSeed が渡された場合は決定論的な値を使い全クライアントで一致させる
    const minSpins = spinSeedRef.current !== undefined
      ? 5 + (Math.floor(spinSeedRef.current / 1000) % 3)
      : 5 + Math.floor(Math.random() * 3)
    const targetRotation = currentRotation + (360 * minSpins) + angleDiff

    // ルーム同期: spinRemainingMs が渡された場合はその値を duration として使用する
    // 渡されない場合（オーナー初回など）はフル duration を使う
    const FULL_DURATION = 4.5
    const duration = spinRemainingMsRef.current !== undefined
      ? Math.max(0.5, spinRemainingMsRef.current / 1000)
      : FULL_DURATION

    // 減速フェーズ開始を 1.2秒前にコールバックで通知（カチカチ演出・振動のタイミング）
    // duration に合わせてタイミングを調整する
    const slowDownTimer = setTimeout(() => {
      setIsSlowingDown(true)
      setGlowIntensity(0.4)
      onSlowingDownRef.current?.()
    }, Math.max(0, (duration - 1.2) * 1000))

    const anim = animate(rotation, targetRotation, {
      duration, // ルーム同期: 遅延受信メンバーは短縮 duration で終了タイミングを合わせる
      ease: [0.15, 0.85, 0.2, 1], // 最初ゆっくり → 急加速 → 緩やかに減速
      onUpdate: (latest) => { lastRotation.current = latest },
      onComplete: () => {
        clearTimeout(slowDownTimer)
        const bounceAmount = 6
        animate(rotation, targetRotation - bounceAmount, {
          duration: 0.18,
          ease: "easeOut",
        }).then(() => {
          animate(rotation, targetRotation, {
            duration: 0.28,
            ease: "easeInOut",
          }).then(() => {
            spinActiveRef.current = false
            setIsSlowingDown(false)
            setGlowIntensity(0.35)
            // ISSUE-098: ニアミス演出 — 本当の当選者の1〜3つ前のセグメントを
            // ハイライトして「惜しかった！」感を演出する
            // ISSUE-236: 直前セグメント（2番手）を400ms固定でハイライト → 演出強化
            const nearMissOffset = 1
            const neighborIdx = (resolvedIdx - nearMissOffset + snapshotParticipants.length) % snapshotParticipants.length
            setWinnerIndex(neighborIdx)
            setNearMissIndex(snapshotParticipants.length > 1 ? neighborIdx : null)
            onNearMissRef.current?.()
            setTimeout(() => {
              setNearMissIndex(null)
              setWinnerIndex(resolvedIdx)
              onSpinCompleteRef.current?.(snapshotParticipants[resolvedIdx], resolvedIdx)
            }, 400)
          })
        })
      }
    })

    return () => {
      clearTimeout(slowDownTimer)
      anim.stop()
    }
  }, [rotation]) // rotation is a MotionValue — stable reference

  useEffect(() => {
    if (!isSpinning) return
    // runSpin() 先頭の setState × 3 はスピン開始前の視覚リセット。
    // React 18 バッチにより1回のレンダリングにまとまるため実害なし。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const cleanup = runSpin()
    return cleanup
  }, [isSpinning, runSpin])

  const segments = participants.length || 4
  const segmentAngle = 360 / segments
  const radius = size / 2
  const innerRadius = radius * 0.22

  const createSegmentPath = (index: number) => {
    const startAngle = (index * segmentAngle - 90) * (Math.PI / 180)
    const endAngle = ((index + 1) * segmentAngle - 90) * (Math.PI / 180)
    
    const outerRadius = radius * 0.86
    const x1 = radius + outerRadius * Math.cos(startAngle)
    const y1 = radius + outerRadius * Math.sin(startAngle)
    const x2 = radius + outerRadius * Math.cos(endAngle)
    const y2 = radius + outerRadius * Math.sin(endAngle)
    
    const x3 = radius + innerRadius * Math.cos(endAngle)
    const y3 = radius + innerRadius * Math.sin(endAngle)
    const x4 = radius + innerRadius * Math.cos(startAngle)
    const y4 = radius + innerRadius * Math.sin(startAngle)

    const largeArcFlag = segmentAngle > 180 ? 1 : 0

    return `
      M ${x1} ${y1}
      A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}
      L ${x3} ${y3}
      A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}
      Z
    `
  }

  const getTextPosition = (index: number) => {
    const angle = (index * segmentAngle + segmentAngle / 2 - 90) * (Math.PI / 180)
    const textRadius = radius * 0.56
    return {
      x: radius + textRadius * Math.cos(angle),
      y: radius + textRadius * Math.sin(angle),
      rotation: index * segmentAngle + segmentAngle / 2
    }
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* ISSUE-239: 2番手ハイライト中「惜しかった！」テキスト — ルーレット上部に表示 */}
      <AnimatePresence>
        {nearMissIndex !== null && (
          <motion.div
            key="near-miss-label"
            className="absolute left-1/2 -translate-x-1/2 -top-8 z-10
                       px-3 py-1 rounded-full pointer-events-none
                       text-sm font-black text-black whitespace-nowrap"
            style={{ background: "#FBBF24" }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            惜しかった！
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ambient glow — pointer-events: none to prevent blocking elements below the wheel */}
      <motion.div
        className="absolute inset-[-25%] rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, rgba(249, 115, 22, ${glowIntensity}) 0%, rgba(236, 72, 153, ${glowIntensity * 0.5}) 30%, transparent 55%)`,
          filter: 'blur(40px)',
        }}
        animate={{ 
          scale: isSpinning ? [1, 1.1, 1] : 1,
          opacity: isSpinning ? [0.8, 1, 0.8] : 0.6
        }}
        transition={{ 
          duration: 0.5, 
          repeat: isSpinning ? Infinity : 0,
          ease: "easeInOut"
        }}
      />
      
      {/* Outer decorative ring - Orange to Pink gradient */}
      <div 
        className="absolute inset-[-5px] rounded-full"
        style={{
          background: 'linear-gradient(135deg, #F97316 0%, #EC4899 100%)',
          padding: '4px',
        }}
      >
        <div 
          className="w-full h-full rounded-full"
          style={{ background: '#0B1B2B' }}
        />
      </div>

      {/* Inner highlight ring */}
      <div 
        className="absolute inset-[6px] rounded-full"
        style={{
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      />

      {/* Wheel SVG with Framer Motion */}
      <motion.svg 
        width={size} 
        height={size} 
        className="absolute inset-0"
        style={{ rotate: rotation }}
      >
        <defs>
          <filter id="innerShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.4"/>
          </filter>
          <linearGradient id="highlightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="centerRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>
        
        {/* Segments */}
        {Array.from({ length: segments }).map((_, index) => {
          const isWinner = winnerIndex === index && !isSpinning
          const isNearMiss = nearMissIndex === index && !isSpinning
          return (
            <motion.g
              key={index}
              initial={{ opacity: 1 }}
              animate={{
                opacity: isWinner ? 1 : (winnerIndex !== null && !isSpinning ? 0.5 : 1),
                scale: isWinner ? 1.02 : (isNearMiss ? 1.05 : 1),
              }}
              transition={{ duration: 0.3 }}
            >
              <path
                d={createSegmentPath(index)}
                fill={SEGMENT_COLORS[index % SEGMENT_COLORS.length]}
                stroke="#0B1B2B"
                strokeWidth="2"
                filter="url(#innerShadow)"
              />
              <path
                d={createSegmentPath(index)}
                fill="url(#highlightGrad)"
                style={{ pointerEvents: 'none' }}
              />
              {/* ISSUE-236: 2番手 gold ring highlight */}
              {isNearMiss && (
                <path
                  d={createSegmentPath(index)}
                  fill="none"
                  stroke="#FBBF24"
                  strokeWidth="3"
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </motion.g>
          )
        })}
        
        {/* Participant labels */}
        {Array.from({ length: segments }).map((_, index) => {
          const pos = getTextPosition(index)
          const name = participants[index] || String.fromCharCode(65 + index)
          const displayName = name.length > 6 ? name.substring(0, 6) : name
          
          return (
            <text
              key={`text-${index}`}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#0B1B2B"
              fontSize={size * 0.065}
              fontWeight="700"
              style={{
                transform: `rotate(${pos.rotation}deg)`,
                transformOrigin: `${pos.x}px ${pos.y}px`,
                textShadow: '0 1px 2px rgba(255,255,255,0.3)'
              }}
            >
              {displayName}
            </text>
          )
        })}
        
        {/* Center hub */}
        <circle
          cx={radius}
          cy={radius}
          r={innerRadius + 2}
          fill="#0B1B2B"
        />
        
        <circle
          cx={radius}
          cy={radius}
          r={innerRadius}
          fill="none"
          stroke="url(#centerRingGrad)"
          strokeWidth="3"
        />
        
        {/* Center sparkle icon */}
        <g transform={`translate(${radius - 12}, ${radius - 12})`}>
          <path
            d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
            fill="url(#centerRingGrad)"
            style={{ transform: 'scale(0.8)', transformOrigin: '12px 12px' }}
          />
        </g>
      </motion.svg>

      {/* Top Pointer with animation */}
      {/* 高速回転中: 細かく激しく揺れる / 減速中: ゆっくり大きく揺れてカチカチ感 / 停止: 静止 */}
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20"
        style={{ filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5))' }}
        animate={
          isSpinning && !isSlowingDown ? { y: [-1, 3, -1], rotateZ: [-3, 3, -3] } :
          isSlowingDown               ? { y: [-1, 5, -1], rotateZ: [-5, 5, -5] } :
                                        { y: -1, rotateZ: 0 }
        }
        transition={
          isSpinning && !isSlowingDown ? { duration: 0.08, repeat: Infinity, ease: "linear" } :
          isSlowingDown               ? { duration: 0.18, repeat: Infinity, ease: "easeInOut" } :
                                        { duration: 0.3, ease: "easeOut" }
        }
      >
        <svg width="32" height="40" viewBox="0 0 32 40">
          <defs>
            <linearGradient id="pointerGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#C2410C" />
              <stop offset="50%" stopColor="#F97316" />
              <stop offset="100%" stopColor="#FB923C" />
            </linearGradient>
          </defs>
          <path
            d="M16 40 L2 12 L16 0 L30 12 Z"
            fill="url(#pointerGrad)"
            stroke="#9A3412"
            strokeWidth="2"
          />
          <path
            d="M16 4 L8 14 L16 38"
            fill="rgba(255,255,255,0.2)"
          />
        </svg>
      </motion.div>

      {/* Winner highlight glow */}
      {winnerIndex !== null && !isSpinning && (
        <motion.div 
          className="absolute inset-0 rounded-full pointer-events-none"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ 
            opacity: [0, 1, 0.8],
            scale: [0.8, 1.1, 1]
          }}
          transition={{ duration: 0.5 }}
          style={{
            boxShadow: `0 0 60px 20px ${SEGMENT_COLORS[winnerIndex % SEGMENT_COLORS.length]}60`,
          }}
        />
      )}
    </div>
  )
}
