"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Camera, Keyboard } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { QrScanner } from "@/components/qr-scanner"

const HINT_DELAY_MS = 5000

export default function ScanPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"scan" | "manual">("manual")
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [showManualHint, setShowManualHint] = useState(false)
  // ISSUE-081: IME composition 中の state 更新を防ぐ
  const isComposing = useRef(false)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 5秒間スキャン未検出で手動入力を促すヒントを表示
  useEffect(() => {
    if (mode === "scan") {
      setShowManualHint(false)
      hintTimerRef.current = setTimeout(() => {
        setShowManualHint(true)
      }, HINT_DELAY_MS)
    } else {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
      setShowManualHint(false)
    }
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    }
  }, [mode])

  const handleManualJoin = () => {
    const code = inviteCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
    if (code.length < 6) {
      setError("招待コードを入力してください")
      return
    }
    router.push(`/join/${code}`)
  }

  const handleQrScan = (data: string) => {
    // QRコードのデータから招待コードを抽出する
    // 形式1: /join/XXXXXX の URL
    // 形式2: 6桁の英数字コードのみ
    const urlMatch = data.match(/\/join\/([A-Z0-9]{6})/i)
    if (urlMatch) {
      router.push(`/join/${urlMatch[1].toUpperCase()}`)
      return
    }
    const codeMatch = data.match(/^([A-Z0-9]{6})$/i)
    if (codeMatch) {
      router.push(`/join/${codeMatch[1].toUpperCase()}`)
      return
    }
    // 無効なQRコードはヒントを早める
    setShowManualHint(true)
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[390px] md:max-w-lg min-h-screen flex flex-col px-5 py-6 md:justify-center">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Link href="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <h1 className="text-lg font-bold text-foreground">QRで参加</h1>
          </div>
          <div className="flex items-center gap-2">
            <Image
              src="/images/logo-icon.png"
              alt="OgoRoulette"
              width={28}
              height={28}
              className="w-7 h-7"
            />
          </div>
        </header>

        {/* Mode Toggle */}
        <div className="flex gap-2 p-1 rounded-xl bg-secondary mb-6">
          <button
            onClick={() => setMode("scan")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${
              mode === "scan"
                ? "bg-gradient-accent text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Camera className="w-4 h-4" />
            QRスキャン
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${
              mode === "manual"
                ? "bg-gradient-accent text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Keyboard className="w-4 h-4" />
            コード入力
          </button>
        </div>

        {/* Content based on mode */}
        <div className="flex-1 flex flex-col md:justify-center">
          {mode === "scan" ? (
            <div className="flex-1 flex flex-col">
              {/* QR Scanner */}
              <QrScanner
                active={mode === "scan"}
                onScan={handleQrScan}
              />

              <p className="text-sm text-muted-foreground text-center mt-4">
                QRコードをカメラに向けてください
              </p>

              {/* 5秒後に手動入力を促すバナー */}
              {showManualHint && (
                <div className="mt-4 p-4 rounded-2xl bg-secondary border border-white/10 text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    うまく読み取れませんか？
                  </p>
                  <button
                    onClick={() => setMode("manual")}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    コードを手動で入力する →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Manual Code Entry */}
              <div className="flex-1 flex flex-col md:justify-center">
                <div className="glass-card rounded-3xl p-6 border border-white/10">
                  <div className="text-center mb-6">
                    <div className="w-14 h-14 mx-auto rounded-xl bg-gradient-accent flex items-center justify-center mb-4">
                      <Keyboard className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <h2 className="text-lg font-bold text-foreground mb-1">招待コードを入力</h2>
                    <p className="text-sm text-muted-foreground">
                      ホストから共有された6桁のコードを入力してください
                    </p>
                  </div>

                  {/* Code Input */}
                  <div className="mb-4">
                    <input
                      type="text"
                      value={inviteCode}
                      onCompositionStart={() => {
                        isComposing.current = true
                      }}
                      onCompositionEnd={(e) => {
                        isComposing.current = false
                        const val = e.currentTarget.value
                          .replace(/[^a-zA-Z0-9]/g, "")
                          .toUpperCase()
                          .slice(0, 6)
                        setInviteCode(val)
                        setError(null)
                      }}
                      onChange={(e) => {
                        if (isComposing.current) {
                          // ISSUE-082: composition 中は raw 値で state を更新し React と DOM を同期させる
                          // return のみだと React が input.value を旧 state に強制リセットし IME バッファが破壊される
                          setInviteCode(e.target.value.slice(0, 10))
                          return
                        }
                        setInviteCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6))
                        setError(null)
                      }}
                      placeholder="XXXXXX"
                      maxLength={6}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      autoComplete="off"
                      spellCheck={false}
                      enterKeyHint="go"
                      className="w-full h-16 px-6 text-center text-2xl font-mono font-bold tracking-[0.3em] text-foreground bg-secondary rounded-xl border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/30"
                    />
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 mb-4">
                      <p className="text-sm text-destructive text-center">{error}</p>
                    </div>
                  )}

                  {/* Join Button */}
                  <Button
                    onClick={handleManualJoin}
                    disabled={inviteCode.replace(/[^a-zA-Z0-9]/g, "").length < 6}
                    className="w-full h-14 text-lg font-bold rounded-xl bg-gradient-accent hover:opacity-90 text-primary-foreground press-effect disabled:opacity-50"
                  >
                    参加する
                  </Button>
                </div>

                {/* Help Text */}
                <div className="mt-6 text-center">
                  <p className="text-xs text-muted-foreground mb-2">
                    招待コードが分からない場合は
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ホストに<span className="text-primary">QRコード</span>または<span className="text-primary">招待リンク</span>を送ってもらいましょう
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-6 pt-4 border-t border-white/5">
          <p className="text-xs text-muted-foreground text-center">
            新しいルームを作成したい場合は<Link href="/" className="text-primary hover:underline">ホームへ</Link>戻ってください
          </p>
        </footer>
      </div>
    </main>
  )
}
