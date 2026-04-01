"use client"

/**
 * share-sheet.tsx
 *
 * Full-screen overlay shown after roulette recording completes.
 * Shows a 9:16 video preview, message template selector, text editor,
 * and sharing / download actions.
 *
 * Platform constraints:
 *  - X / LINE : text + URL intent only — no video via these links
 *  - Web Share API: can share video file (iOS 15+ / Android Chrome)
 *  - Primary CTA uses Web Share API → video file if supported, else URL share
 */

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X as XIcon, Download, Share2, Pencil, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  SHARE_TEMPLATES,
  SharePayload,
  buildShareUrl,
  buildShareText,
  shareToX,
  shareToLine,
  shareWithFile,
  downloadVideo,
  type ShareWithFileResult,
} from "@/lib/share-service"

interface ShareSheetProps {
  blob: Blob
  winner: string
  winnerColor: string
  onClose: () => void
  onRespin?: () => void
  participants?: string[]
  totalBill?: number
  treatAmount?: number
  /** ISSUE-078: ログインユーザーのプロフィール。初回シェア前の公開名確認に使用 */
  profile?: { id: string; displayName: string | null; displayNameConfirmedAt: string | null } | null
  /** ISSUE-078: 確認後に displayNameConfirmedAt を親に伝えるコールバック */
  onProfileConfirmed?: (confirmedAt: string) => void
}

type ShareStatus = "idle" | "sharing" | "shared" | "error"

