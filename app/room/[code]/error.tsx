"use client"

import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"

function isChunkLoadError(error: Error): boolean {
  return (
    error.name === "ChunkLoadError" ||
    error.message?.includes("Failed to load chunk") ||
    error.message?.includes("Loading chunk") ||
    error.message?.includes("dynamically imported module")
  )
}

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

  // ChunkLoadError: キャッシュバイパスリロードで自動回復。無限ループは sessionStorage でガード
  useEffect(() => {
    if (!isChunkLoadError(error)) return
    const RELOAD_KEY = "chunk-error-reload-count"
    const RELOAD_WINDOW_MS = 30_000
    const MAX_RELOADS = 3
    try {
      const raw = sessionStorage.getItem(RELOAD_KEY)
      const data: { count: number; since: number } = raw
        ? JSON.parse(raw)
        : { count: 0, since: Date.now() }
      const isExpired = Date.now() - data.since > RELOAD_WINDOW_MS
      const nextCount = isExpired ? 1 : data.count + 1
      if (isExpired || data.count < MAX_RELOADS) {
        sessionStorage.setItem(RELOAD_KEY, JSON.stringify({ count: nextCount, since: isExpired ? Date.now() : data.since }))
        window.location.href =
          window.location.pathname +
          (window.location.search ? window.location.search + "&" : "?") +
          "_r=" + Date.now()
      }
    } catch {
      // sessionStorage 使用不可の場合は何もしない
    }
  }, [error])

  if (isChunkLoadError(error)) {
    return <main className="min-h-screen bg-background" />
  }

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
