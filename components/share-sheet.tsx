"use client"

/**
 * share-sheet.tsx
 *
 * Full-screen overlay shown after roulette recording completes.
 * Shows a 9:16 video preview and sharing / download actions.
 *
 * Priority:
 *  1. Web Share API with file (iOS 15+ / Android Chrome) — video file sharing
 *  2. Web Share API (URL + text fallback)
 *  3. Platform-specific buttons (X, LINE)
 *  4. Download link
 */

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X as XIcon, Download, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ShareSheetProps {
  blob: Blob
  winner: string
  winnerColor: string
  onClose: () => void
  onRespin: () => void
}

type ShareStatus = "idle" | "sharing" | "shared" | "error"

export function ShareSheet({ blob, winner, winnerColor, onClose, onRespin }: ShareSheetProps) {
  const [videoUrl, setVideoUrl]     = useState<string | null>(null)
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle")
  const [copied, setCopied]         = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const url = URL.createObjectURL(blob)
    setVideoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [blob])

  // Auto-play video preview when URL is ready
  useEffect(() => {
    if (videoUrl && videoRef.current) {
      videoRef.current.load()
    }
  }, [videoUrl])

  const shareText = `🎰 OgoRouletteで${winner}さんが奢りに決定！ #OgoRoulette`
  const shareUrl  = typeof window !== "undefined" ? `${window.location.origin}/result?winner=${encodeURIComponent(winner)}&color=${encodeURIComponent(winnerColor)}` : ""

  const getVideoFile = () =>
    new File([blob], `ogoroulette_${winner}.webm`, { type: blob.type })

  const handleShare = async () => {
    setShareStatus("sharing")
    try {
      const file = getVideoFile()

      // 1. Try sharing video file (iOS 15+ / Android Chrome)
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${winner}さんが今日の奢り担当！`,
          text: shareText,
        })
        setShareStatus("shared")
        return
      }

      // 2. Fallback: share URL + text
      if (navigator.share) {
        await navigator.share({
          title: `${winner}さんが今日の奢り担当！`,
          text: shareText,
          url: shareUrl,
        })
        setShareStatus("shared")
        return
      }

      // 3. Last resort: copy to clipboard
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      setShareStatus("idle")
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setShareStatus("idle") // user cancelled — not an error
      } else {
        setShareStatus("error")
        setTimeout(() => setShareStatus("idle"), 2000)
      }
    }
  }

  const handleDownload = () => {
    if (!videoUrl) return
    const a = document.createElement("a")
    a.href     = videoUrl
    a.download = `ogoroulette_${winner}.webm`
    a.click()
  }

  const shareToX = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      "_blank"
    )
  }

  const shareToLine = () => {
    window.open(
      `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      "_blank"
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80] flex flex-col items-center justify-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Sheet */}
        <motion.div
          className="relative w-full max-w-[390px] rounded-t-3xl overflow-hidden"
          style={{ background: "linear-gradient(180deg, #0F2236 0%, #0B1B2B 100%)" }}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition-all"
          >
            <XIcon className="w-4 h-4" />
          </button>

          <div className="px-5 pb-8 pt-3">
            {/* Header */}
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
              動画を保存・シェア
            </p>
            <h2 className="text-xl font-black text-white mb-4">
              <span style={{ color: winnerColor }}>{winner}</span>さんが奢りに決定！
            </h2>

            {/* Video preview */}
            {videoUrl && (
              <div
                className="mx-auto rounded-2xl overflow-hidden mb-5"
                style={{
                  width: 120,
                  height: 213,
                  boxShadow: `0 0 30px ${winnerColor}40, 0 4px 20px rgba(0,0,0,0.5)`,
                  border: `2px solid ${winnerColor}40`,
                }}
              >
                <video
                  ref={videoRef}
                  src={videoUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Primary CTA — SNS Share */}
            <Button
              onClick={handleShare}
              disabled={shareStatus === "sharing"}
              className="w-full h-14 rounded-2xl font-bold text-base text-white mb-3 transition-all hover:opacity-90 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${winnerColor}, #EC4899)`,
                boxShadow: `0 4px 24px ${winnerColor}50`,
              }}
            >
              {shareStatus === "sharing" ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  シェア中...
                </span>
              ) : shareStatus === "shared" ? (
                "✓ シェアしました！"
              ) : shareStatus === "error" ? (
                "エラー - もう一度お試し"
              ) : copied ? (
                "✓ コピーしました！"
              ) : (
                <span className="flex items-center gap-2">
                  <Share2 className="w-5 h-5" />
                  SNSでシェア
                </span>
              )}
            </Button>

            {/* Secondary actions */}
            <div className="flex gap-2 mb-4">
              {/* Download */}
              <Button
                onClick={handleDownload}
                variant="outline"
                className="flex-1 h-11 rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm"
              >
                <Download className="w-4 h-4 mr-1.5" />
                保存
              </Button>
              {/* X */}
              <Button
                onClick={shareToX}
                variant="outline"
                className="flex-1 h-11 rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm"
              >
                <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                X
              </Button>
              {/* LINE */}
              <Button
                onClick={shareToLine}
                variant="outline"
                className="flex-1 h-11 rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm"
              >
                <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="#06C755">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                </svg>
                LINE
              </Button>
            </div>

            {/* Respin */}
            <Button
              onClick={onRespin}
              variant="outline"
              className="w-full h-12 rounded-2xl border-white/15 bg-transparent text-muted-foreground hover:text-white hover:bg-white/10 text-sm font-medium"
            >
              🎲 もう一度回す
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
