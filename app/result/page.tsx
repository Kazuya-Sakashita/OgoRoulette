"use client"

import { Button } from "@/components/ui/button"
import { Confetti } from "@/components/confetti"
import { ArrowLeft, Share2, Crown, Sparkles, Copy, Check } from "lucide-react"
import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

function ResultContent() {
  const searchParams = useSearchParams()
  const [showConfetti, setShowConfetti] = useState(true)
  const [copied, setCopied] = useState(false)

  const totalBill = Number(searchParams.get('total')) || 30000
  const treatAmount = Number(searchParams.get('treat')) || 20000
  const treaterName = searchParams.get('treater') || 'A'
  const participantNames = (searchParams.get('participants') || 'A,B,C,D,E').split(',')

  const remainingAmount = Math.max(0, totalBill - treatAmount)
  const nonTreaters = participantNames.filter(name => name !== treaterName)
  const splitAmount = nonTreaters.length > 0 ? Math.ceil(remainingAmount / nonTreaters.length) : 0

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount)
  }

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 4000)
    return () => clearTimeout(timer)
  }, [])

  const handleShare = () => {
    const text = `OgoRouletteで${treaterName}さんが${formatCurrency(treatAmount)}奢り!\n残り${formatCurrency(remainingAmount)}は${nonTreaters.length}人で割り勘 → 1人${formatCurrency(splitAmount)}`
    
    if (navigator.share) {
      navigator.share({ text, url: window.location.href })
    } else {
      navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCopy = () => {
    const text = `${treaterName}さん: ${formatCurrency(treatAmount)} (奢り)\n${nonTreaters.map(name => `${name}さん: ${formatCurrency(splitAmount)}`).join('\n')}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="min-h-screen bg-[#F8F9FA]">
      <Confetti active={showConfetti} />

      {/* App Bar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/50">
        <div className="max-w-[420px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="text-gray-600 hover:text-gray-900 -ml-2">
              <Link href="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <h1 className="text-lg font-semibold text-gray-900">支払い結果</h1>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleShare}
            className="text-gray-600 hover:text-gray-900"
          >
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div className="max-w-[420px] mx-auto px-4 py-6 space-y-6">
        
        {/* Payer Highlight Card */}
        <div className="relative bg-gradient-to-br from-orange-500 via-pink-500 to-purple-500 rounded-3xl p-8 text-white text-center overflow-hidden shadow-xl">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-4 left-4 w-24 h-24 rounded-full bg-white/30 blur-2xl" />
            <div className="absolute bottom-4 right-4 w-32 h-32 rounded-full bg-white/20 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm mb-4">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Today&apos;s Payer</span>
            </div>

            {/* Crown */}
            <div className="flex justify-center mb-2">
              <Crown className="w-12 h-12 text-yellow-300 fill-yellow-300/30" />
            </div>

            {/* Avatar */}
            <div className="w-24 h-24 mx-auto rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-4xl font-black mb-4 border-4 border-white/40 shadow-lg">
              {treaterName.charAt(0)}
            </div>

            <h2 className="text-3xl font-black mb-1">{treaterName}さん</h2>
            <p className="text-white/80 text-lg">ごちそうさまです!</p>
          </div>
        </div>

        {/* Bill Split Summary Card */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900 mb-4">支払い内訳</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center text-gray-600">
                <span>合計金額</span>
                <span className="font-semibold text-gray-900">{formatCurrency(totalBill)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>奢り金額</span>
                <span className="font-semibold text-orange-500">{formatCurrency(treatAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>残り（割り勘）</span>
                <span className="font-semibold text-gray-900">{formatCurrency(remainingAmount)}</span>
              </div>
            </div>
          </div>

          {/* Payment Breakdown List */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-gray-500">各自の支払い</h4>
              <button 
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'コピーしました' : 'コピー'}
              </button>
            </div>

            <div className="space-y-2">
              {/* Treater */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-orange-50 to-pink-50 border border-orange-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold">
                    {treaterName.charAt(0)}
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">{treaterName}</span>
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-orange-500 text-white">奢り</span>
                  </div>
                </div>
                <span className="text-lg font-bold text-orange-600">{formatCurrency(treatAmount)}</span>
              </div>

              {/* Non-treaters */}
              {nonTreaters.map((name, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-2xl bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                      {name.charAt(0)}
                    </div>
                    <span className="font-medium text-gray-900">{name}</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(splitAmount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Share Buttons */}
        <div className="flex gap-3">
          <Button 
            onClick={() => {
              const text = `OgoRouletteで${treaterName}さんが奢り!`
              window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
            }}
            variant="outline"
            className="flex-1 h-12 rounded-2xl border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Xで共有
          </Button>
          <Button 
            onClick={() => {
              const text = `OgoRouletteで${treaterName}さんが奢り!`
              window.open(`https://social-plugins.line.me/lineit/share?text=${encodeURIComponent(text)}`, '_blank')
            }}
            variant="outline"
            className="flex-1 h-12 rounded-2xl border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="#06C755">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
            </svg>
            LINEで共有
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <Button 
            asChild
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 hover:opacity-90 text-white font-semibold text-lg shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98]"
          >
            <Link href="/">
              新しいルーレット
            </Link>
          </Button>
          <Button 
            asChild
            variant="outline"
            className="w-full h-14 rounded-2xl border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-lg"
          >
            <Link href="/history">
              履歴を見る
            </Link>
          </Button>
        </div>
      </div>
    </main>
  )
}

export default function ResultPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </main>
    }>
      <ResultContent />
    </Suspense>
  )
}
