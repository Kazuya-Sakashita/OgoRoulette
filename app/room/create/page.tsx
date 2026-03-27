"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Users, Loader2 } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

export default function CreateRoomPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [guestNickname, setGuestNickname] = useState("")
  const [roomName, setRoomName] = useState("")
  const [maxMembers, setMaxMembers] = useState(8)
  const [isPersistent, setIsPersistent] = useState(false)  // ISSUE-014: 常設グループ
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user))
  }, [])

  const handleCreate = async () => {
    if (!currentUser && !guestNickname.trim()) {
      setError("ニックネームを入力してください")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName || undefined,
          maxMembers,
          guestNickname: currentUser ? undefined : guestNickname.trim(),
          isPersistent: currentUser ? isPersistent : false,
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "ルームの作成に失敗しました")
        setLoading(false)
        return
      }

      // Guest: save invite code + HMAC-signed host token to localStorage so play page can identify as host
      if (!currentUser) {
        const stored: string[] = JSON.parse(
          localStorage.getItem("ogoroulette_host_rooms") || "[]"
        )
        stored.push(data.inviteCode)
        localStorage.setItem("ogoroulette_host_rooms", JSON.stringify(stored))

        // hostToken は HMAC-SHA256 署名済みトークン（生の memberId ではない）
        if (data.hostToken) {
          localStorage.setItem(`ogoroulette_host_token_${data.inviteCode}`, data.hostToken)
        }
      }

      // Redirect to room lobby — URL now carries the room state (reload-safe)
      router.replace(`/room/${data.inviteCode}`)
    } catch {
      setError("ルームの作成に失敗しました")
    } finally {
      setLoading(false)
    }
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
            <h1 className="text-lg font-bold text-foreground">ルームを作成</h1>
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

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <div className="glass-card rounded-3xl p-6 border border-white/10">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-accent flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-primary-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">
                新しいルームを作成
              </h2>
              <p className="text-sm text-muted-foreground">
                QRコードを生成してメンバーを招待
              </p>
            </div>

            {/* Guest nickname (shown only when not logged in) */}
            {!currentUser && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  あなたの名前 <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={guestNickname}
                  onChange={(e) => setGuestNickname(e.target.value)}
                  placeholder="例: 田中"
                  maxLength={20}
                  className="w-full h-12 px-4 rounded-xl bg-secondary border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  ルーレットに表示される名前です
                </p>
              </div>
            )}

            {/* Room Name Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                ルーム名（任意）
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="例: 今日の飲み会"
                maxLength={30}
                className="w-full h-12 px-4 rounded-xl bg-secondary border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Max Members */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                最大人数
              </label>
              <div className="flex gap-2">
                {[4, 6, 8, 10].map((num) => (
                  <button
                    key={num}
                    onClick={() => setMaxMembers(num)}
                    className={`flex-1 h-12 rounded-xl font-medium transition-all ${
                      maxMembers === num
                        ? 'bg-gradient-accent text-primary-foreground'
                        : 'bg-secondary text-muted-foreground hover:text-foreground border border-white/10'
                    }`}
                  >
                    {num}人
                  </button>
                ))}
              </div>
            </div>

            {/* ISSUE-014: 常設グループトグル（ログイン済みのみ表示） */}
            {currentUser && (
              <div className="mb-6">
                <button
                  onClick={() => setIsPersistent(v => !v)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    isPersistent
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "bg-secondary border-white/10 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="text-left">
                    <p className="text-sm font-medium">常設グループとして保存</p>
                    <p className="text-xs opacity-60 mt-0.5">
                      {isPersistent ? "有効期限なし・繰り返し使える" : "通常ルーム（24時間有効）"}
                    </p>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${isPersistent ? "bg-primary" : "bg-white/20"}`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isPersistent ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                </button>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 mb-4">
                <p className="text-sm text-destructive text-center">{error}</p>
              </div>
            )}

            {/* Create Button */}
            <Button
              onClick={handleCreate}
              disabled={loading || (!currentUser && !guestNickname.trim())}
              className="w-full h-14 text-lg font-bold rounded-2xl bg-gradient-accent hover:opacity-90 text-primary-foreground press-effect disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> 作成中...</>
              ) : (
                "QRコードを作成"
              )}
            </Button>
          </div>

          {/* Info Section */}
          <div className="mt-6 p-4 rounded-2xl bg-secondary/50 border border-white/5">
            <h3 className="text-sm font-semibold text-foreground mb-2">使い方</h3>
            <ol className="space-y-2 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                <span>ルームを作成してQRコードを表示</span>
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                <span>メンバーにQRコードをスキャンしてもらう</span>
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                <span>全員が参加したらルーレットをスタート</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </main>
  )
}
