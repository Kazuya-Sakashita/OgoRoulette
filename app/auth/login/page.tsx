"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { useState, Suspense } from "react"
import { ArrowLeft, QrCode } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { startSupabaseOAuth, startLineAuth, type SupabaseOAuthProvider } from "@/lib/auth"

function LoginContent() {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()

  // returnTo: ログイン後に戻るべきパス（例: /room/ABCDEF/play）
  const returnTo = searchParams.get("returnTo")

  const handleSocialLogin = async (provider: SupabaseOAuthProvider) => {
    setIsLoading(provider)
    setError(null)

    try {
      await startSupabaseOAuth(provider, returnTo)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました")
      setIsLoading(null)
    }
  }

  const handleLineLogin = () => {
    setIsLoading("line")
    setError(null)
    startLineAuth(returnTo)
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-5 py-8">
      {/* Mobile-first container */}
      <div className="w-full max-w-[420px]">

        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          戻る
        </Link>

        {/* Login Card */}
        <div className="glass rounded-3xl p-8 border border-white/10 shadow-soft">

          {/* Logo & Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="mb-5">
              <Image
                src="/images/logo-icon.png"
                alt="OgoRoulette"
                width={64}
                height={64}
                className="w-16 h-16 drop-shadow-lg"
                priority
              />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              OgoRoulette
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              SNSでサインイン
            </p>
          </div>

          {/* Social Login Buttons */}
          <div className="flex flex-col gap-3">

            {/* Google */}
            <button
              onClick={() => handleSocialLogin("google")}
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

            {/* LINE */}
            <button
              onClick={handleLineLogin}
              disabled={isLoading !== null}
              className="w-full h-14 flex items-center justify-center gap-3 rounded-2xl bg-[#06C755] hover:bg-[#05b34d] active:bg-[#049940] text-white text-base font-semibold press-effect transition-all shadow-soft disabled:opacity-50"
            >
              {isLoading === "line" ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                  </svg>
                  LINEで続ける
                </>
              )}
            </button>

            {/* X (Twitter) */}
            <button
              onClick={() => handleSocialLogin("x")}
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
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive text-center">
              {error}
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-muted-foreground">または</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* QR Join - /scan へ遷移 */}
          <Button
            asChild
            variant="ghost"
            className="w-full h-12 text-sm font-medium text-primary hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
          >
            <Link href="/scan">
              <QrCode className="w-5 h-5 mr-2" />
              QRコードでルームに参加
            </Link>
          </Button>
        </div>

        {/* Terms */}
        <p className="mt-6 text-xs text-muted-foreground text-center leading-relaxed px-4">
          続行することで、
          <Link href="/terms" className="text-primary hover:underline">利用規約</Link>
          と
          <Link href="/privacy" className="text-primary hover:underline">プライバシーポリシー</Link>
          に同意したことになります
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <LoginContent />
    </Suspense>
  )
}
