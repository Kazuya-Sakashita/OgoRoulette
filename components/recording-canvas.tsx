"use client"

/**
 * recording-canvas.tsx
 *
 * Hidden 9:16 (540×960) canvas that renders the roulette experience
 * as a video-ready composition. Captured via canvas.captureStream()
 * for MediaRecorder recording.
 *
 * Draws:
 *  - Dark branded background with animated glow
 *  - Floating participant name particles
 *  - Roulette wheel (reimplemented in Canvas 2D, synced via rotationRef)
 *  - Phase overlays: countdown / winner reveal
 *  - OgoRoulette branding + date + hashtag
 *  - Blinking REC indicator while recording
 *
 * The canvas is positioned off-screen — users see the normal DOM UI.
 */

import { useEffect, useRef, MutableRefObject, RefObject } from "react"
import { SEGMENT_COLORS } from "@/lib/constants"

// ─── Canvas dimensions (9:16 portrait) ───────────────────────────────────────
const W = 540
const H = 960

// ─── Roulette wheel geometry ──────────────────────────────────────────────────
const WCX = 270   // center x
const WCY = 390   // center y
const WR  = 188   // radius

export type RecordingPhase = "idle" | "countdown" | "spinning" | "reveal" | "done"

export interface RecordingCanvasProps {
  phase: RecordingPhase
  countdown: number | null
  /** Ref updated by RouletteWheel each frame with the current rotation in degrees */
  wheelRotationRef: MutableRefObject<number>
  participants: string[]
  winnerIndex: number | null
  winner: string | null
  winnerColor: string
  /** Ref to the underlying <canvas> element — parent passes this to MediaRecorder */
  canvasRef: RefObject<HTMLCanvasElement | null>
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`
}

function drawBackground(ctx: CanvasRenderingContext2D, phase: RecordingPhase, winnerColor: string) {
  ctx.fillStyle = "#0B1B2B"
  ctx.fillRect(0, 0, W, H)

  if (phase === "idle") return

  // Ambient glow behind wheel
  const color = phase === "reveal" || phase === "done" ? winnerColor : "#F97316"
  const glow = ctx.createRadialGradient(WCX, WCY, 0, WCX, WCY, WR * 2.2)
  glow.addColorStop(0, hexToRgba(color, phase === "reveal" || phase === "done" ? 0.28 : 0.12))
  glow.addColorStop(1, "transparent")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  participants: string[],
  elapsed: number
) {
  ctx.save()
  for (let i = 0; i < participants.length; i++) {
    const speed = 6 + (i % 3) * 4
    const dir = i % 2 === 0 ? 1 : -1
    const x = ((i * 173 + elapsed * speed * dir) % W + W) % W
    const y = ((i * 139 + elapsed * 5) % H + H) % H
    ctx.globalAlpha = 0.05 + (i % 3) * 0.025
    ctx.font = `bold ${20 + (i % 3) * 10}px sans-serif`
    ctx.fillStyle = "white"
    ctx.textAlign = "left"
    ctx.fillText(participants[i], x, y)
  }
  ctx.restore()
}

function drawWheelBorder(ctx: CanvasRenderingContext2D) {
  const outerR = WR + 6
  const grad = ctx.createLinearGradient(WCX - outerR, WCY - outerR, WCX + outerR, WCY + outerR)
  grad.addColorStop(0, "#F97316")
  grad.addColorStop(1, "#EC4899")
  ctx.beginPath()
  ctx.arc(WCX, WCY, outerR, 0, 2 * Math.PI)
  ctx.strokeStyle = grad
  ctx.lineWidth = 7
  ctx.stroke()
  // Dark gap
  ctx.beginPath()
  ctx.arc(WCX, WCY, WR + 1, 0, 2 * Math.PI)
  ctx.strokeStyle = "#0B1B2B"
  ctx.lineWidth = 4
  ctx.stroke()
}

function drawWheel(
  ctx: CanvasRenderingContext2D,
  rotDeg: number,
  participants: string[],
  winnerIdx: number | null,
  phase: RecordingPhase
) {
  const n = participants.length
  if (n === 0) return

  const segAngle = (2 * Math.PI) / n
  const outerR = WR * 0.87
  const innerR = WR * 0.22
  const isReveal = phase === "reveal" || phase === "done"

  ctx.save()
  ctx.translate(WCX, WCY)
  ctx.rotate((rotDeg * Math.PI) / 180)

  for (let i = 0; i < n; i++) {
    const startA = i * segAngle - Math.PI / 2
    const endA   = startA + segAngle
    const color  = SEGMENT_COLORS[i % SEGMENT_COLORS.length]
    const dimmed = isReveal && winnerIdx !== null && winnerIdx !== i

    ctx.globalAlpha = dimmed ? 0.42 : 1

    // Segment path: inner arc → outer arc → back
    ctx.beginPath()
    ctx.moveTo(innerR * Math.cos(startA), innerR * Math.sin(startA))
    ctx.lineTo(outerR * Math.cos(startA), outerR * Math.sin(startA))
    ctx.arc(0, 0, outerR, startA, endA)
    ctx.lineTo(innerR * Math.cos(endA), innerR * Math.sin(endA))
    ctx.arc(0, 0, innerR, endA, startA, true)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = "#0B1B2B"
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Name text (rotated to segment center)
    ctx.save()
    ctx.globalAlpha = dimmed ? 0.42 : 1
    const midA    = startA + segAngle / 2
    const textR   = WR * 0.57
    ctx.translate(textR * Math.cos(midA), textR * Math.sin(midA))
    ctx.rotate(midA + Math.PI / 2)
    ctx.fillStyle = "#0B1B2B"
    ctx.font = `bold ${Math.round(WR * 0.115)}px sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const label = participants[i] ?? ""
    ctx.fillText(label.length > 5 ? label.slice(0, 4) + "…" : label, 0, 0)
    ctx.restore()
    ctx.globalAlpha = 1
  }

  // Outer subtle inner-ring glow
  ctx.beginPath()
  ctx.arc(0, 0, outerR + 3, 0, 2 * Math.PI)
  ctx.strokeStyle = "rgba(249,115,22,0.4)"
  ctx.lineWidth = 3
  ctx.stroke()

  // Center hub
  ctx.beginPath()
  ctx.arc(0, 0, innerR + 3, 0, 2 * Math.PI)
  ctx.fillStyle = "#0B1B2B"
  ctx.fill()

  ctx.beginPath()
  ctx.arc(0, 0, innerR, 0, 2 * Math.PI)
  ctx.strokeStyle = "#F97316"
  ctx.lineWidth = 3
  ctx.stroke()

  // Center sparkle (4 rays, counter-rotated to stay upright)
  ctx.save()
  ctx.rotate((-rotDeg * Math.PI) / 180)
  const rayLen = innerR * 0.55
  ctx.strokeStyle = "#F97316"
  ctx.lineWidth = 2.5
  ctx.lineCap = "round"
  for (let a = 0; a < 4; a++) {
    ctx.save()
    ctx.rotate((a * Math.PI) / 2)
    ctx.beginPath()
    ctx.moveTo(0, -rayLen * 0.3)
    ctx.lineTo(0, -rayLen)
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()

  ctx.restore()
}

