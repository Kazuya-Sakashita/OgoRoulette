"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

interface PrismBurstProps {
  /** 当選確定時に true にする。false→true のエッジで発火 */
  active: boolean
  /** 当選者カラー（省略時は白〜パープル系フラッシュ） */
  winnerColor?: string
}

// ─── リング定義 ─────────────────────────────────────────
const RINGS = [
  { scaleEnd: 2.0, delay: 0.00, duration: 1.00, peakOpacity: 0.85, rotation:   0, blur: 2 },
  { scaleEnd: 3.2, delay: 0.14, duration: 1.10, peakOpacity: 0.65, rotation:  48, blur: 3 },
  { scaleEnd: 4.6, delay: 0.27, duration: 1.20, peakOpacity: 0.45, rotation:  96, blur: 4 },
  { scaleEnd: 6.0, delay: 0.39, duration: 1.30, peakOpacity: 0.28, rotation: 144, blur: 6 },
] as const

const BURST_DURATION_MS = 1450

// ─── CSS @keyframes 生成 ─────────────────────────────────
// burstKey を名前に含めることで連続スピン時に毎回フレッシュなアニメーションを発火する
// translate(-50%,-50%) を keyframes に含めてセンタリングとスケールを同時に制御
function buildKeyframes(k: number): string {
  const rings = RINGS.map((r, i) => `
    @keyframes pb-r${i}-${k} {
      0%   { transform: translate(-50%,-50%) scale(.20); opacity: 0; }
      32%  { opacity: ${r.peakOpacity}; }
      100% { transform: translate(-50%,-50%) scale(${r.scaleEnd}); opacity: 0; }
    }
  `).join("")

  const flash = `
    @keyframes pb-flash-${k} {
      0%   { transform: translate(-50%,-50%) scale(.1);  opacity: 0; }
      28%  { transform: translate(-50%,-50%) scale(2.8); opacity: 1; }
      100% { transform: translate(-50%,-50%) scale(3.5); opacity: 0; }
    }
  `

  const aurora = `
    @keyframes pb-aurora-${k} {
      0%   { transform: translateX(-100%); opacity: 0;    }
      15%  {                               opacity: 0.95; }
      85%  {                               opacity: 0.95; }
      100% { transform: translateX(100%);  opacity: 0;    }
    }
  `

  return rings + flash + aurora
}

// ─── メインコンポーネント ────────────────────────────────
// Framer Motion を完全撤廃し CSS animation に切り替え
// 理由: Framer Motion は will-change:transform を内部で自動設定するため、
//   style prop から削除しても Chrome iOS (WKWebView) の GPU コンポジション
//   問題が解消されなかった。CSS @keyframes はブラウザのネイティブ
//   アニメーションエンジンが処理するため WKWebView でも確実に動作する。
export function PrismBurst({ active, winnerColor }: PrismBurstProps) {
  const [visible, setVisible]   = useState(false)
  const [burstKey, setBurstKey] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // SSR ガード（portal は client のみ）
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!active) return

    if (timerRef.current) clearTimeout(timerRef.current)
    setBurstKey(k => k + 1)
    setVisible(true)
    timerRef.current = setTimeout(() => setVisible(false), BURST_DURATION_MS)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [active])

  if (!mounted || !visible) return null

  const k = burstKey

  const flashBg = winnerColor
    ? `radial-gradient(circle at center,
        ${winnerColor}f0 0%,
        ${winnerColor}88 38%,
        transparent    72%)`
    : `radial-gradient(circle at center,
        rgba(255,255,255,.95) 0%,
        rgba(220,200,255,.75) 38%,
        transparent           72%)`

  return createPortal(
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 62 }}
      aria-hidden="true"
    >
      {/* @keyframes を document.head ではなく portal 内の style タグで注入
          burstKey が変わるたびに新しいアニメーション名になるため再発火する */}
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: buildKeyframes(k) }} />

      {/* ── 中心フラッシュ ───────────────────────────────── */}
      <div
        className="absolute rounded-full"
        style={{
          top: "50%", left: "50%",
          width: "22vmin", height: "22vmin",
          background: flashBg,
          filter: "blur(8px)",
          animation: `pb-flash-${k} 0.65s cubic-bezier(0,0,.1,1) both`,
        }}
      />

      {/* ── プリズムリング ───────────────────────────────── */}
      {RINGS.map((ring, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            top: "50%", left: "50%",
            width: "30vmin", height: "30vmin",
            // radial-gradient でリング形状と色を一括定義（conic-gradient 廃止）
            background: `radial-gradient(circle at center,
              transparent                                      34%,
              hsla(${ring.rotation},              90%,65%,.95) 38%,
              hsla(${(ring.rotation + 60)  % 360},90%,62%,.80) 45%,
              hsla(${(ring.rotation + 120) % 360},90%,62%,.60) 52%,
              transparent                                      56%
            )`,
            filter: `blur(${ring.blur}px)`,
            animation: `pb-r${i}-${k} ${ring.duration}s ${ring.delay}s cubic-bezier(.08,.65,.22,1) both`,
          }}
        />
      ))}

      {/* ── オーロラスウィープ ───────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(108deg,
            transparent               22%,
            hsla(270,80%,70%,.07)     32%,
            hsla(210,85%,68%,.11)     39%,
            hsla(150,80%,62%,.09)     46%,
            hsla(60, 85%,68%,.07)     53%,
            transparent               63%
          )`,
          animation: `pb-aurora-${k} 0.72s .08s cubic-bezier(.4,0,.15,1) both`,
        }}
      />
    </div>,
    document.documentElement
  )
}
