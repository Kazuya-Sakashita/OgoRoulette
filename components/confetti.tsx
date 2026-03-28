"use client"

import { useEffect, useState } from "react"

interface ConfettiPiece {
  id: number
  x: number
  color: string
  delay: number
  duration: number
  size: number
  borderRadius: string
  rotation: number
}

const COLORS = ["#F59E0B", "#F43F5E", "#8B5CF6", "#3B82F6", "#22C55E", "#FBBF24"]

interface ConfettiProps {
  active: boolean
  intense?: boolean
  winnerColor?: string
}

export function Confetti({ active, intense = false, winnerColor }: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])

  useEffect(() => {
    if (active) {
      const count = intense ? 150 : 50
      // winner color gets 3x weight so it dominates the celebration
      const colors = winnerColor
        ? [...COLORS, winnerColor, winnerColor, winnerColor]
        : COLORS
      const newPieces: ConfettiPiece[] = []
      for (let i = 0; i < count; i++) {
        newPieces.push({
          id: i,
          x: Math.random() * 100,
          color: colors[Math.floor(Math.random() * colors.length)],
          delay: Math.random() * (intense ? 1.0 : 0.5),
          duration: 2 + Math.random() * (intense ? 3 : 2),
          size: (intense ? 8 : 6) + Math.random() * 8,
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          rotation: Math.random() * 360,
        })
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPieces(newPieces)

      const timer = setTimeout(() => {
        setPieces([])
      }, intense ? 6000 : 4000)

      return () => clearTimeout(timer)
    } else {
      setPieces([])
    }
  }, [active, intense, winnerColor])

  if (!active || pieces.length === 0) return null

  return (
    // z-70: above WinnerCard (z-50) so confetti shows over the full-screen reveal
    <div className="fixed inset-0 pointer-events-none z-70 overflow-hidden">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${piece.x}%`,
            top: '-20px',
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            borderRadius: piece.borderRadius,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            transform: `rotate(${piece.rotation}deg)`,
          }}
        />
      ))}
    </div>
  )
}
