"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Camera, Keyboard } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"

export default function ScanPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"scan" | "manual">("manual") // Default to manual since camera requires permissions
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleManualJoin = () => {
    if (!inviteCode.trim()) {
      setError("招待コードを入力してください")
      return
    }
    
    // Navigate to join page with the code
    router.push(`/join/${inviteCode.toUpperCase()}`)
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[390px] min-h-screen flex flex-col px-5 py-6">
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
        <div className="flex-1 flex flex-col">
          {mode === "scan" ? (
            <>
              {/* QR Scanner Placeholder */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-64 h-64 rounded-3xl bg-secondary border-2 border-dashed border-white/20 flex flex-col items-center justify-center mb-6">
                  <Camera className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground text-center px-4">
                    カメラへのアクセスを許可して<br />QRコードをスキャン
                  </p>
                </div>

                <Button 
                  onClick={() => {
                    // In production, this would request camera permissions and start scanning
                    alert("カメラ機能は実装中です。コード入力をお使いください。")
                  }}
                  className="bg-gradient-accent text-primary-foreground rounded-xl press-effect"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  カメラを起動
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Manual Code Entry */}
              <div className="flex-1 flex flex-col">
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
                      onChange={(e) => {
                        setInviteCode(e.target.value.toUpperCase().slice(0, 6))
                        setError(null)
                      }}
                      placeholder="XXXXXX"
                      maxLength={6}
                      className="w-full h-16 px-6 text-center text-2xl font-mono font-bold tracking-[0.3em] text-foreground bg-secondary rounded-xl border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/30 uppercase"
                      autoFocus
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
                    disabled={inviteCode.length < 6}
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
            新しいルームを作成したい場合は<Link href="/auth/login" className="text-primary hover:underline">ログイン</Link>してください
          </p>
        </footer>
      </div>
    </main>
  )
}
