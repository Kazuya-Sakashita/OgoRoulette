"use client"

import { Button } from "@/components/ui/button"
import { X as XIcon, Crown, Calculator, RotateCcw, Bookmark, Check, LogIn, Share2, ChevronDown, ChevronUp } from "lucide-react"
import { useState, useEffect, useCallback, RefObject } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import { SEGMENT_COLORS } from "@/lib/constants"
import { startSupabaseOAuth } from "@/lib/auth"
import {
  SHARE_TEMPLATES,
  buildShareUrl,
  buildShareText,
  shareToX,
  shareToLine,
} from "@/lib/share-service"
import { generateShareCard } from "@/lib/share-card-generator"
import { trackEvent, AnalyticsEvent } from "@/lib/analytics"

interface WinnerCardProps {
  winner: string
  winnerIndex: number
  onClose: () => void
  // Payment breakdown props
  totalBill?: number
  treatAmount?: number
  splitAmount?: number
  participants?: string[]
  // Next-action props
  isOwner?: boolean
  roomCode?: string
  onRespin?: () => void
  // Gamification props
  treatCount?: number
  treatTitle?: string
  ranking?: Array<{ name: string; count: number }>
  // Video recording
  videoBlob?: Blob | null
  onShareVideo?: () => void
  // ISSUE-093: canvas ref for instant image capture at peak emotion
  recordingCanvasRef?: RefObject<HTMLCanvasElement | null>
  // Group save — pass undefined when participants are already saved
  onSaveGroup?: (name: string) => void
  // Guest→login conversion CTA
  isGuest?: boolean
  // Called when Phase A (cinematic reveal) advances to Phase B (details sheet)
  onAdvanceToDetails?: () => void
  // ISSUE-197: セッション内スピン回数（エスカレーション演出）
  sessionSpinCount?: number
  // ISSUE-213: 絵文字リアクション（マルチプレイヤー共有）
  onReact?: (emoji: string) => void
}

const REACTIONS = [
  "ごちそうさまです!",
  "太っ腹!",
  "本日のスポンサー!",
  "神降臨!",
  "ありがとう!",
]

// ISSUE-194: 奢り回数に応じたパーソナライズリアクション
function getPersonalizedReaction(treatCount?: number): string {
  if (typeof treatCount === "number") {
    if (treatCount >= 10) return (["またお前か！！", "レジェンド！", "伝説の奢り王！"] as const)[treatCount % 3]
    if (treatCount >= 5) return (["さすが常連！", "もはや職業奢り！", "いつもありがとう！"] as const)[treatCount % 3]
    if (treatCount >= 3) return (["またか！笑", "三度目の正直！", "恒例行事だね！"] as const)[treatCount % 3]
  }
  return REACTIONS[Math.floor(Math.random() * REACTIONS.length)]
}

