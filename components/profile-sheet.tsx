"use client"

/**
 * profile-sheet.tsx
 *
 * ISSUE-079: ログインユーザーが display_name（公開名）を変更するボトムシート。
 * ヘッダーのユーザーアイコンボタンから開く。
 */

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X as XIcon, User, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getDisplayName, buildFallbackName } from "@/lib/display-name"

interface ProfileSheetProps {
  profile: { id: string; displayName: string | null }
  onClose: () => void
  onSaved: (displayName: string | null) => void
}

export function ProfileSheet({ profile, onClose, onSaved }: ProfileSheetProps) {
  const currentDisplayName = profile.displayName ?? ""
  const fallbackName = buildFallbackName(profile.id)
  const [inputValue, setInputValue] = useState(currentDisplayName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: inputValue }),
      })
      if (!res.ok) throw new Error("保存に失敗しました")
      const updated = await res.json()
      setSaved(true)
      onSaved(updated.displayName ?? null)
      setTimeout(() => {
        setSaved(false)
        onClose()
      }, 1200)
    } catch {
      setError("保存に失敗しました。もう一度お試しください。")
    } finally {
      setSaving(false)
    }
  }

  const previewName = inputValue.trim() ? inputValue.trim() : fallbackName

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
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Sheet */}
        <motion.div
          className="relative w-full max-w-[390px] rounded-t-3xl overflow-hidden bg-card border-t border-white/10"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition-all"
          >
            <XIcon className="w-4 h-4" />
          </button>

          <div className="px-5 pb-8 pt-2">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-accent flex items-center justify-center">
                <User className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">プロフィール</h2>
                <p className="text-xs text-muted-foreground">公開名（SNSに表示される名前）</p>
              </div>
            </div>

            {/* Input */}
            <div className="mb-2">
              <label className="block text-xs text-muted-foreground mb-2">
                公開名
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value.slice(0, 20))
                  setError(null)
                }}
                placeholder={fallbackName}
                maxLength={20}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className="w-full h-12 px-4 text-base text-foreground bg-secondary rounded-xl border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/40"
              />
            </div>

            {/* Character count */}
            <p className="text-xs text-muted-foreground text-right mb-4">
              {inputValue.length}/20
            </p>

            {/* Preview */}
            <div className="mb-4 p-3 rounded-xl bg-secondary border border-white/8">
              <p className="text-xs text-muted-foreground mb-1">SNSに表示される名前</p>
              <p className="text-sm font-semibold text-foreground">{previewName}</p>
              {!inputValue.trim() && (
                <p className="text-xs text-muted-foreground/60 mt-1">
                  ※ 空欄の場合は自動生成名になります
                </p>
              )}
            </div>

            {/* Note */}
            <div className="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-400 leading-relaxed">
                本名ではなくニックネームを設定することをお勧めします。設定した名前はシェア時にSNSに公開されます。
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive text-center">{error}</p>
              </div>
            )}

            {/* Save button */}
            <Button
              onClick={handleSave}
              disabled={saving || saved}
              className="w-full h-12 rounded-xl bg-gradient-accent hover:opacity-90 text-primary-foreground font-bold press-effect"
            >
              {saved ? (
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  保存しました
                </span>
              ) : saving ? (
                "保存中..."
              ) : (
                "保存する"
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
