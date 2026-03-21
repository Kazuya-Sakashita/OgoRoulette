"use client"

import { useEffect, useState, use } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Users, Loader2 } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"

interface Room {
  id: string
  name: string | null
  inviteCode: string
  owner: {
    name: string | null
    avatarUrl: string | null
  } | null
  _count: {
    members: number
  }
  maxMembers: number
}

export default function JoinRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guestName, setGuestName] = useState("")
  const [requiresName, setRequiresName] = useState(false)

  useEffect(() => {
    fetchRoom()
  }, [code])

  const fetchRoom = async () => {
    try {
      const res = await fetch(`/api/rooms/${code}`)
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || "ルームが見つかりません")
        return
      }
      
      setRoom(data)
    } catch {
      setError("ルームの取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    setJoining(true)
    setError(null)

    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          inviteCode: code,
          guestName: requiresName ? guestName : undefined
        })
      })
      
      const data = await res.json()

      if (data.requiresName) {
        setRequiresName(true)
        setJoining(false)
        return
      }

      if (!res.ok) {
        setError(data.error || "参加に失敗しました")
        setJoining(false)
        return
      }

      // Success - redirect to room
      router.push(`/room/${code}`)
    } catch {
      setError("参加に失敗しました")
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </main>
    )
  }

  if (error && !room) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-[390px] min-h-screen flex flex-col px-5 py-6">
          <header className="flex items-center gap-4 mb-8">
            <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
              <Link href="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
          </header>
          
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">ルームが見つかりません</h1>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <Button asChild className="bg-gradient-accent text-primary-foreground">
              <Link href="/">ホームに戻る</Link>
            </Button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[390px] min-h-screen flex flex-col px-5 py-6">
        {/* Header */}
        <header className="flex items-center gap-4 mb-8">
          <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Link href="/">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Image 
              src="/images/logo-icon.png" 
              alt="OgoRoulette" 
              width={28} 
              height={28}
              className="w-7 h-7"
            />
            <span className="text-sm font-bold tracking-tight">
              <span className="text-foreground">Ogo</span>
              <span className="text-gradient">Roulette</span>
            </span>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Room Card */}
          <div className="w-full glass-card rounded-3xl p-6 border border-white/10 mb-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-accent flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold text-foreground mb-1">
                {room?.name || "ルーレットルーム"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {room?.owner?.name ?? "ゲスト"}さんがあなたを招待しています
              </p>
            </div>

            {/* Room Info */}
            <div className="flex items-center justify-center gap-4 p-4 rounded-xl bg-secondary/50 mb-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{room?._count.members || 0}</p>
                <p className="text-xs text-muted-foreground">参加中</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{room?.maxMembers || 10}</p>
                <p className="text-xs text-muted-foreground">定員</p>
              </div>
            </div>

            {/* Guest Name Input */}
            {requiresName && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  ニックネーム
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="表示名を入力"
                  maxLength={20}
                  className="w-full h-12 px-4 rounded-xl bg-secondary border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 mb-4">
                <p className="text-sm text-destructive text-center">{error}</p>
              </div>
            )}

            {/* Join Button */}
            <Button
              onClick={handleJoin}
              disabled={joining || (requiresName && !guestName.trim())}
              className="w-full h-14 text-lg font-bold rounded-2xl bg-gradient-accent hover:opacity-90 text-primary-foreground press-effect disabled:opacity-50"
            >
              {joining ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> 参加中...</>
              ) : (
                "ルームに参加する"
              )}
            </Button>
          </div>

          {/* Footer Note */}
          <p className="text-xs text-muted-foreground text-center max-w-[280px]">
            参加することで<Link href="/terms" className="text-primary hover:underline">利用規約</Link>と
            <Link href="/privacy" className="text-primary hover:underline">プライバシーポリシー</Link>に同意したものとみなされます
          </p>
        </div>
      </div>
    </main>
  )
}