export function ShareSheet({
  blob,
  winner,
  winnerColor,
  onClose,
  onRespin,
  participants,
  totalBill,
  treatAmount,
  profile,
  onProfileConfirmed,
}: ShareSheetProps) {
  const [videoUrl, setVideoUrl]         = useState<string | null>(null)
  const [shareStatus, setShareStatus]   = useState<ShareStatus>("idle")
  const [copied, setCopied]             = useState(false)
  // ISSUE-103: true if the blob is an image (iOS PNG fallback), false if video
  const isImageBlob = blob.type.startsWith("image/")
  // PC では navigator.canShare({files}) が false → Web Share API でファイルを渡せない
  const canShareFile = typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    (() => { try { const f = new File([blob], "t", { type: blob.type }); return navigator.canShare({ files: [f] }) } catch { return false } })()
  // ISSUE-078: 初回シェア前の公開名確認
  const needsConfirm = profile != null && profile.displayNameConfirmedAt === null
  const [showConfirm, setShowConfirm]   = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState(SHARE_TEMPLATES[0].id)
  const [isEditingText, setIsEditingText] = useState(false)
  const [customText, setCustomText]     = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const payload: SharePayload = {
    winner,
    winnerColor,
    participants,
    totalBill,
    treatAmount,
    videoBlob: blob,
  }

  const shareUrl = buildShareUrl(payload)

  const activeTemplate = SHARE_TEMPLATES.find((t) => t.id === selectedTemplate) ?? SHARE_TEMPLATES[0]
  const generatedText = buildShareText(activeTemplate, payload)
  const shareText = customText !== null ? customText : generatedText

  // Reset custom text when template changes
  const handleSelectTemplate = (id: string) => {
    setSelectedTemplate(id)
    setCustomText(null)
    setIsEditingText(false)
  }

  // Start editing
  const handleStartEdit = () => {
    setCustomText(shareText)
    setIsEditingText(true)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const handleFinishEdit = () => {
    setIsEditingText(false)
  }

  useEffect(() => {
    const url = URL.createObjectURL(blob)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVideoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [blob])

  useEffect(() => {
    if (videoUrl && videoRef.current) {
      videoRef.current.load()
    }
  }, [videoUrl])

  /** ISSUE-078: 確認が必要な場合はシートを挟む。不要なら直接実行 */
  const withConfirm = (action: () => void) => {
    if (needsConfirm) {
      setPendingAction(() => action)
      setShowConfirm(true)
    } else {
      action()
    }
  }

  /** ISSUE-078: 「この名前でシェア」押下 — confirmed_at を記録してから pending action を実行 */
  const handleConfirmAndShare = async () => {
    const now = new Date().toISOString()
    // fire-and-forget — UI は先に進む
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayNameConfirmedAt: now }),
    }).catch(() => {})
    onProfileConfirmed?.(now)
    setShowConfirm(false)
    pendingAction?.()
    setPendingAction(null)
  }

  const handleShareClick = () => withConfirm(handleShare)

  const handleShare = async () => {
    setShareStatus("sharing")
    const result: ShareWithFileResult = await shareWithFile(payload, shareText, shareUrl)
    if (result === "cancelled") {
      setShareStatus("idle")
    } else if (result === "fallback_clipboard") {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      setShareStatus("idle")
    } else {
      setShareStatus("shared")
      setTimeout(() => setShareStatus("idle"), 2500)
    }
  }

  const handleDownload = () => {
    downloadVideo(blob, winner)
  }

  // X intent はテキスト+URLのみ。動画の自動ダウンロードは「保存」ボタンの責務に分離。
  const handleShareToX = () => withConfirm(() => shareToX(shareText, shareUrl))
  const handleShareToLine = () => withConfirm(() => shareToLine(shareText, shareUrl))

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-80 flex flex-col items-center justify-end"
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
          className="relative w-full max-w-97.5 rounded-t-3xl overflow-hidden"
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
              {isImageBlob ? "画像を保存・シェア" : "動画を保存・シェア"}
            </p>
            <h2 className="text-xl font-black text-white mb-4">
              <span style={{ color: winnerColor }}>{winner}</span>さんが奢りに決定！
            </h2>

            {/* Video / image preview */}
            {videoUrl && (
              <div
                className="mx-auto rounded-2xl overflow-hidden mb-4"
                style={{
                  width: 120,
                  height: 213,
                  boxShadow: `0 0 30px ${winnerColor}40, 0 4px 20px rgba(0,0,0,0.5)`,
                  border: `2px solid ${winnerColor}40`,
                }}
              >
                {/* ISSUE-103: show <img> for iOS PNG fallback, <video> for recorded video */}
                {isImageBlob ? (
                  <img src={videoUrl} className="w-full h-full object-cover" alt="シェア画像" />
                ) : (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            )}

            {/* Template selector */}
            <div className="mb-3">
              <p className="text-xs text-white/40 mb-2">メッセージテンプレート</p>
              <div className="flex gap-1.5 flex-wrap">
                {SHARE_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTemplate(t.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      selectedTemplate === t.id
                        ? "text-white"
                        : "bg-white/8 text-white/50 hover:bg-white/12 hover:text-white/70"
                    }`}
                    style={
                      selectedTemplate === t.id
                        ? { background: winnerColor, boxShadow: `0 2px 8px ${winnerColor}50` }
                        : {}
                    }
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message preview / editor */}
            <div className="mb-4 rounded-xl bg-white/5 border border-white/10 p-3">
              {isEditingText ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    ref={textareaRef}
                    value={shareText}
                    onChange={(e) => setCustomText(e.target.value)}
                    rows={3}
                    className="w-full bg-transparent text-white text-sm resize-none outline-none leading-relaxed"
                    maxLength={280}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/30">{shareText.length}/280</span>
                    <button
                      onClick={handleFinishEdit}
                      className="flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      完了
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-white/80 leading-relaxed flex-1">{shareText}</p>
                  <button
                    onClick={handleStartEdit}
                    className="shrink-0 mt-0.5 text-white/30 hover:text-white/60 transition-colors"
                    title="編集"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Primary CTA — SNS Share (video if supported) */}
            <Button
              onClick={handleShareClick}
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
                  {isImageBlob ? "画像をシェア 📸" : canShareFile ? "動画をシェア" : "URLをシェア / コピー"}
                </span>
              )}
            </Button>

            {/* iOS PNG fallback の補足説明 */}
            {isImageBlob && (
              <p className="text-xs text-muted-foreground text-center mb-2">
                iPhoneでは静止画で保存されます
              </p>
            )}

            {/* Platform-specific buttons */}
            <p className="text-xs text-white/50 mb-2">
              {isImageBlob ? "画像を保存してからXに手動で添付できます" : "動画を保存してからXに手動で添付できます"}
              <span className="text-white/40"> · X・LINEはテキストのみ</span>
            </p>
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
              {/* X — テキスト+URLのみ（動画不可）*/}
              <Button
                onClick={handleShareToX}
                variant="outline"
                className="flex-1 h-11 rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm"
              >
                <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span className="flex flex-col items-start leading-none">
                  <span>Xに投稿</span>
                  <span className="text-[10px] text-white/45 font-normal">テキストのみ</span>
                </span>
              </Button>
              {/* LINE — テキスト+URLのみ（動画不可）*/}
              <Button
                onClick={handleShareToLine}
                variant="outline"
                className="flex-1 h-11 rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm"
              >
                <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="#06C755">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.630 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                </svg>
                <span className="flex flex-col items-start leading-none">
                  <span>LINEで送る</span>
                  <span className="text-[10px] text-white/45 font-normal">テキストのみ</span>
                </span>
              </Button>
            </div>

            {/* Respin */}
            {onRespin && (
              <Button
                onClick={onRespin}
                variant="outline"
                className="w-full h-12 rounded-2xl border-white/15 bg-transparent text-muted-foreground hover:text-white hover:bg-white/10 text-sm font-medium"
              >
                🎲 もう一度回す
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* ISSUE-078: 初回シェア前の公開名確認ダイアログ */}
      {showConfirm && profile && (
        <motion.div
          className="absolute inset-0 z-10 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowConfirm(false)} />
          <motion.div
            className="relative w-full max-w-[390px] rounded-t-3xl p-6 border-t border-white/10"
            style={{ background: "linear-gradient(180deg, #162A3E 0%, #0B1B2B 100%)" }}
            initial={{ y: 80 }}
            animate={{ y: 0 }}
          >
            <p className="text-xs text-white/50 uppercase tracking-widest mb-2">📢 SNSに公開される名前の確認</p>
            <p className="text-sm text-white/70 mb-4">
              シェア時にこの名前が表示されます。よろしいですか？
            </p>
            <div className="px-4 py-3 rounded-xl bg-white/8 border border-white/10 mb-5">
              <p className="text-base font-bold text-white">
                {profile.displayName?.trim() || ("ユーザー" + profile.id.slice(-4))}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowConfirm(false)
                  setPendingAction(null)
                }}
                variant="outline"
                className="flex-1 h-11 rounded-xl border-white/15 bg-white/5 text-white text-sm"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleConfirmAndShare}
                className="flex-1 h-11 rounded-xl bg-gradient-accent text-primary-foreground font-bold text-sm"
              >
                この名前でシェア
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
