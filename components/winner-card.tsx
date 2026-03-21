"use client"

import { Button } from "@/components/ui/button"
import { X as XIcon, Crown, Sparkles, Calculator, RotateCcw } from "lucide-react"
import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { SEGMENT_COLORS } from "@/lib/constants"

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
}

const REACTIONS = [
  "ごちそうさまです!",
  "太っ腹!",
  "本日のスポンサー!",
  "神降臨!",
  "ありがとう!",
]

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
}: WinnerCardProps) {
  const color = SEGMENT_COLORS[winnerIndex % SEGMENT_COLORS.length]
  const [reaction] = useState(() => REACTIONS[Math.floor(Math.random() * REACTIONS.length)])
  const [showContent, setShowContent] = useState(false)
  const [showWinner, setShowWinner] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showActions, setShowActions] = useState(false)

  // totalBill が 0 より大きければ支払い内訳を表示する。
  // treatAmount や splitAmount は 0 の場合（全額奢り・割り勘免除）も有効なので、
  // これらを truthy チェックに含めない。
  const hasBillInfo = typeof totalBill === 'number' && totalBill > 0

  const treat = treatAmount ?? 0
  const split = splitAmount ?? 0
  const bill  = totalBill  ?? 0

  // 奢り種別: 合計との比較で判定
  const treatType = !hasBillInfo
    ? null
    : treat >= bill
      ? '全額奢り'
      : treat > 0
        ? '一部奢り'
        : '割り勘'

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount)
  }

  // Staged animation reveal
  useEffect(() => {
    const timer1 = setTimeout(() => setShowContent(true), 200)
    const timer2 = setTimeout(() => setShowWinner(true), 800)
    const timer3 = setTimeout(() => setShowDetails(true), 1400)
    const timer4 = setTimeout(() => setShowPayment(true), 2000)
    const timer5 = setTimeout(() => setShowActions(true), 2500)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      clearTimeout(timer4)
      clearTimeout(timer5)
    }
  }, [])

  const buildShareText = () => {
    let text = `🎰 OgoRouletteで${winner}さんが奢りに決定！ ${reaction}`
    if (hasBillInfo) {
      text += `\n${treatType}: ${formatCurrency(treat)} / 割り勘: ${formatCurrency(split)}`
    }
    return text
  }

  const handleNativeShare = async () => {
    const text = buildShareText()
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: 'OgoRoulette', text, url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`).catch(() => {})
      alert('リンクをコピーしました！')
    }
  }

  const handleShare = (platform: 'x' | 'line') => {
    const text = buildShareText()
    const url = window.location.href
    switch (platform) {
      case 'x':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank')
        break
      case 'line':
        window.open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank')
        break
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-500"
        style={{ opacity: showContent ? 1 : 0 }}
        onClick={onClose}
      />
      
      {/* Animated glow background */}
      <div 
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ opacity: showWinner ? 1 : 0, transition: 'opacity 0.5s ease' }}
      >
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full animate-pulse"
          style={{ 
            background: `radial-gradient(circle, ${color}30 0%, transparent 60%)`,
            filter: 'blur(60px)',
          }}
        />
      </div>
      
      {/* Card */}
      <div 
        className="relative w-full max-w-[340px] rounded-3xl overflow-hidden transition-all duration-500 max-h-[90vh] overflow-y-auto"
        style={{ 
          background: 'linear-gradient(180deg, #0F2236 0%, #0B1B2B 100%)',
          boxShadow: showWinner ? `0 0 100px ${color}50, 0 25px 50px rgba(0,0,0,0.6)` : '0 25px 50px rgba(0,0,0,0.6)',
          transform: showContent ? 'scale(1)' : 'scale(0.9)',
          opacity: showContent ? 1 : 0,
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition-all z-10"
        >
          <XIcon className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="p-8 text-center">
          
          {/* Pre-announcement text */}
          <div 
            className="mb-4 transition-all duration-500"
            style={{ 
              opacity: showContent ? 1 : 0, 
              transform: showContent ? 'translateY(0)' : 'translateY(-10px)' 
            }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">運命の決定</span>
            </div>
          </div>

          {/* Main announcement */}
          <div 
            className="mb-6 transition-all duration-700"
            style={{ 
              opacity: showWinner ? 1 : 0, 
              transform: showWinner ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.9)' 
            }}
          >
            <p className="text-lg text-muted-foreground mb-2">今日のお奢りは...</p>
            
            {/* Winner avatar with crown */}
            <div className="relative inline-block mb-4">
              {/* Crown icon */}
              <div 
                className="absolute -top-6 left-1/2 -translate-x-1/2 transition-all duration-500"
                style={{ 
                  opacity: showWinner ? 1 : 0, 
                  transform: showWinner ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.5)' 
                }}
              >
                <Crown className="w-10 h-10 text-primary fill-primary/30" />
              </div>
              
              {/* Avatar */}
              <div 
                className="w-28 h-28 rounded-full flex items-center justify-center text-4xl font-bold shadow-xl"
                style={{ 
                  background: `linear-gradient(135deg, ${color}, ${color}CC)`,
                  color: '#0B1B2B',
                  boxShadow: `0 0 60px ${color}60, inset 0 2px 10px rgba(255,255,255,0.3)`,
                  border: '4px solid rgba(255,255,255,0.2)'
                }}
              >
                {winner.charAt(0)}
              </div>
              
              {/* Sparkle effects around avatar */}
              <div className="absolute -inset-4 pointer-events-none">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 rounded-full animate-ping"
                    style={{
                      background: color,
                      top: `${20 + Math.sin(i * 60 * Math.PI / 180) * 40}%`,
                      left: `${50 + Math.cos(i * 60 * Math.PI / 180) * 50}%`,
                      animationDelay: `${i * 0.2}s`,
                      animationDuration: '1.5s',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Winner name with dramatic reveal */}
            <h2 
              className="text-4xl font-black text-white mb-1 tracking-tight"
              style={{ 
                textShadow: `0 0 30px ${color}80`,
              }}
            >
              {winner}
            </h2>
            <p className="text-xl text-muted-foreground">さん!</p>
          </div>

          {/* Reaction text */}
          <div 
            className="transition-all duration-500"
            style={{ 
              opacity: showDetails ? 1 : 0, 
              transform: showDetails ? 'translateY(0)' : 'translateY(10px)' 
            }}
          >
            <p 
              className="text-2xl font-bold mb-6 animate-pulse"
              style={{ color }}
            >
              {reaction}
            </p>
          </div>

          {/* Payment Breakdown */}
          {hasBillInfo && (
            <div
              className="mb-6 transition-all duration-700"
              style={{
                opacity: showPayment ? 1 : 0,
                transform: showPayment ? 'translateY(0)' : 'translateY(20px)'
              }}
            >
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">

                {/* Header: title + 奢り種別バッジ */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-muted-foreground">お支払い内訳</span>
                  </div>
                  {treatType && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: `${color}25`, color }}
                    >
                      {treatType}
                    </span>
                  )}
                </div>

                {/* Winner row */}
                <div
                  className="p-3 rounded-xl mb-2"
                  style={{ background: `${color}20`, border: `1px solid ${color}40` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ background: color, color: '#0B1B2B' }}
                      >
                        {winner.charAt(0)}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-white">{winner}</p>
                        <p className="text-xs text-muted-foreground">
                          {treat > 0 ? '奢り' : '免除'}
                        </p>
                      </div>
                    </div>
                    <p className="text-xl font-bold" style={{ color }}>
                      {formatCurrency(treat)}
                    </p>
                  </div>
                </div>

                {/* Non-winner rows */}
                <div className="space-y-2">
                  {participants
                    .filter((_, i) => i !== winnerIndex)
                    .map((participant, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-medium text-foreground shrink-0">
                            {participant.charAt(0)}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-white">{participant}</p>
                            <p className="text-xs text-muted-foreground">
                              {split > 0 ? '割り勘' : '無料'}
                            </p>
                          </div>
                        </div>
                        <p className="text-lg font-semibold text-white">
                          {formatCurrency(split)}
                        </p>
                      </div>
                    ))}
                </div>

                {/* Total row */}
                <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">合計</span>
                  <span className="text-lg font-bold text-white">{formatCurrency(bill)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Share buttons */}
          <div 
            className="transition-all duration-500"
            style={{ 
              opacity: showDetails ? 1 : 0, 
              transform: showDetails ? 'translateY(0)' : 'translateY(10px)' 
            }}
          >
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                結果をシェア
              </p>
              <div className="flex justify-center gap-2">
                {/* Native Share (モバイルでは共有シートが開く) */}
                <Button
                  onClick={handleNativeShare}
                  variant="outline"
                  size="sm"
                  className="h-10 px-4 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs"
                >
                  <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  シェア
                </Button>

                {/* X (Twitter) */}
                <Button
                  onClick={() => handleShare('x')}
                  variant="outline"
                  size="sm"
                  className="h-10 px-4 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs"
                >
                  <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  X
                </Button>

                {/* LINE */}
                <Button
                  onClick={() => handleShare('line')}
                  variant="outline"
                  size="sm"
                  className="h-10 px-4 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs"
                >
                  <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="#06C755">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                  </svg>
                  LINE
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Next actions */}
        <div
          className="mt-4 space-y-2 transition-all duration-500"
          style={{
            opacity: showActions ? 1 : 0,
            transform: showActions ? 'translateY(0)' : 'translateY(8px)',
          }}
        >
          {isOwner && onRespin && (
            <Button
              onClick={onRespin}
              className="w-full h-12 rounded-2xl bg-gradient-accent hover:opacity-90 text-white font-semibold text-sm transition-all"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              もう一回！
            </Button>
          )}
          {isOwner && roomCode && !onRespin && (
            <Button
              asChild
              className="w-full h-12 rounded-2xl bg-gradient-accent hover:opacity-90 text-white font-semibold text-sm transition-all"
            >
              <Link href="/room/create" onClick={onClose}>
                <RotateCcw className="w-4 h-4 mr-2" />
                新しい抽選を作る
              </Link>
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            className="w-full h-12 rounded-2xl border-white/20 bg-transparent text-white hover:bg-white/10 font-semibold text-sm transition-all"
          >
            <Link href="/home" onClick={onClose}>
              ホームへ戻る
            </Link>
          </Button>
        </div>

        {/* App branding */}
        <div
          className="border-t border-white/10 py-4 px-8 flex items-center justify-center gap-2 transition-all duration-500"
          style={{
            opacity: showDetails ? 1 : 0,
          }}
        >
          <Image
            src="/images/logo-icon.png"
            alt="OgoRoulette"
            width={20}
            height={20}
            className="rounded-sm"
          />
          <span className="text-xs font-medium text-muted-foreground">OgoRoulette</span>
        </div>
      </div>
    </div>
  )
}
