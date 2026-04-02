"use client"

import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { startSupabaseOAuth, startLineAuth } from "@/lib/auth"
import { RouletteWheel } from "@/components/roulette-wheel"
import { QrCode, Users } from "lucide-react"

// ISSUE-096: Demo spin names shown on the welcome page
const DEMO_NAMES = ["さくら", "たろう", "はな"]

export default function WelcomePage() {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Demo roulette state — uses real RouletteWheel component
  const [demoSpinning, setDemoSpinning] = useState(false)
  const [demoWinner, setDemoWinner] = useState<string | null>(null)
  const [demoWinnerIdx, setDemoWinnerIdx] = useState<number>(0)
  const router = useRouter()

  useEffect(() => {
    // Check if user is already logged in or has visited before
    const checkUserOrVisited = async () => {
      // Check localStorage for returning guest
      const hasVisited = localStorage.getItem('ogoroulette_visited')

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // Redirect to home if logged in OR if returning visitor
      if (user || hasVisited) {
        const params = new URLSearchParams(window.location.search)
        const returnTo = params.get("returnTo")
        // Validate: relative path only, no protocol-relative URLs
        const safeReturn = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/home"
        router.push(safeReturn)
      }
    }
    checkUserOrVisited()
  }, [router])

  const getReturnTo = () => {
    const params = new URLSearchParams(window.location.search)
    return params.get("returnTo")
  }

  const handleLineLogin = () => {
    setIsLoading("line")
    startLineAuth(getReturnTo())
  }

  const handleGoogleLogin = async () => {
    setIsLoading("google")
    setError(null)

    try {
      await startSupabaseOAuth("google", getReturnTo())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました")
      setIsLoading(null)
    }
  }

  // Demo roulette — uses real RouletteWheel component
  const handleDemoSpin = () => {
    if (demoSpinning) return
    setDemoWinner(null)
    const idx = Math.floor(Math.random() * DEMO_NAMES.length)
    setDemoWinnerIdx(idx)
    setDemoSpinning(true)
  }

  const handleDemoComplete = (name: string) => {
    setDemoSpinning(false)
    setDemoWinner(name)
  }

  const handleXLogin = async () => {
    setIsLoading("x")
    setError(null)

    try {
      await startSupabaseOAuth("x", getReturnTo())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました")
      setIsLoading(null)
    }
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      {/* Background orbs for visual appeal */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #F59E0B 0%, transparent 70%)' }}
        />
        <div 
          className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, #22C55E 0%, transparent 70%)' }}
        />
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-[360px] md:max-w-md flex flex-col items-center text-center animate-fade-in-up">
        {/* Logo with animation */}
        <div className="mb-6 animate-fade-in-up-delay-1">
          <div className="relative">
            {/* Glow behind logo */}
            <div className="absolute inset-0 scale-150 bg-primary/20 rounded-full blur-3xl" />
            <Image 
              src="/images/logo-icon.png" 
              alt="OgoRoulette" 
              width={120} 
              height={120}
              className="relative w-28 h-28 drop-shadow-2xl"
              priority
            />
          </div>
        </div>

        {/* App Name */}
        <h1 className="text-4xl font-bold tracking-tight mb-3 animate-fade-in-up-delay-2">
          <span className="text-foreground">Ogo</span>
          <span className="text-gradient">Roulette</span>
        </h1>

        {/* Tagline */}
        <p className="text-lg text-muted-foreground mb-10 animate-fade-in-up-delay-3">
          おごりをルーレットで決めよう
        </p>

        {/* Demo Roulette — real RouletteWheel component */}
        <div className="w-full mb-6 animate-fade-in-up-delay-3">
          {demoWinner ? (
            <div className="text-center p-5 rounded-2xl bg-primary/10 border border-primary/20">
              <div className="text-2xl font-black text-foreground mb-1">
                🎉 {demoWinner}さん が奢り！
              </div>
              {/* ISSUE-136: デモ当選後に「支払い額」を表示してアプリの価値を即座に伝える */}
              <div className="flex items-center justify-center gap-3 my-3 py-2 rounded-xl bg-white/5">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">合計</p>
                  <p className="text-lg font-bold text-foreground">¥4,500</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">割り勘（3人）</p>
                  <p className="text-lg font-bold text-primary">¥1,500</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                あなたのグループで本当に決めてみませんか？
              </p>
              <button
                onClick={() => {
                  localStorage.setItem('ogoroulette_visited', 'true')
                  router.push('/home')
                }}
                className="w-full h-12 rounded-xl text-white font-semibold text-sm"
                style={{ background: 'linear-gradient(to right, #F97316, #EC4899)' }}
              >
                グループを作って試す →
              </button>
              <button
                onClick={() => setDemoWinner(null)}
                className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                もう一度回す
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <p className="text-xs text-muted-foreground">⬇ 試しに回してみる</p>
              <div className="relative">
                <div
                  className="absolute inset-0 scale-[1.35] rounded-full blur-2xl pointer-events-none"
                  style={{ background: "radial-gradient(circle, rgba(249,115,22,0.2) 0%, transparent 70%)" }}
                />
                <RouletteWheel
                  size={220}
                  participants={DEMO_NAMES}
                  isSpinning={demoSpinning}
                  targetWinnerIndex={demoWinnerIdx}
                  onSpinComplete={handleDemoComplete}
                />
              </div>
              <button
                onClick={handleDemoSpin}
                disabled={demoSpinning}
                className="w-full h-12 rounded-xl text-white font-semibold text-base disabled:opacity-50 transition-opacity"
                style={{ background: 'linear-gradient(to right, #F97316, #EC4899)' }}
              >
                {demoSpinning ? '回転中...' : '🎰 回す'}
              </button>
            </div>
          )}
        </div>

        {/* Room feature section — みんなで参加 */}
        <div className="w-full mb-6 animate-fade-in-up-delay-3">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, #F97316, #EC4899)" }}>
                <Users className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">友達みんなで参加できる</p>
                <p className="text-xs text-muted-foreground">QRコードを見せるだけ — 全員の画面が同時に動く</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                <QrCode className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground">QRコードでワンタップ参加</span>
              </div>
              <Link
                href="/how-to-use"
                className="text-xs text-primary font-medium hover:underline whitespace-nowrap"
              >
                詳しく →
              </Link>
            </div>
          </div>
        </div>

        {/* Buttons Container */}
        <div className="w-full space-y-4 animate-fade-in-up-delay-4">
          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading !== null}
            className="w-full h-14 flex items-center justify-center gap-3 rounded-2xl bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-800 text-base font-semibold press-effect transition-all shadow-soft disabled:opacity-50"
          >
            {isLoading === "google" ? (
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Googleで続ける
              </>
            )}
          </button>

          {/* LINE Login Button */}
          <button
            onClick={handleLineLogin}
            disabled={isLoading !== null}
            className="w-full h-14 flex items-center justify-center gap-3 rounded-2xl text-white text-base font-semibold press-effect transition-all shadow-soft disabled:opacity-50"
            style={{ backgroundColor: isLoading !== null ? undefined : '#06C755', background: '#06C755' }}
          >
            {isLoading === "line" ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                </svg>
                LINEで続ける
              </>
            )}
          </button>

          {/* X (Twitter) */}
          <button
            onClick={handleXLogin}
            disabled={isLoading !== null}
            className="w-full h-14 flex items-center justify-center gap-3 rounded-2xl bg-black hover:bg-gray-900 active:bg-gray-800 text-white text-base font-semibold press-effect transition-all shadow-soft disabled:opacity-50"
          >
            {isLoading === "x" ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Xで続ける
              </>
            )}
          </button>

          {/* Sub text for Google login */}
          <p className="text-xs text-muted-foreground">
            保存・共有・履歴が使えます
          </p>

          {/* Divider */}
          <div className="flex items-center gap-4 py-2">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Try without login */}
          <Button
            variant="outline"
            onClick={() => {
              localStorage.setItem('ogoroulette_visited', 'true')
              router.push('/home')
            }}
            className="w-full h-14 rounded-2xl border-white/10 bg-secondary hover:bg-white/10 text-foreground font-semibold press-effect text-base"
          >
            まず試してみる
          </Button>

          {/* Sub text for guest mode */}
          <p className="text-xs text-muted-foreground">
            ログイン不要で体験できます
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive text-center w-full">
            {error}
          </div>
        )}

        {/* ISSUE-137: ソーシャルプルーフ — 利用者の安心感と信頼を高める */}
        <div className="mt-6 flex items-center justify-center gap-4 animate-fade-in-up-delay-5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <span>🎰</span>
            <span>飲み会・合コン・社内で人気</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <span>🔒</span>
            <span>本名は公開されません</span>
          </div>
        </div>

        {/* How to use link */}
        <p className="mt-4 animate-fade-in-up-delay-5">
          <Link href="/how-to-use" className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4">
            使い方を見る →
          </Link>
        </p>

        {/* Terms */}
        <p className="mt-5 text-xs text-muted-foreground leading-relaxed animate-fade-in-up-delay-5">
          続行することで、
          <Link href="/terms" className="text-primary hover:underline">利用規約</Link>
          と
          <Link href="/privacy" className="text-primary hover:underline">プライバシーポリシー</Link>
          に同意したことになります
        </p>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-6 text-xs text-muted-foreground/60 animate-fade-in-up-delay-5">
        © 2026 OgoRoulette
      </footer>
    </main>
  )
}
