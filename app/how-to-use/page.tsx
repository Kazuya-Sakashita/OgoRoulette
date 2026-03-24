"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { Check, ChevronDown, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RouletteWheel } from "@/components/roulette-wheel"

// ─── Demo data ──────────────────────────────────────────

const DEMO_NAMES = ["鈴木", "田中", "山田", "佐藤"]
const CHIP_COLORS: [string, string][] = [
  ["#F59E0B", "#FBBF24"],
  ["#F43F5E", "#FB7185"],
  ["#8B5CF6", "#A78BFA"],
  ["#3B82F6", "#60A5FA"],
  ["#22C55E", "#4ADE80"],
]
const STEP_ACCENTS = ["#F97316", "#EC4899", "#A855F7"] as const

// ─── Reusable helpers ────────────────────────────────────

/**
 * スクロールインビュー時にフェードアップするラッパー
 * WHY: 全セクションで同一挙動が必要なため共通化
 */
function FadeUp({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Step visual components ──────────────────────────────

/**
 * Step 01: 参加者リスト + 招待コード
 * WHY: 実際の画面を模した CSS モックでイメージを伝える（スクショ不要）
 */
function Step1Visual() {
  const names = ["鈴木", "田中", "山田", "佐藤", "伊藤"]
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0B1B2B] p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">参加者</span>
        <span className="text-[11px] text-primary font-medium">5 / 8人</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        {names.map((name, i) => (
          <div
            key={name}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/5"
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{
                background: `linear-gradient(135deg, ${CHIP_COLORS[i % 5][0]}, ${CHIP_COLORS[i % 5][1]})`,
              }}
            >
              {name[0]}
            </div>
            <span className="text-[12px] font-medium text-foreground">{name}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary/10 border border-primary/20">
        <span className="text-xl">📲</span>
        <div>
          <p className="text-[10px] text-primary font-semibold">招待コード</p>
          <p className="text-lg font-black text-foreground tracking-widest">GH7K2X</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Step 02: ルーレット + 「運命を回す」ボタン
 * WHY: RouletteWheel を直接使うことで実際の UI が伝わる
 */
function Step2Visual() {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0B1B2B] overflow-hidden">
      <div className="flex flex-col items-center py-6 px-5">
        <div className="relative mb-5">
          <div
            className="absolute inset-0 scale-[1.4] rounded-full blur-2xl pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(249,115,22,0.22) 0%, transparent 70%)" }}
          />
          <RouletteWheel
            size={190}
            participants={DEMO_NAMES}
            isSpinning={false}
          />
        </div>
        <div
          className="w-full h-14 rounded-2xl bg-gradient-accent flex items-center justify-center gap-2 text-white font-bold text-sm"
          style={{ boxShadow: "0 0 24px rgba(249,115,22,0.4)" }}
        >
          🎯 運命を回す
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">オーナー画面</p>
      </div>
    </div>
  )
}

/**
 * Step 03: 結果発表モック
 * WHY: 「山田が当選」という具体的な結果でゴールをイメージさせる
 */
function Step3Visual() {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0B1B2B] px-5 py-7">
      <div className="flex flex-col items-center">
        {/* Confetti dots */}
        <div className="flex gap-1.5 mb-4">
          {(["#F97316", "#EC4899", "#A855F7", "#3B82F6", "#22C55E", "#F59E0B"] as const).map((c, i) => (
            <motion.div
              key={c}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: c }}
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 0.9, delay: i * 0.1, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </div>
        <div
          className="w-16 h-16 rounded-full bg-gradient-accent flex items-center justify-center text-3xl mb-3"
          style={{ boxShadow: "0 0 40px rgba(249,115,22,0.45)" }}
        >
          🎉
        </div>
        <p className="text-xs text-muted-foreground mb-0.5">今日の奢り役</p>
        <p className="text-4xl font-black text-foreground leading-tight">山田</p>
        <p className="text-sm font-semibold text-primary mt-1">さんが奢り確定！</p>
      </div>
    </div>
  )
}

// ─── Step card wrapper ───────────────────────────────────

