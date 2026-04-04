"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

interface PrismBurstProps {
  /** 当選確定時に true にする。false→true のエッジで発火 */
  active: boolean
  /** 当選者カラー（省略時は白〜パープル系フラッシュ） */
  winnerColor?: string
}

// ─── リング定義 ─────────────────────────────────────────
// scaleEnd: 最終スケール倍率
// delay / duration: アニメーションタイミング (s)
// peakOpacity: 最大不透明度（HEART ルール: 0.85 上限）
// rotation: radial-gradient の起点色相 (hsl deg)
// blur: ガウスぼかし (px)
const RINGS = [
  { scaleEnd: 2.0, delay: 0.00, duration: 1.00, peakOpacity: 0.85, rotation:   0, blur: 2 },
  { scaleEnd: 3.2, delay: 0.14, duration: 1.10, peakOpacity: 0.65, rotation:  48, blur: 3 },
  { scaleEnd: 4.6, delay: 0.27, duration: 1.20, peakOpacity: 0.45, rotation:  96, blur: 4 },
  { scaleEnd: 6.0, delay: 0.39, duration: 1.30, peakOpacity: 0.28, rotation: 144, blur: 6 },
] as const

// 当選確定から 1.3s (最終リング delay + duration) + 100ms buffer
const BURST_DURATION_MS = 1450

// ─── メインコンポーネント ────────────────────────────────
export function PrismBurst({ active, winnerColor }: PrismBurstProps) {
  const [visible, setVisible] = useState(false)
  const [burstKey, setBurstKey] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // iOS: overflow:hidden の祖先要素が position:fixed の包含ブロックになる問題を
  // createPortal で回避。
  // document.body ではなく document.documentElement (<html>) にマウントする。
  // Chrome iOS では WKWebView の実装により body がスクロールコンテナになるため、
  // body への portal でも fixed がビューポート基準にならない。
  // <html> 要素はスクロールコンテナになりにくく、両ブラウザで安全。
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!active) return

    // 前回のタイマーをキャンセルして再発火に対応
    if (timerRef.current) clearTimeout(timerRef.current)
    setBurstKey(k => k + 1)
    setVisible(true)
    timerRef.current = setTimeout(() => setVisible(false), BURST_DURATION_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [active])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {visible && (
        // flex を使わず inset-0 に直接 position: absolute で各要素を中央配置
        <div
          key={burstKey}
          className="fixed inset-0 pointer-events-none overflow-hidden"
          style={{ zIndex: 62 }}
          aria-hidden="true"
        >

          {/* ── 中心フラッシュ ──────────────────────────────────
              top/left 50% + x/y -50% でビューポート中心に固定。
              filter: blur はこの要素単独なので Safari 競合なし。   */}
          <motion.div
            className="absolute rounded-full"
            style={{
              top: "50%",
              left: "50%",
              x: "-50%",
              y: "-50%",
              width:  "22vmin",
              height: "22vmin",
              background: winnerColor
                ? `radial-gradient(circle at center,
                    ${winnerColor}f0 0%,
                    ${winnerColor}88 38%,
                    transparent    72%)`
                : `radial-gradient(circle at center,
                    rgba(255,255,255,0.95) 0%,
                    rgba(220,200,255,0.75) 38%,
                    transparent           72%)`,
              filter: "blur(8px)",
              // willChange を省略 — Chrome iOS (WKWebView) では
              // will-change: transform が GPU レイヤーを生成し、
              // position:fixed コンテナとのコンポジション合成に失敗して
              // 要素が invisible になる問題を回避する。
            }}
            initial={{ scale: 0.1, opacity: 0 }}
            animate={{
              scale:   [0.1, 2.8, 3.5],
              opacity: [0,   1.0, 0  ],
            }}
            transition={{
              duration: 0.65,
              ease: [0.0, 0.0, 0.1, 1],
              times: [0, 0.28, 1],
            }}
          />

          {/* ── プリズムリング ───────────────────────────────────
              【Chrome iOS 対応】conic-gradient + mask-image の
              2要素構成を廃止し、radial-gradient 単体でリング形状と
              色を同時に定義する。

              理由: Chrome iOS (WKWebView) では scale アニメーション中に
              -webkit-mask-image + conic-gradient の合成が失敗し
              リングが完全に invisible になる。radial-gradient は
              iOS Safari / Chrome iOS 双方で確実に描画される。

              色設計: ring.rotation をベースに 3 色のグラデーションを
              リング帯内で変化させることで虹色リールに近い演出を維持。

              【中央配置】top/left 50% + Framer Motion x/y -50%
              で要素中心をビューポート中心に固定。                */}
          {RINGS.map((ring, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                top:  "50%",
                left: "50%",
                x: "-50%",
                y: "-50%",
                width:  "30vmin",
                height: "30vmin",
                // radial-gradient でリング形状 + 色を一括定義
                // transparent 帯がリングの内側・外側を切り抜く
                background: `radial-gradient(
                  circle at center,
                  transparent                                   34%,
                  hsla(${ring.rotation},             90%, 65%, 0.95) 38%,
                  hsla(${(ring.rotation + 60)  % 360}, 90%, 62%, 0.80) 45%,
                  hsla(${(ring.rotation + 120) % 360}, 90%, 62%, 0.60) 52%,
                  transparent                                   56%
                )`,
                filter: `blur(${ring.blur}px)`,
                // willChange を省略 — Chrome iOS (WKWebView) では
              // will-change: transform が GPU レイヤーを生成し、
              // position:fixed コンテナとのコンポジション合成に失敗して
              // 要素が invisible になる問題を回避する。
              }}
              initial={{ scale: 0.20, opacity: 0 }}
              animate={{
                scale:   [0.20, ring.scaleEnd * 0.55, ring.scaleEnd],
                opacity: [0,    ring.peakOpacity,      0            ],
              }}
              transition={{
                duration: ring.duration,
                delay:    ring.delay,
                ease: [0.08, 0.65, 0.22, 1],
                times: [0, 0.32, 1],
              }}
            />
          ))}

          {/* ── オーロラスウィープ ──────────────────────────────
              inset-0 要素を x: -100%→+100% で移動させることで
              虹色の光帯が画面を横断する補助演出。               */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(
                108deg,
                transparent               22%,
                hsla(270, 80%, 70%, 0.07) 32%,
                hsla(210, 85%, 68%, 0.11) 39%,
                hsla(150, 80%, 62%, 0.09) 46%,
                hsla(60,  85%, 68%, 0.07) 53%,
                transparent               63%
              )`,
              // willChange を省略 — Chrome iOS (WKWebView) では
              // will-change: transform が GPU レイヤーを生成し、
              // position:fixed コンテナとのコンポジション合成に失敗して
              // 要素が invisible になる問題を回避する。
            }}
            initial={{ x: "-100%", opacity: 0 }}
            animate={{
              x:       "100%",
              opacity: [0, 0.95, 0],
            }}
            transition={{
              x:       { duration: 0.72, ease: [0.4, 0, 0.15, 1] },
              opacity: { duration: 0.72, times: [0, 0.42, 1]      },
              delay: 0.08,
            }}
          />

        </div>
      )}
    </AnimatePresence>,
    document.documentElement
  )
}