function drawPointer(ctx: CanvasRenderingContext2D) {
  const outerEdgeY = WCY - WR * 0.87 - 3
  const pW = 32
  const pH = 40
  const tipX = WCX

  ctx.save()
  ctx.translate(tipX - pW / 2, outerEdgeY - pH)

  const grad = ctx.createLinearGradient(pW / 2, pH, pW / 2, 0)
  grad.addColorStop(0, "#C2410C")
  grad.addColorStop(0.5, "#F97316")
  grad.addColorStop(1, "#FB923C")

  ctx.beginPath()
  ctx.moveTo(16, 40) // bottom tip (points into wheel)
  ctx.lineTo(2, 12)  // upper-left
  ctx.lineTo(16, 0)  // top-center
  ctx.lineTo(30, 12) // upper-right
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = "#9A3412"
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.restore()
}

function drawCountdownOverlay(ctx: CanvasRenderingContext2D, countdown: number) {
  ctx.fillStyle = "rgba(11,27,43,0.88)"
  ctx.fillRect(0, 0, W, H)

  const cy = H / 2 - 20

  // Pulsing ring
  ctx.beginPath()
  ctx.arc(W / 2, cy, 110, 0, 2 * Math.PI)
  ctx.strokeStyle = "rgba(249,115,22,0.25)"
  ctx.lineWidth = 2
  ctx.stroke()

  // Label
  ctx.save()
  ctx.font = "bold 16px sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.38)"
  ctx.textAlign = "center"
  ctx.fillText("運命のカウントダウン", W / 2, cy - 128)
  ctx.restore()

  // Big number
  ctx.save()
  ctx.font = "900 160px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillStyle = "white"
  ctx.shadowBlur = 90
  ctx.shadowColor = "rgba(249,115,22,0.95)"
  ctx.fillText(String(countdown), W / 2, cy)
  ctx.shadowBlur = 0
  ctx.restore()
}

