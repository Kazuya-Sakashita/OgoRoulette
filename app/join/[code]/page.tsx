"use client"

import { useEffect, useState, use } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Users, Loader2, Plus } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"

interface Member {
  id: string
  nickname: string | null
  isHost: boolean
}

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
  members: Member[]
  presetMemberNames: string[]
}

export default function JoinRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [joiningName, setJoiningName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guestName, setGuestName] = useState("")
  // "preset" = name picker mode, "input" = free-text input mode, "confirm" = generic join
  const [mode, setMode] = useState<"preset" | "input" | "confirm">("confirm")

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
      // If room has preset names, switch to picker mode
      if (Array.isArray(data.presetMemberNames) && data.presetMemberNames.length > 0) {
        setMode("preset")
      }
    } catch {
      setError("ルームの取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  const joinWithName = async (name?: string) => {
    const nameToUse = name ?? (guestName.trim() || undefined)
    setJoining(true)
    if (name) setJoiningName(name)
    setError(null)

    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode: code,
          guestName: nameToUse,
        }),
      })

      const data = await res.json()

      if (data.requiresName) {
        setMode("input")
        setJoining(false)
        setJoiningName(null)
        return
      }

      if (!res.ok) {
        setError(data.error || "参加に失敗しました")
        setJoining(false)
        setJoiningName(null)
        return
      }

      router.push(`/room/${code}`)
    } catch {
      setError("参加に失敗しました")
      setJoining(false)
      setJoiningName(null)
    }
  }

  // Names already joined (non-host members' nicknames)
  const claimedNames = room?.members
    .filter((m) => !m.isHost)
    .map((m) => m.nickname)
    .filter(Boolean) as string[] ?? []

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
          <div className="w-full glass-card rounded-3xl p-6 border border-white/10 mb-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-accent flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold text-foreground mb-1">
                {room?.name || "ルーレットルーム"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {room?.owner?.name ?? room?.members.find(m => m.isHost)?.nickname ?? "ゲスト"}さんがあなたを招待しています
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

            {/* Preset name picker */}
            {mode === "preset" && room && room.presetMemberNames.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-muted-foreground mb-3 text-center">
                  あなたはどちらですか？
                </p>
                <div className="flex flex-col gap-2">
                  {room.presetMemberNames.map((name) => {
                    const claimed = claimedNames.includes(name)
                    return (
                      <button
                        key={name}
                        onClick={() => !claimed && joinWithName(name)}
                        disabled={claimed || joining}
                        className={`w-full py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                          claimed
                            ? "bg-white/5 text-muted-foreground opacity-50 cursor-not-allowed"
                            : joiningName === name
                            ? "bg-primary/30 text-primary border border-primary/50"
                            : "bg-primary/15 hover:bg-primary/25 text-primary border border-primary/20 active:scale-98"
                        }`}
                      >
                        {claimed ? (
                          <span>{name} — 参加済み</span>
                        ) : joiningName === name ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            参加中...
                          </span>
                        ) : (
                          name
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Option to join as someone not in the list */}
                <button
                  onClick={() => setMode("input")}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  リストにない名前で参加
                </button>
              </div>
            )}

            {/* Free-text name input */}
            {mode === "input" && (
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
                {room?.presetMemberNames && room.presetMemberNames.length > 0 && (
                  <button
                    onClick={() => setMode("preset")}
                    className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← 名前一覧に戻る
                  </button>
                )}
              </div>
            )}

            {/* Generic confirm button (for non-preset rooms or after name input) */}
            {mode === "confirm" && (
              <div className="mb-4" />
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 mb-4">
                <p className="text-sm text-destructive text-center">{error}</p>
              </div>
            )}

            {/* Join Button — only for confirm/input mode */}
            {(mode === "confirm" || mode === "input") && (
              <Button
                onClick={() => joinWithName()}
                disabled={joining || (mode === "input" && !guestName.trim())}
                className="w-full h-14 text-lg font-bold rounded-2xl bg-gradient-accent hover:opacity-90 text-primary-foreground press-effect disabled:opacity-50"
              >
                {joining ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> 参加中...</>
                ) : (
                  "ルームに参加する"
                )}
              </Button>
            )}
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
