"use client"

import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"

export default function RoomError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[RoomError] digest:", error.digest, "\n", error)
  }, [error])

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-destructive/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-20 w-60 h-60 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="relative text-center max-w-sm w-full">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>

        <h1 className="text-xl font-bold text-foreground mb-3">
          ルームの読み込みに失敗しました
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          ルーレットの結果は保存されています。再試行してください。
        </p>

        <div className="flex flex-col gap-3">
          <Button
            onClick={reset}
            className="w-full h-14 text-base font-bold rounded-2xl bg-gradient-accent text-primary-foreground"
          >
            再試行する
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full h-14 text-base font-bold rounded-2xl border-white/10 bg-secondary text-foreground"
          >
            <Link href="/home">ホームに戻る</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