function drawReveal(
  ctx: CanvasRenderingContext2D,
  winner: string,
  winnerColor: string,
  revealSec: number
) {
  const p = Math.min(revealSec / 0.65, 1)
  if (p <= 0) return

  // Glow burst behind wheel during reveal
  const burstR = WR * (1 + p * 0.5)
  const burst = ctx.createRadialGradient(WCX, WCY, 0, WCX, WCY, burstR)
  burst.addColorStop(0, hexToRgba(winnerColor, p * 0.35))
  burst.addColorStop(1, "transparent")
  ctx.fillStyle = burst
  ctx.fillRect(0, 0, W, H)

  // Result area: just below wheel
  const baseY = WCY + WR * 0.87 + 18

  // Crown
  const crownSz = Math.round(58 * p)
  ctx.save()
  ctx.globalAlpha = p
  ctx.font = `${crownSz}px sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  ctx.fillText("👑", W / 2, baseY + 4)
  ctx.restore()

  // Winner name (scale in from 40% to 100%)
  const scale   = 0.4 + p * 0.6
  const nameSz  = Math.round(66 * scale)
  const nameY   = baseY + 80

  ctx.save()
  ctx.globalAlpha = p
  ctx.font         = `900 ${nameSz}px sans-serif`
  ctx.textAlign    = "center"
  ctx.textBaseline = "middle"
  ctx.fillStyle    = "white"
  ctx.shadowBlur   = 52 * p
  ctx.shadowColor  = winnerColor
  ctx.fillText(`${winner}さん`, W / 2, nameY)
  ctx.shadowBlur = 0
  ctx.restore()

  // Subtitle: "本日の奢り担当！"
  if (revealSec > 0.75) {
    const subP = Math.min((revealSec - 0.75) / 0.35, 1)
    ctx.save()
    ctx.globalAlpha  = subP
    ctx.font         = "bold 28px sans-serif"
    ctx.textAlign    = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle    = winnerColor
    ctx.fillText("本日の奢り担当！", W / 2, nameY + 56)
    ctx.restore()
  }

  // Reaction text
  if (revealSec > 1.4) {
    const reactP = Math.min((revealSec - 1.4) / 0.3, 1)
    const reactions = ["ごちそうさまです！", "太っ腹！", "今日のヒーロー！"]
    const rx = reactions[winner.charCodeAt(0) % reactions.length]
    ctx.save()
    ctx.globalAlpha  = reactP * 0.65
    ctx.font         = "22px sans-serif"
    ctx.textAlign    = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle    = "rgba(255,255,255,0.75)"
    ctx.fillText(rx, W / 2, nameY + 100)
    ctx.restore()
  }
}

function drawRecIndicator(ctx: CanvasRenderingContext2D, elapsed: number) {
  // Blink at ~1 Hz
  if (Math.sin(elapsed * Math.PI * 2) <= 0) return
  ctx.save()
  ctx.fillStyle = "#EF4444"
  ctx.beginPath()
  ctx.arc(W - 54, 36, 7, 0, 2 * Math.PI)
  ctx.fill()
  ctx.font         = "bold 17px sans-serif"
  ctx.fillStyle    = "#EF4444"
  ctx.textAlign    = "left"
  ctx.textBaseline = "middle"
  ctx.fillText("REC", W - 44, 36)
  ctx.restore()
}

function drawBranding(ctx: CanvasRenderingContext2D) {
  // Top bar
  ctx.fillStyle = "rgba(0,0,0,0.38)"
  ctx.fillRect(0, 0, W, 66)

  ctx.save()
  ctx.font         = "bold 25px sans-serif"
  ctx.fillStyle    = "rgba(255,255,255,0.92)"
  ctx.textAlign    = "left"
  ctx.textBaseline = "middle"
  ctx.fillText("🎰 OgoRoulette", 20, 33)
  ctx.restore()

  const today = new Date().toLocaleDateString("ja-JP", {
    month: "numeric",
    day:   "numeric",
    weekday: "short",
  })
  ctx.save()
  ctx.font         = "17px sans-serif"
  ctx.fillStyle    = "rgba(255,255,255,0.42)"
  ctx.textAlign    = "right"
  ctx.textBaseline = "middle"
  ctx.fillText(today, W - 18, 33)
  ctx.restore()

  // Bottom hashtag
  ctx.save()
  ctx.font         = "bold 19px sans-serif"
  ctx.fillStyle    = "rgba(255,255,255,0.28)"
  ctx.textAlign    = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("#OgoRoulette", W / 2, H - 26)
  ctx.restore()
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecordingCanvas({
  phase,
  countdown,
  wheelRotationRef,
  participants,
  winnerIndex,
  winner,
  winnerColor,
  canvasRef,
}: RecordingCanvasProps) {
  // Mutable snapshot of all props — updated each render, read by animation loop
  const stateRef = useRef({
    phase,
    countdown,
    participants,
    winnerIndex,
    winner,
    winnerColor,
    revealStartMs: null as number | null,
  })

  const prevPhaseRef = useRef<RecordingPhase>(phase)

  useEffect(() => {
    stateRef.current.phase       = phase
    stateRef.current.countdown   = countdown
    stateRef.current.participants= participants
    stateRef.current.winnerIndex = winnerIndex
    stateRef.current.winner      = winner
    stateRef.current.winnerColor = winnerColor

    if (phase === "reveal" && prevPhaseRef.current !== "reveal") {
      stateRef.current.revealStartMs = Date.now()
    } else if (phase !== "reveal" && phase !== "done") {
      stateRef.current.revealStartMs = null
    }
    prevPhaseRef.current = phase
  }, [phase, countdown, participants, winnerIndex, winner, winnerColor])

  // Single animation loop — only re-mounted once (on canvas ref change)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const startMs = Date.now()
    let rafId: number

    const loop = () => {
      const nowMs   = Date.now()
      const elapsed = (nowMs - startMs) / 1000
      const s       = stateRef.current
      const rotDeg  = wheelRotationRef.current

      drawBackground(ctx, s.phase, s.winnerColor)

      if (s.phase !== "idle") {
        drawParticles(ctx, s.participants, elapsed)
      }

      drawWheelBorder(ctx)
      drawWheel(ctx, rotDeg, s.participants, s.winnerIndex, s.phase)
      drawPointer(ctx)

      if (s.phase === "countdown" && s.countdown !== null) {
        drawCountdownOverlay(ctx, s.countdown)
      } else if (s.phase === "reveal" || s.phase === "done") {
        const revealSec = s.revealStartMs !== null
          ? (nowMs - s.revealStartMs) / 1000
          : (s.phase === "done" ? 999 : 0)
        drawReveal(ctx, s.winner ?? "", s.winnerColor, revealSec)
      }

      if (s.phase === "countdown" || s.phase === "spinning" || s.phase === "reveal") {
        drawRecIndicator(ctx, elapsed)
      }

      drawBranding(ctx)

      rafId = requestAnimationFrame(loop)
    }

    loop()
    return () => cancelAnimationFrame(rafId)
  }, [canvasRef, wheelRotationRef])

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ position: "fixed", left: -10000, top: -10000, pointerEvents: "none" }}
    />
  )
}
