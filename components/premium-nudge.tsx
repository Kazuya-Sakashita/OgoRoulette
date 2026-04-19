"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, Sparkles, Lock } from "lucide-react"
import Link from "next/link"

interface PremiumNudgeProps {
  onDismiss: () => void
}

export function PremiumNudge({ onDismiss }: PremiumNudgeProps) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-60 flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      >
        {/* backdrop */}
        <div className="absolute inset-0 bg-black/50" />

        <motion.div
          className="relative w-full max-w-[420px] rounded-t-3xl bg-[#0B1B2B] border-t border-x border-white/10 p-6 pb-10"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* close */}
          <button
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors"
            onClick={onDismiss}
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>

          {/* header */}
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Premium</span>
          </div>
          <h2 className="text-xl font-black text-foreground mb-1">
            もっと盛り上げる<br />
            <span className="text-gradient">テーマでカスタマイズ</span>
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            ネオン・ゴールド・パーティーなど、飲み会の雰囲気に合わせたテーマが使えるようになります。
          </p>

          {/* theme preview chips */}
          <div className="flex gap-2 mb-6">
            {[
              { label: "デフォルト", color: "#F97316", free: true },
              { label: "ネオン ✨", color: "#22D3EE", free: false },
              { label: "ゴールド 🏆", color: "#F59E0B", free: false },
              { label: "パーティー 🎉", color: "#A855F7", free: false },
            ].map(({ label, color, free }) => (
              <div
                key={label}
                className="relative flex-1 rounded-xl border border-white/10 p-2 text-center"
                style={{ background: `${color}18` }}
              >
                <div
                  className="w-4 h-4 rounded-full mx-auto mb-1"
                  style={{ background: color }}
                />
                <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
                {!free && (
                  <Lock className="absolute top-1 right-1 w-2.5 h-2.5 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>

          {/* CTA */}
          <Link
            href="/premium"
            className="block w-full h-12 rounded-2xl bg-gradient-accent text-white text-sm font-bold text-center leading-[48px] press-effect glow-primary"
            onClick={onDismiss}
          >
            プレミアムを見る（¥300/月〜）
          </Link>
          <button
            className="block w-full mt-3 text-xs text-muted-foreground text-center py-2"
            onClick={onDismiss}
          >
            今は使わない
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
