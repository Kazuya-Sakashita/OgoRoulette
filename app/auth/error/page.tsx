"use client"

import { Button } from "@/components/ui/button"
import { Gift, AlertCircle, Clock } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const reason = searchParams.get("reason")
  const retryAfterStr = searchParams.get("retry_after")
  const isRateLimit = reason === "rate_limit"

  const retryMinutes = retryAfterStr
    ? Math.ceil(Number(retryAfterStr) / 60)
    : null

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-destructive/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-20 w-60 h-60 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
            <Gift className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-foreground">Ogo</span>
            <span className="text-gradient">Roulette</span>
          </h1>
        </Link>

        {/* Error Card */}
        <div className="w-full max-w-sm">
          <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-xl text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${isRateLimit ? "bg-amber-500/10" : "bg-destructive/10"}`}>
              {isRateLimit
                ? <Clock className="w-8 h-8 text-amber-500" />
                : <AlertCircle className="w-8 h-8 text-destructive" />
              }
            </div>

            <h2 className="text-2xl font-black text-foreground mb-2">
              {isRateLimit ? "しばらくお待ちください" : "ログインエラー"}
            </h2>
            <p className="text-muted-foreground mb-8">
              {isRateLimit ? (
                <>
                  ログイン試行が多すぎます。
                  <br />
                  {retryMinutes
                    ? `約${retryMinutes}分後にもう一度お試しください。`
                    : "しばらく経ってからもう一度お試しください。"}
                </>
              ) : (
                <>
                  認証中にエラーが発生しました。
                  <br />
                  もう一度お試しください。
                </>
              )}
            </p>

            <div className="flex flex-col gap-3">
              <Button
                asChild
                size="lg"
                className="w-full h-14 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Link href="/auth/login">
                  ログインに戻る
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full h-14 text-lg font-bold rounded-2xl border-2 border-muted-foreground/30 bg-card hover:bg-secondary text-foreground"
              >
                <Link href="/">
                  ホームに戻る
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
