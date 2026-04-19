import type { Metadata } from "next"
import Link from "next/link"
import { Check, Lock, Sparkles, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "OgoRoulette Premium — テーマでもっと盛り上げよう",
  description: "プレミアムテーマでルーレットをカスタマイズ。飲み会・合コン・ランチをさらに盛り上げる OgoRoulette Premium。",
  alternates: { canonical: "https://ogo-roulette.vercel.app/premium" },
}

const THEMES = [
  { id: "default", name: "デフォルト", color: "#F97316", free: true, emoji: "🎯" },
  { id: "neon", name: "ネオン", color: "#22D3EE", free: false, emoji: "✨" },
  { id: "gold", name: "ゴールド", color: "#F59E0B", free: false, emoji: "🏆" },
  { id: "party", name: "パーティー", color: "#A855F7", free: false, emoji: "🎉" },
]

const FREE_FEATURES = [
  "ルーム作成・参加（最大 10人）",
  "リアルタイム同期ルーレット",
  "QRコードで即参加",
  "ルーム履歴 7日間",
]

const PREMIUM_FEATURES = [
  "全テーマ使い放題（ネオン・ゴールド・パーティー）",
  "ルーム最大 20人",
  "ルーム履歴無制限",
  "ルーム名にチーム・ブランド名を設定",
  "当選者へのコメント機能",
]

export default function PremiumPage() {
  return (
    <div className="min-h-dvh bg-[#080F1C] text-foreground">
      <div className="mx-auto max-w-[420px] px-5 pt-14 pb-20">

        {/* header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-xs font-semibold text-amber-400 mb-4">
            <Sparkles className="w-3 h-3" />
            OgoRoulette Premium
          </div>
          <h1 className="text-3xl font-black mb-3">
            盛り上げを<br />
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              もう一段階上へ
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            飲み会・合コン・ランチの雰囲気に合わせたテーマで、ルーレットをもっと特別な体験に。
          </p>
        </div>

        {/* theme preview */}
        <div className="mb-8">
          <p className="text-xs text-muted-foreground font-medium mb-3">テーマプレビュー</p>
          <div className="grid grid-cols-4 gap-2">
            {THEMES.map(({ id, name, color, free, emoji }) => (
              <div
                key={id}
                className="relative rounded-2xl border border-white/10 p-3 text-center"
                style={{ background: `${color}15` }}
              >
                <div
                  className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-lg"
                  style={{ background: `${color}33`, border: `2px solid ${color}66` }}
                >
                  {emoji}
                </div>
                <p className="text-[10px] text-muted-foreground">{name}</p>
                {free ? (
                  <span className="block text-[9px] text-green-400 mt-0.5">無料</span>
                ) : (
                  <Lock className="absolute top-2 right-2 w-3 h-3 text-amber-400" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* plan comparison */}
        <div className="space-y-4 mb-10">

          {/* free */}
          <div className="rounded-2xl border border-white/10 glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-foreground">Free</p>
              <p className="text-lg font-black text-foreground">¥0</p>
            </div>
            <ul className="space-y-2">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* premium */}
          <div className="rounded-2xl border border-amber-400/40 p-5 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(249,115,22,0.06) 100%)" }}
          >
            <div className="absolute top-3 right-3">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-black text-amber-400">Premium</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">近日公開</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-foreground">¥300<span className="text-xs font-normal text-muted-foreground">/月〜</span></p>
              </div>
            </div>
            <ul className="space-y-2">
              {PREMIUM_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-foreground">
                  <Check className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CTA — waitlist (Stripe 未連携のため Coming Soon) */}
        <div className="text-center mb-6">
          <p className="text-xs text-muted-foreground mb-4">
            プレミアムは現在準備中です。<br />リリース時にお知らせを受け取れます。
          </p>
          <Button
            asChild
            className="w-full h-14 text-base font-bold rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:opacity-90 text-white shadow-lg press-effect"
          >
            <a
              href="https://forms.gle/placeholder"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Crown className="w-5 h-5 mr-2" />
              リリース通知を受け取る
            </a>
          </Button>
        </div>

        <div className="text-center">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← ホームに戻る
          </Link>
        </div>

      </div>
    </div>
  )
}
