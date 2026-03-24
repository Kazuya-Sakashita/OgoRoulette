"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Users, Loader2, Copy, Check, Share2, Crown, RefreshCw, Play } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import QRCode from "react-qr-code"

interface Member {
  id: string
  nickname: string | null
  color: string
  isHost: boolean
  profile: {
    id: string
    name: string | null
    avatarUrl: string | null
  } | null
}

interface Room {
  id: string
  name: string | null
  inviteCode: string
  status: string
  maxMembers: number
  members: Member[]
  _count: {
    members: number
  }
}

export default function CreateRoomPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [guestNickname, setGuestNickname] = useState("")
  const [roomName, setRoomName] = useState("")
  const [maxMembers, setMaxMembers] = useState(8)
  const [isPersistent, setIsPersistent] = useState(false)  // ISSUE-014: 常設グループ
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Room state (after creation)
  const [room, setRoom] = useState<Room | null>(null)
  const [copied, setCopied] = useState(false)
  const [showQRFull, setShowQRFull] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user))
  }, [])

  // Poll for member updates when room is created
  useEffect(() => {
    if (!room) return
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${room.inviteCode}`)
        if (res.ok) {
          const data = await res.json()
          setRoom(data)
        }
      } catch {
        // Ignore errors during polling
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [room?.inviteCode])

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

  const copyInviteLink = async () => {
    if (!room) return
    const url = `${window.location.origin}/join/${room.inviteCode}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareRoom = async () => {
    if (!room) return
    const url = `${window.location.origin}/join/${room.inviteCode}`
    const text = `OgoRouletteでルーレットしよう！\n${room.name || "ルーレットルーム"}に参加: `
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'OgoRoulette',
          text: text,
          url: url
        })
      } catch {
        // User cancelled
      }
    } else {
      copyInviteLink()
    }
  }

  const shareUrl = room ? `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${room.inviteCode}` : ''

  // Full Screen QR Code Display (shows immediately after room creation)
  if (showQRFull && room) {
    return (
      <main className="min-h-screen bg-white">
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-4">
            <Image 
              src="/images/logo-icon.png" 
              alt="OgoRoulette" 
              width={40} 
              height={40}
            />
            <span className="text-2xl font-bold text-gray-900">
              Ogo<span className="text-[#F59E0B]">Roulette</span>
            </span>
          </div>

          {/* Room Name */}
          <p className="text-gray-600 mb-6">{room.name || "ルーレットルーム"}</p>

          {/* QR Code - Large */}
          <div className="bg-white p-4 rounded-3xl shadow-2xl border border-gray-100 mb-6">
            {shareUrl && (
              <QRCode value={shareUrl} size={288} bgColor="#FFFFFF" fgColor="#0B1B2B" className="sm:w-80 sm:h-80" />
            )}
          </div>

          {/* Invite Code */}
          <div className="text-center mb-6">
            <p className="text-sm text-gray-500 mb-1">招待コード</p>
            <p className="text-4xl font-mono font-bold text-gray-900 tracking-[0.25em]">
              {room.inviteCode}
            </p>
          </div>

          {/* Member Count */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 mb-6">
            <Users className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              参加者: {room._count?.members || 0}/{room.maxMembers}人
            </span>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button 
              onClick={() => setShowQRFull(false)}
              variant="outline"
              className="h-12 rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              参加者リストを見る
            </Button>
            
            {(room._count?.members || 0) >= 2 && (
              <Button 
                onClick={() => router.push(`/room/${room.inviteCode}/play`)}
                className="h-14 rounded-2xl bg-gradient-to-r from-[#F59E0B] to-[#EC4899] text-white font-bold text-lg"
              >
                <Play className="w-5 h-5 mr-2" />
                ルーレットを回す
              </Button>
            )}
          </div>

          {/* Instructions */}
          <p className="mt-8 text-sm text-gray-400 text-center">
            メンバーはこのQRコードをスキャンして参加できます
          </p>
        </div>
      </main>
    )
  }

  // Room Created - Show management view
  if (room) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-[390px] min-h-screen flex flex-col px-5 py-6">
          {/* Header */}
          <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Link href="/">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-bold text-foreground">{room.name || "ルーレットルーム"}</h1>
                <p className="text-xs text-muted-foreground">招待コード: {room.inviteCode}</p>
              </div>
            </div>
            <Image 
              src="/images/logo-icon.png" 
              alt="OgoRoulette" 
              width={28} 
              height={28}
            />
          </header>

          {/* QR Code Section */}
          <section className="mb-6">
            <div className="glass-card rounded-3xl p-6 border border-white/10 text-center">
              <h2 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
                QRコードを表示してメンバーを招待
              </h2>
              
              {/* QR Code */}
              <button
                onClick={() => setShowQRFull(true)}
                className="mx-auto block bg-white rounded-2xl p-3 shadow-lg hover:shadow-xl transition-all hover:scale-105 mb-4"
              >
                {shareUrl && (
                  <QRCode value={shareUrl} size={160} bgColor="#FFFFFF" fgColor="#0B1B2B" />
                )}
              </button>
              
              <p className="text-xs text-muted-foreground mb-4">
                タップして全画面表示
              </p>

              {/* Invite Code */}
              <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-secondary mb-4">
                <code className="text-xl font-mono font-bold text-primary tracking-[0.15em]">
                  {room.inviteCode}
                </code>
                <Button size="sm" variant="ghost" onClick={copyInviteLink} className="shrink-0">
                  {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>

              {/* Share Buttons */}
              <div className="flex gap-2">
                <Button 
                  onClick={shareRoom}
                  variant="outline"
                  className="flex-1 h-10 rounded-xl border-white/10 bg-secondary hover:bg-white/10 text-foreground text-sm"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  共有
                </Button>
                <Button 
                  onClick={() => setShowQRFull(true)}
                  className="flex-1 h-10 rounded-xl bg-gradient-accent text-primary-foreground text-sm"
                >
                  QRを大きく表示
                </Button>
              </div>
            </div>
          </section>

          {/* Members Section */}
          <section className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">参加者</h2>
              </div>
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {room._count?.members || 0}/{room.maxMembers}人
              </span>
            </div>

            {(room.members?.length || 0) === 0 ? (
              <div className="p-6 rounded-2xl glass-card border border-white/10 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm text-foreground font-medium mb-1">
                  メンバーの参加を待っています
                </p>
                <p className="text-xs text-muted-foreground">
                  QRコードをスキャンして参加できます
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {room.members?.map((member) => (
                  <div 
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-xl glass-card border border-white/10"
                  >
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                      style={{ backgroundColor: member.color }}
                    >
                      {(member.nickname || member.profile?.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {member.nickname || member.profile?.name || "ゲスト"}
                        </span>
                        {member.isHost && (
                          <Crown className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      {member.isHost && (
                        <span className="text-xs text-primary">ホスト</span>
                      )}
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Start Roulette Button */}
          <section className="mt-6 space-y-3">
            <Button 
              onClick={() => router.push(`/room/${room.inviteCode}/play`)}
              className="w-full h-14 text-lg font-bold rounded-2xl bg-gradient-accent hover:opacity-90 text-primary-foreground press-effect"
              disabled={(room._count?.members || 0) < 2}
            >
              {(room._count?.members || 0) < 2 ? (
                `あと${2 - (room._count?.members || 0)}人の参加が必要`
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  ルーレットを回す
                </>
              )}
            </Button>
          </section>
        </div>
      </main>
    )
  }

  // Initial Create Form
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