export function WinnerCard({
  winner,
  winnerIndex,
  onClose,
  totalBill,
  treatAmount,
  splitAmount,
  participants = [],
  isOwner = false,
  roomCode,
  onRespin,
  treatCount,
  treatTitle,
  ranking,
  videoBlob,
  onShareVideo,
  recordingCanvasRef,
  onSaveGroup,
  isGuest = false,
  onAdvanceToDetails,
  sessionSpinCount,
  onReact,
}: WinnerCardProps) {
  const color = SEGMENT_COLORS[winnerIndex % SEGMENT_COLORS.length]
  const [reaction] = useState(() => getPersonalizedReaction(treatCount))

  // Phase A: cinematic reveal  Phase B: details sheet
  const [phase, setPhase] = useState<"reveal" | "details">("reveal")

  // ISSUE-181: Phase B accordion — details collapsed by default
  const [showDetails, setShowDetails] = useState(false)
  // ISSUE-183: share card generation state
  const [shareCardDone, setShareCardDone] = useState(false)

  // Save group inline state
  const [showSaveGroup, setShowSaveGroup] = useState(false)
  const [saveGroupName, setSaveGroupName] = useState("")
  const [savedThisSession, setSavedThisSession] = useState(false)

  // Phase A staggered reveals
  const [showCrown, setShowCrown] = useState(false)
  const [showName, setShowName] = useState(false)
  const [showReaction, setShowReaction] = useState(false)
  const [showHint, setShowHint] = useState(false)
  // ISSUE-093: instant share button appears 1.5 s into Phase A
  const [showInstantShare, setShowInstantShare] = useState(false)
  const [instantShareDone, setInstantShareDone] = useState(false)

  const hasBillInfo = typeof totalBill === "number" && totalBill > 0
  const treat = treatAmount ?? 0
  const split = splitAmount ?? 0
  const bill = totalBill ?? 0

  const treatType = !hasBillInfo
    ? null
    : treat >= bill
      ? "全額奢り"
      : treat > 0
        ? "一部奢り"
        : "割り勘"

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(amount)

  // Phase A animation sequence — staggered reveals
  // ISSUE-236: タイムライン再設計 — 2番手ハイライト(wheel側)→当選者名ズームイン→Confetti→シェアCTA
  useEffect(() => {
    const t1 = setTimeout(() => setShowCrown(true), 300)
    const t2 = setTimeout(() => setShowName(true), 600)   // 名前ズームイン (spring)
    const t3 = setTimeout(() => setShowReaction(true), 1000)
    // ISSUE-236: シェアCTA は +2.5秒後に表示（盛り上がりピーク後）
    const t4 = setTimeout(() => setShowInstantShare(true), 2500)
    const t5 = setTimeout(() => setShowHint(true), 2700)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      clearTimeout(t5)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ISSUE-217: 8秒後に自動で Phase B へ（タップで即スキップも維持）
  useEffect(() => {
    const autoAdvance = setTimeout(() => {
      setPhase((prev) => (prev === "reveal" ? "details" : prev))
      onAdvanceToDetails?.()
    }, 8_000)
    return () => clearTimeout(autoAdvance)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const advanceToDetails = () => {
    if (phase === "reveal") {
      setPhase("details")
      onAdvanceToDetails?.()
    }
  }

  // Build share payload and helpers using share-service
  const sharePayload = {
    winner,
    winnerColor: color,
    participants,
    totalBill: hasBillInfo ? bill : undefined,
    treatAmount: hasBillInfo ? treat : undefined,
    roomCode,
  }
  const shareUrl = buildShareUrl(sharePayload)
  // Default template for quick-share buttons in details phase
  const defaultTemplate = hasBillInfo ? SHARE_TEMPLATES.find((t) => t.id === "bill")! : SHARE_TEMPLATES[0]
  const shareTextValue = buildShareText(defaultTemplate, sharePayload)

  /**
   * ISSUE-093: Capture the current recording canvas frame as a PNG and share it.
   * If the video is already ready, open the share sheet instead (best quality).
   * Falls back through: video share → image share → URL share → clipboard.
   */
  const handleInstantShare = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()

    // If video is ready, jump to the share sheet (video > image)
    if (videoBlob && onShareVideo) {
      onShareVideo()
      return
    }

    const canvas = recordingCanvasRef?.current
    let imageFile: File | undefined

    if (canvas) {
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"))
      if (blob) {
        imageFile = new File([blob], `ogoroulette_${winner}.png`, { type: "image/png" })
      }
    }

    const text = `🎰 OgoRouletteで${winner}さんが奢りに決定！ #OgoRoulette`

    try {
      if (imageFile && navigator.canShare?.({ files: [imageFile] })) {
        await navigator.share({ files: [imageFile], text, url: shareUrl })
      } else if (navigator.share) {
        await navigator.share({ text, url: shareUrl })
      } else {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`)
      }
      setInstantShareDone(true)
    } catch {
      // User cancelled or share failed — silently ignore
    }
  }, [videoBlob, onShareVideo, recordingCanvasRef, winner, shareUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * ISSUE-183: Phase B プライマリシェアボタン。
   * Canvas でブランド入り静止画カードを生成 → Web Share API で画像ファイルをシェア。
   * ファイルシェア不可の場合は URL シェア → クリップボードコピーへフォールバック。
   */
  const handlePrimaryShare = useCallback(async () => {
    trackEvent(AnalyticsEvent.SHARE_PRIMARY_CLICKED)

    // If video is ready, delegate to video share sheet (highest quality)
    if (videoBlob && onShareVideo) {
      onShareVideo()
      return
    }

    const imageBlob = await generateShareCard(winner, color).catch(() => null)
    if (imageBlob) trackEvent(AnalyticsEvent.SHARE_CARD_GENERATED)
    const text = shareTextValue

    try {
      if (imageBlob) {
        const imageFile = new File([imageBlob], `ogoroulette_${winner}.png`, { type: "image/png" })
        if (typeof navigator.canShare === "function" && navigator.canShare({ files: [imageFile] })) {
          await navigator.share({ files: [imageFile], text, url: shareUrl })
          setShareCardDone(true)
          return
        }
      }

      if (navigator.share) {
        await navigator.share({ title: "OgoRoulette", text, url: shareUrl })
        setShareCardDone(true)
        return
      }

      await navigator.clipboard.writeText(`${text}\n${shareUrl}`)
      setShareCardDone(true)
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        // シェアキャンセル以外のエラーは無視
      }
    }
  }, [videoBlob, onShareVideo, winner, color, shareTextValue, shareUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: "OgoRoulette", text: shareTextValue, url: shareUrl }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(`${shareTextValue}\n${shareUrl}`).catch(() => {})
      alert("リンクをコピーしました！")
    }
  }

  const handleShare = (platform: "x" | "line") => {
    switch (platform) {
      case "x":
        trackEvent(AnalyticsEvent.SHARE_X_CLICKED)
        shareToX(shareTextValue, shareUrl)
        break
      case "line":
        trackEvent(AnalyticsEvent.SHARE_LINE_CLICKED)
        shareToLine(shareTextValue, shareUrl)
        break
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* ===== PHASE A: Cinematic full-screen reveal ===== */}
      <AnimatePresence>
        {phase === "reveal" && (
          <motion.div
            key="reveal"
            className="fixed inset-0 flex flex-col items-center justify-center cursor-pointer select-none"
            onClick={advanceToDetails}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.96, filter: "blur(4px)" }}
            transition={{ duration: 0.25 }}
          >
            {/* Full-screen winner color flood */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              style={{
                background: `radial-gradient(ellipse at center, ${color}CC 0%, ${color}55 35%, #0B1B2B 70%)`,
              }}
            />

            {/* Floating particle ring */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: 8 + (i % 3) * 4,
                    height: 8 + (i % 3) * 4,
                    background: color,
                    top: `${35 + Math.sin((i * 45 * Math.PI) / 180) * 28}%`,
                    left: `${50 + Math.cos((i * 45 * Math.PI) / 180) * 38}%`,
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 1.6, 1], opacity: [0, 1, 0.5] }}
                  transition={{ delay: 0.55 + i * 0.07, duration: 0.7 }}
                />
              ))}
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center text-center px-8">
              {/* Crown drops from top with spring bounce */}
              <motion.div
                className="mb-4"
                initial={{ y: -120, opacity: 0, scale: 0.4 }}
                animate={
                  showCrown
                    ? { y: 0, opacity: 1, scale: 1 }
                    : { y: -120, opacity: 0, scale: 0.4 }
                }
                transition={{ type: "spring", stiffness: 320, damping: 18 }}
              >
                <Crown
                  className="w-20 h-20"
                  style={{
                    color: "#FBBF24",
                    filter: `drop-shadow(0 0 24px ${color}) drop-shadow(0 0 8px rgba(251,191,36,0.8))`,
                  }}
                />
              </motion.div>

              {/* Winner avatar + name: ISSUE-236 spring zoom 0→1.3→1.0 */}
              <motion.div
                className="mb-4"
                initial={{ scale: 0, opacity: 0 }}
                animate={
                  showName
                    ? { scale: [0, 1.3, 1.0], opacity: 1 }
                    : { scale: 0, opacity: 0 }
                }
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                <div
                  className="w-32 h-32 rounded-full flex items-center justify-center text-5xl font-black mx-auto mb-5 border-4 border-white/40"
                  style={{
                    background: `linear-gradient(135deg, ${color}, ${color}99)`,
                    color: "#0B1B2B",
                    boxShadow: `0 0 80px ${color}80, 0 0 30px ${color}40, inset 0 2px 12px rgba(255,255,255,0.3)`,
                  }}
                >
                  {winner.charAt(0)}
                </div>
                <h2
                  className="text-6xl font-black text-white tracking-tight leading-none"
                  style={{ textShadow: `0 0 50px ${color}, 0 4px 24px rgba(0,0,0,0.6)` }}
                >
                  {winner}
                </h2>
                <p className="text-2xl text-white/70 font-semibold mt-2">さん</p>
              </motion.div>

              {/* ISSUE-236: 「🎉 {name}さんが奢ります！」大テキスト */}
              <motion.p
                className="text-2xl font-black text-white mb-2"
                style={{ textShadow: `0 0 30px ${color}, 0 2px 12px rgba(0,0,0,0.6)` }}
                initial={{ y: 20, opacity: 0 }}
                animate={
                  showReaction ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }
                }
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                🎉 {winner}さんが奢ります！
              </motion.p>

              {/* Reaction text slides up */}
              <motion.p
                className="text-2xl font-bold mb-4"
                style={{ color }}
                initial={{ y: 28, opacity: 0 }}
                animate={
                  showReaction ? { y: 0, opacity: 1 } : { y: 28, opacity: 0 }
                }
                transition={{ duration: 0.45, delay: 0.15, ease: "easeOut" }}
              >
                {reaction}
              </motion.p>

              {/* ISSUE-197: セッション回数バッジ（2回戦以降に表示） */}
              {sessionSpinCount !== undefined && sessionSpinCount >= 2 && (
                <motion.div
                  className="mt-3 px-4 py-1.5 rounded-full text-sm font-bold text-white/80"
                  style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={showReaction ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 400, damping: 20 }}
                >
                  {sessionSpinCount >= 4 ? "🔥 もはや宴！" : `${sessionSpinCount}回戦！`}
                </motion.div>
              )}

              {/* ISSUE-194: Treat count badge in Phase A */}
              {typeof treatCount === "number" && treatCount > 0 && (
                <motion.div
                  className="mt-3 px-4 py-1.5 rounded-full text-sm font-bold"
                  style={{ background: `${color}33`, color, border: `1px solid ${color}55` }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={showReaction ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 400, damping: 20 }}
                >
                  🍺 通算{treatCount}回目{treatTitle ? ` — ${treatTitle}` : ""}
                </motion.div>
              )}

              {/* Amount badge if bill info is set */}
              {hasBillInfo && (
                <motion.div
                  className="px-6 py-3 rounded-2xl"
                  style={{
                    background: `${color}30`,
                    border: `1px solid ${color}60`,
                  }}
                  initial={{ y: 20, opacity: 0 }}
                  animate={
                    showReaction ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }
                  }
                  transition={{ duration: 0.45, delay: 0.15, ease: "easeOut" }}
                >
                  <p className="text-white font-bold text-2xl">{formatCurrency(treat)}</p>
                  <p className="text-white/55 text-sm mt-0.5">奢り金額</p>
                </motion.div>
              )}
            </div>

            {/* ISSUE-008: Phase A 右上の閉じるボタン — Phase A のまま閉じて再スピンできる */}
            <button
              onClick={(e) => { e.stopPropagation(); onClose() }}
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/30 flex items-center justify-center text-white/50 hover:bg-black/50 hover:text-white transition-all"
              aria-label="閉じる"
            >
              <XIcon className="w-4 h-4" />
            </button>

            {/* ISSUE-093: Instant share button — fades in 1.5 s after reveal */}
            <AnimatePresence>
              {showInstantShare && (
                <motion.button
                  className="absolute bottom-28 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white"
                  style={{
                    background: instantShareDone
                      ? "rgba(255,255,255,0.15)"
                      : `linear-gradient(135deg, ${color}CC, ${color}88)`,
                    border: "1px solid rgba(255,255,255,0.25)",
                    backdropFilter: "blur(8px)",
                  }}
                  initial={{ opacity: 0, y: 10, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  onClick={handleInstantShare}
                >
                  <Share2 className="w-4 h-4" />
                  {instantShareDone
                    ? "シェア済み ✓"
                    : videoBlob
                      ? "動画でシェア 🎬"
                      : "今すぐシェア 📸"}
                </motion.button>
              )}
            </AnimatePresence>

            {/* ISSUE-242: Phase A リアクションボタン — 当選発表の瞬間に反応できる */}
            <AnimatePresence>
              {showInstantShare && onReact && (
                <motion.div
                  className="absolute bottom-14 flex gap-3"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {["👏", "🍺", "🎉", "😂", "😭"].map((emoji) => (
                    <motion.button
                      key={emoji}
                      whileTap={{ scale: 1.8 }}
                      className="text-2xl p-2 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-colors"
                      onClick={() => onReact(emoji)}
                    >
                      {emoji}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ISSUE-193: Hint at bottom — "タップして続ける" with pulse */}
            <motion.p
              className="absolute bottom-6 text-white/35 text-sm tracking-wider animate-pulse"
              initial={{ opacity: 0 }}
              animate={showHint ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              タップして続ける
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== PHASE B: Dark backdrop + bottom sheet ===== */}
      <AnimatePresence>
        {phase === "details" && (
          <>
            {/* Dark backdrop */}
            <motion.div
              key="backdrop"
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              onClick={onClose}
            />

            {/* Ambient glow behind card */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 rounded-full animate-pulse"
                style={{
                  background: `radial-gradient(circle, ${color}22 0%, transparent 60%)`,
                  filter: "blur(60px)",
                }}
              />
            </div>

            {/* Bottom sheet slides up — ISSUE-155: tighter spring for snappier feel */}
            <motion.div
              key="sheet"
              className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 340, damping: 30, mass: 0.8 }}
            >
              <div
                className="relative rounded-t-3xl overflow-hidden md:rounded-3xl md:mx-auto md:max-w-lg md:mb-8"
                style={{
                  background: "linear-gradient(180deg, #0F2236 0%, #0B1B2B 100%)",
                  boxShadow: `0 -8px 60px ${color}30, 0 -2px 20px rgba(0,0,0,0.5)`,
                }}
              >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>

                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition-all z-10"
                >
                  <XIcon className="w-4 h-4" />
                </button>

                <div className="px-6 pb-8 pt-2">
                  {/* ISSUE-181: Phase B 2-CTA redesign */}

                  {/* Winner mini-header */}
                  <motion.div
                    className="flex items-center gap-3 mb-5"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-black shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${color}, ${color}99)`,
                        color: "#0B1B2B",
                        boxShadow: `0 0 20px ${color}60`,
                      }}
                    >
                      {winner.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">今日の奢り</p>
                      <h3
                        className="text-2xl font-black text-white truncate"
                        style={{ textShadow: `0 0 20px ${color}60` }}
                      >
                        {winner}さん
                      </h3>
                    </div>
                    <Crown className="w-6 h-6 ml-auto shrink-0" style={{ color: "#FBBF24" }} />
                  </motion.div>

                  {/* ISSUE-169: 金額を Phase B ヘッダー直下に表示 */}
                  {hasBillInfo && (
                    <div className="flex items-center justify-between mb-5 px-4 py-3 rounded-2xl" style={{ background: `${color}18`, border: `1px solid ${color}35` }}>
                      <div className="text-center">
                        <p className="text-xs text-white/50">奢り</p>
                        <p className="text-xl font-black" style={{ color }}>{formatCurrency(treat)}</p>
                      </div>
                      <div className="w-px h-8 bg-white/10" />
                      <div className="text-center">
                        <p className="text-xs text-white/50">割り勘（{participants.length}人）</p>
                        <p className="text-xl font-black text-white">{formatCurrency(split)}</p>
                      </div>
                      <div className="w-px h-8 bg-white/10" />
                      <div className="text-center">
                        <p className="text-xs text-white/50">合計</p>
                        <p className="text-lg font-bold text-white/70">{formatCurrency(bill)}</p>
                      </div>
                    </div>
                  )}

                  {/* ── PRIMARY CTA: シェアする (ISSUE-181 + ISSUE-183) ── */}
                  <motion.button
                    onClick={handlePrimaryShare}
                    className="w-full h-14 rounded-2xl mb-3 font-bold text-base text-white flex items-center justify-center gap-2 active:scale-95 transition-all"
                    style={{
                      background: shareCardDone
                        ? "rgba(255,255,255,0.12)"
                        : `linear-gradient(135deg, ${color}, #EC4899)`,
                      boxShadow: shareCardDone ? "none" : `0 4px 28px ${color}60`,
                    }}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 22 }}
                  >
                    {shareCardDone ? (
                      <><Check className="w-5 h-5" /> シェアしました！</>
                    ) : videoBlob ? (
                      <><Share2 className="w-5 h-5" /> 動画でシェア 🎬</>
                    ) : (
                      <><Share2 className="w-5 h-5" /> シェアする 🎉</>
                    )}
                  </motion.button>

                  {/* X / LINE secondary */}
                  <motion.div
                    className="flex gap-2 mb-5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.22 }}
                  >
                    <Button
                      onClick={() => handleShare("x")}
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs"
                    >
                      <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      X
                    </Button>
                    <Button
                      onClick={() => handleShare("line")}
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs"
                    >
                      <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="#06C755">
                        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                      </svg>
                      LINE
                    </Button>
                  </motion.div>

                  {/* ── ISSUE-213: 絵文字リアクションパネル ── */}
                  {onReact && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.22 }}
                      className="mb-4"
                    >
                      <p className="text-xs text-muted-foreground text-center mb-2">みんなの反応は？</p>
                      <div className="flex gap-2 justify-center flex-wrap">
                        {["😂", "🎉", "😭", "👏", "🔥", "💸", "😤", "🫡"].map((emoji) => (
                          <motion.button
                            key={emoji}
                            whileTap={{ scale: 1.6 }}
                            className="text-2xl p-2 rounded-full hover:bg-white/10 transition-colors active:scale-95"
                            onClick={() => onReact(emoji)}
                          >
                            {emoji}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* ── SECONDARY CTA: グループ保存 (ISSUE-181 格上げ) ── */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.28 }}
                    className="mb-4"
                  >
                    {onSaveGroup && !savedThisSession && (
                      <>
                        {showSaveGroup ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={saveGroupName}
                              onChange={(e) => setSaveGroupName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && saveGroupName.trim()) {
                                  onSaveGroup(saveGroupName.trim())
                                  setSavedThisSession(true)
                                  setShowSaveGroup(false)
                                  setSaveGroupName("")
                                }
                                if (e.key === "Escape") {
                                  setShowSaveGroup(false)
                                  setSaveGroupName("")
                                }
                              }}
                              placeholder="グループ名（例: 飲み会メンバー）"
                              maxLength={20}
                              autoFocus
                              className="flex-1 h-9 px-3 rounded-xl bg-white/10 border border-white/20 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                            />
                            <button
                              onClick={() => {
                                if (saveGroupName.trim()) {
                                  onSaveGroup(saveGroupName.trim())
                                  setSavedThisSession(true)
                                  setShowSaveGroup(false)
                                  setSaveGroupName("")
                                }
                              }}
                              disabled={!saveGroupName.trim()}
                              className="w-9 h-9 rounded-xl bg-primary/80 flex items-center justify-center text-white disabled:opacity-40"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { setShowSaveGroup(false); setSaveGroupName("") }}
                              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-muted-foreground"
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowSaveGroup(true)}
                            className="w-full flex flex-col items-center justify-center gap-0.5 h-14 rounded-2xl border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary transition-all"
                          >
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              <Bookmark className="w-4 h-4" />
                              このメンバーを次回も使う
                            </div>
                            <p className="text-xs text-primary/70">次の飲み会ですぐ呼び出せます</p>
                          </button>
                        )}
                      </>
                    )}
                    {savedThisSession && (
                      <div className="flex items-center justify-center gap-2 h-10 rounded-2xl bg-primary/15 border border-primary/30 text-sm text-primary">
                        <Check className="w-4 h-4" />
                        いつものメンバーに登録しました
                      </div>
                    )}
                    {/* ISSUE-210: グループ保存済みの場合 → ホームで再スタート誘導 */}
                    {!onSaveGroup && !savedThisSession && participants.length > 1 && (
                      <div className="flex items-center justify-between h-10 px-3 rounded-2xl bg-white/5 border border-white/10 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Bookmark className="w-3.5 h-3.5 text-primary/70" />
                          <span>このメンバーは保存済み</span>
                        </div>
                        <Link href="/home" onClick={onClose} className="text-xs text-primary hover:underline">
                          ホームで再スタート →
                        </Link>
                      </div>
                    )}
                  </motion.div>

                  {/* ── ACTIONS: もう一回！/ ホームへ (ISSUE-196: respin elevated) ── */}
                  <motion.div
                    className="flex items-center justify-center gap-3 mb-5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                  >
                    {onRespin && (
                      <button
                        onClick={() => { onRespin(); onClose() }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/20 text-white/80 text-sm font-semibold hover:bg-white/10 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        もう一回！
                      </button>
                    )}
                    <Link href="/home" onClick={onClose} className="px-4 py-2 text-sm text-white/40 hover:text-white transition-colors">
                      ホームへ
                    </Link>
                  </motion.div>

                  {/* ── ACCORDION: 詳細を見る (ISSUE-181 折りたたみ) ── */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mb-4"
                  >
                    <button
                      onClick={() => {
                        if (!showDetails) trackEvent(AnalyticsEvent.DETAILS_ACCORDION_OPENED)
                        setShowDetails((v) => !v)
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-white/40 hover:text-white/70 transition-colors"
                    >
                      {showDetails ? (
                        <><ChevronUp className="w-4 h-4" /> 詳細を閉じる</>
                      ) : (
                        <><ChevronDown className="w-4 h-4" /> 詳細を見る（ランキング・金額）</>
                      )}
                    </button>

                    <AnimatePresence>
                      {showDetails && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          {/* Treat count badge */}
                          {typeof treatCount === "number" && treatCount > 0 && (
                            <div className="flex items-center gap-2 mt-3 mb-3">
                              <div
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold"
                                style={{ background: `${color}22`, color, border: `1px solid ${color}40` }}
                              >
                                <span>🍺</span>
                                <span>通算{treatCount}回奢り</span>
                              </div>
                              {treatTitle && <span className="text-sm text-white/60">{treatTitle}</span>}
                            </div>
                          )}

                          {/* Payment Breakdown */}
                          {hasBillInfo && (
                            <div className="mb-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <Calculator className="w-4 h-4 text-primary" />
                                  <span className="text-sm font-medium text-muted-foreground">お支払い内訳</span>
                                </div>
                                {treatType && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: `${color}25`, color }}>
                                    {treatType}
                                  </span>
                                )}
                              </div>
                              <div className="p-3 rounded-xl mb-2" style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: color, color: "#0B1B2B" }}>
                                      {winner.charAt(0)}
                                    </div>
                                    <div className="text-left">
                                      <p className="text-sm font-medium text-white">{winner}</p>
                                      <p className="text-xs text-muted-foreground">{treat > 0 ? "奢り" : "免除"}</p>
                                    </div>
                                  </div>
                                  <p className="text-xl font-bold" style={{ color }}>{formatCurrency(treat)}</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {participants.filter((_, i) => i !== winnerIndex).map((participant, index) => (
                                  <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-medium text-foreground shrink-0">
                                        {participant.charAt(0)}
                                      </div>
                                      <div className="text-left">
                                        <p className="text-sm font-medium text-white">{participant}</p>
                                        <p className="text-xs text-muted-foreground">{split > 0 ? "割り勘" : "無料"}</p>
                                      </div>
                                    </div>
                                    <p className="text-lg font-semibold text-white">{formatCurrency(split)}</p>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">合計</span>
                                <span className="text-lg font-bold text-white">{formatCurrency(bill)}</span>
                              </div>
                            </div>
                          )}

                          {/* Group ranking */}
                          {ranking && ranking.some((r) => r.count > 0) && (
                            <div className="mb-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                              <div className="flex items-center gap-2 mb-3">
                                <Crown className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium text-muted-foreground">奢りランキング</span>
                              </div>
                              <div className="space-y-2">
                                {ranking.slice(0, 5).map((entry, i) => {
                                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`
                                  const isWinnerEntry = entry.name === winner
                                  return (
                                    <div
                                      key={entry.name}
                                      className="flex items-center gap-2 px-3 py-2 rounded-xl"
                                      style={isWinnerEntry ? { background: `${color}18`, border: `1px solid ${color}35` } : { background: "rgba(255,255,255,0.04)" }}
                                    >
                                      <span className="text-base w-6 shrink-0">{medal}</span>
                                      <span className={`flex-1 text-sm font-medium truncate ${isWinnerEntry ? "text-white" : "text-white/70"}`}>
                                        {entry.name}
                                      </span>
                                      <span className="text-xs text-muted-foreground shrink-0">{entry.count}回</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Guest→Login conversion CTA */}
                  {isGuest && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.45 }}
                      className="mb-5 p-4 rounded-2xl"
                      style={{
                        background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.10) 100%)",
                        border: "1px solid rgba(99,102,241,0.3)",
                      }}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <LogIn className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white leading-snug">この履歴、端末が変わると消えます</p>
                          <p className="text-xs text-white/55 mt-0.5 leading-relaxed">ログインしてクラウドに保存しておこう</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { window.location.href = `/?returnTo=${encodeURIComponent(window.location.pathname)}` }}
                          className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl bg-white hover:bg-gray-50 text-gray-800 text-xs font-semibold transition-all"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                          Google
                        </button>
                        <button
                          onClick={() => { window.location.href = `/api/auth/line/start?returnTo=${encodeURIComponent(window.location.pathname)}` }}
                          className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl text-white text-xs font-semibold transition-all"
                          style={{ backgroundColor: "#06C755" }}
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="white">
                            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                          </svg>
                          LINE
                        </button>
                        <button
                          onClick={() => { startSupabaseOAuth("x", window.location.pathname).catch(() => {}) }}
                          className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl bg-black hover:bg-gray-900 text-white text-xs font-semibold transition-all"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                          </svg>
                          X
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* App branding */}
                  <div className="mt-2 pt-4 border-t border-white/10 flex items-center justify-center gap-2">
                    <Image src="/images/logo-icon.png" alt="OgoRoulette" width={20} height={20} className="rounded-sm" />
                    <span className="text-xs font-medium text-muted-foreground">OgoRoulette</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