function StepSection({
  number,
  accentColor,
  title,
  description,
  visual,
}: {
  number: string
  accentColor: string
  title: string
  description: string
  visual: React.ReactNode
}) {
  return (
    <FadeUp>
      <div className="relative">
        {/* Ghost large number — 装飾 */}
        <div
          className="absolute -top-4 -left-2 text-[88px] font-black leading-none select-none pointer-events-none"
          style={{ color: accentColor, opacity: 0.07 }}
        >
          {number}
        </div>
        {/* Visual */}
        <div className="relative mb-5">{visual}</div>
        {/* Text */}
        <div>
          <span
            className="text-[11px] font-bold tracking-widest mb-2 block"
            style={{ color: accentColor }}
          >
            STEP {number}
          </span>
          <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
    </FadeUp>
  )
}

// ─── Page ────────────────────────────────────────────────

export default function HowToUsePage() {
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

  return (
    <main className="bg-background min-h-screen overflow-x-hidden">
      {/* Fixed ambient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] opacity-25 blur-3xl"
          style={{ background: "radial-gradient(ellipse, #F97316 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-1/3 -right-40 w-80 h-80 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #EC4899 0%, transparent 70%)" }}
        />
      </div>

      {/* ════════ HERO ════════ */}
      <section className="mx-auto max-w-[420px] px-5 pt-12 pb-10 flex flex-col items-center text-center">
        {/* Logo */}
        <div
          className={`mb-7 transition-all duration-700 ${
            mounted ? "opacity-100 scale-100" : "opacity-0 scale-90"
          }`}
        >
          <div className="relative inline-block">
            <div className="absolute inset-0 scale-150 bg-primary/20 rounded-full blur-3xl" />
            <Image
              src="/images/logo-icon.png"
              alt="OgoRoulette"
              width={72}
              height={72}
              className="relative w-16 h-16 drop-shadow-2xl"
              priority
            />
          </div>
        </div>

        {/* App name */}
        <p className={`text-sm text-muted-foreground mb-3 font-medium transition-all duration-700 delay-100 ${mounted ? "opacity-100" : "opacity-0"}`}>
          <span className="text-foreground">Ogo</span>
          <span className="text-gradient">Roulette</span>
          {" "}の使い方
        </p>

        {/* Headline */}
        <h1
          className={`text-[2.6rem] font-black tracking-tight leading-tight mb-3 transition-all duration-700 delay-150 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          今日の<span className="text-gradient">奢り</span>は、<br />誰だ？
        </h1>
        <p
          className={`text-base text-muted-foreground mb-1 transition-all duration-700 delay-200 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          友達と集まったら、あとは運命に任せよう。
        </p>
        <p
          className={`text-sm text-muted-foreground/60 mb-8 transition-all duration-700 delay-300 ${
            mounted ? "opacity-100" : "opacity-0"
          }`}
        >
          回す瞬間が、いちばん盛り上がる。
        </p>

        {/* Demo roulette */}
        <div
          className={`relative mb-8 transition-all duration-700 delay-200 ${
            mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <div
            className="absolute inset-0 scale-[1.3] rounded-full blur-3xl pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 70%)" }}
          />
          <RouletteWheel
            size={260}
            participants={DEMO_NAMES}
            isSpinning={false}
          />
        </div>

        {/* CTA */}
        <div
          className={`w-full flex flex-col gap-3 transition-all duration-700 delay-400 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <Button
            asChild
            className="w-full h-14 text-base font-bold rounded-2xl bg-gradient-accent hover:opacity-90 text-white shadow-lg glow-primary press-effect animate-pulse-glow"
          >
            <Link href="/room/create">
              <Sparkles className="w-5 h-5 mr-2" />
              ルームを作る
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full h-12 rounded-2xl border-white/10 bg-secondary hover:bg-white/10 text-foreground font-semibold press-effect"
          >
            <Link href="/home">まず一人で試してみる</Link>
          </Button>
        </div>

        {/* Scroll hint */}
        <motion.div
          animate={{ y: [0, 7, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="mt-12 flex flex-col items-center gap-1 text-muted-foreground/40"
        >
          <span className="text-xs">使い方を見る</span>
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </section>

      {/* ════════ STEPS ════════ */}
      <section className="mx-auto max-w-[420px] px-5 py-10">
        <FadeUp className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-muted-foreground mb-4">
            <Sparkles className="w-3 h-3 text-primary" />
            3ステップで完結
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            シンプルだから、<br />すぐ使える。
          </h2>
        </FadeUp>

        <div className="space-y-14">
          <StepSection
            number="01"
            accentColor={STEP_ACCENTS[0]}
            title="メンバーを集める"
            description="ルームを作って招待コードか QR コードを共有するだけ。みんなが揃ったら準備完了。"
            visual={<Step1Visual />}
          />
          <StepSection
            number="02"
            accentColor={STEP_ACCENTS[1]}
            title="運命を回す"
            description="オーナーが「🎯 運命を回す」を押す。全員が同じ画面を見ながら、ドキドキして待つ。"
            visual={<Step2Visual />}
          />
          <StepSection
            number="03"
            accentColor={STEP_ACCENTS[2]}
            title="結果が決まる"
            description="針が止まった瞬間、全員の画面に同時に結果が出る。盛り上がること保証。"
            visual={<Step3Visual />}
          />
        </div>
      </section>

      {/* ════════ EXCITEMENT ════════ */}
      <section className="mx-auto max-w-[420px] px-5 py-12">
        <FadeUp className="text-center mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-3">
            見ている側も<br />
            <span className="text-gradient">ドキドキする</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            結果が出るまでの数秒が、やけに盛り上がる。
          </p>
        </FadeUp>

        {/* Owner vs Member */}
        <FadeUp delay={0.1}>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {/* Owner */}
            <div className="flex flex-col items-center gap-4 p-5 rounded-3xl glass-card border border-white/10">
              <div className="w-12 h-12 rounded-2xl bg-gradient-accent flex items-center justify-center text-2xl">
                🎯
              </div>
              <div className="text-center w-full">
                <p className="text-[11px] text-muted-foreground mb-2">オーナー</p>
                <div className="px-3 py-2 rounded-xl bg-gradient-accent text-[12px] font-bold text-white text-center">
                  運命を回す
                </div>
              </div>
            </div>

            {/* Member */}
            <div className="flex flex-col items-center gap-4 p-5 rounded-3xl glass-card border border-white/10">
              <div className="w-12 h-12 rounded-2xl bg-secondary border border-white/10 flex items-center justify-center text-2xl">
                😰
              </div>
              <div className="text-center w-full">
                <p className="text-[11px] text-muted-foreground mb-2">メンバー</p>
                <p className="text-sm font-semibold text-foreground">
                  誰が奢る
                  <span className="text-muted-foreground animate-pulse">…？</span>
                </p>
              </div>
            </div>
          </div>
        </FadeUp>

        {/* Reaction tags */}
        <FadeUp delay={0.15}>
          <div className="flex flex-wrap justify-center gap-2">
            {["😱 ドキドキ", "🎉 盛り上がる", "😅 しょうがない", "🤣 最高"].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </FadeUp>
      </section>

      {/* ════════ REASSURANCE ════════ */}
      <section className="mx-auto max-w-[420px] px-5 pb-10">
        <FadeUp>
          <div className="p-6 rounded-3xl glass-card border border-white/10">
            <h3 className="text-base font-bold text-foreground mb-5 text-center">
              むずかしくない、すぐ使える。
            </h3>
            <ul className="space-y-4">
              {[
                "ログイン不要ですぐ体験できる",
                "スマホ 1 台で今すぐ始められる",
                "難しい設定は一切なし",
                "QR コードで全員すぐ参加できる",
              ].map((text) => (
                <li key={text} className="flex items-center gap-3 text-sm text-foreground">
                  <div className="w-5 h-5 rounded-full bg-gradient-accent flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </FadeUp>
      </section>

      {/* ════════ FINAL CTA ════════ */}
      <section className="mx-auto max-w-[420px] px-5 pt-6 pb-20 text-center">
        <FadeUp>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            友達と<span className="text-gradient">やってみよう</span>
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            今日の飲み会、奢りはルーレットで決めよう。
          </p>
          <div className="flex flex-col gap-3">
            <Button
              asChild
              className="w-full h-14 text-base font-bold rounded-2xl bg-gradient-accent hover:opacity-90 text-white shadow-lg glow-primary press-effect animate-pulse-glow"
            >
              <Link href="/room/create">
                <Sparkles className="w-5 h-5 mr-2" />
                ルームを作る
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full h-12 rounded-2xl border-white/10 bg-secondary hover:bg-white/10 text-foreground font-semibold press-effect"
            >
              <Link href="/home">まず一人で試してみる</Link>
            </Button>
          </div>
        </FadeUp>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6">
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground transition-colors">プライバシー</Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-foreground transition-colors">利用規約</Link>
          <span>·</span>
          <Link href="/help" className="hover:text-foreground transition-colors">ヘルプ</Link>
        </div>
        <p className="text-center text-xs text-muted-foreground/50 mt-2">© 2026 OgoRoulette</p>
      </footer>
    </main>
  )
}
