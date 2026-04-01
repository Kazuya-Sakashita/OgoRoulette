"use client"

import { useEffect, useRef, useState, use } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Copy, Check, Users, Crown, QrCode, Share2, RefreshCw } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import QRCode from "react-qr-code"
import { createClient } from "@/lib/supabase/client"
import { getDisplayName } from "@/lib/display-name"

interface Member {
  id: string
  nickname: string | null
  color: string
  isHost: boolean
  profile: {
    id: string
    name: string | null
    displayName: string | null
    avatarUrl: string | null
  } | null
}

interface Room {
  id: string
  name: string | null
  inviteCode: string
  status: string
  maxMembers: number
  expiresAt?: string | null
  members: Member[]
  owner: {
    id: string
    name: string | null
    avatarUrl: string | null
  }
  _count: {
    members: number
  }
}

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showQRFull, setShowQRFull] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  // ISSUE-100: join toast
  const [joinToast, setJoinToast] = useState<string | null>(null)
  const prevMemberIdsRef = useRef<Set<string>>(new Set())
  // ISSUE-124: 新規参加メンバーの行ハイライト用
  const [newMemberIds, setNewMemberIds] = useState<Set<string>>(new Set())
  // Stops polling once room is COMPLETED (ref avoids stale closure in setInterval)
  const isCompletedRef = useRef(false)

  const fetchRoom = async () => {
    try {
      const res = await fetch(`/api/rooms/${code}`)
      const data = await res.json()

      if (!res.ok) {
        isCompletedRef.current = true // stop polling on error
        setError(data.expired ? "expired" : (data.error || "ルームが見つかりません"))
        return
      }

      // IN_SESSION or COMPLETED → redirect to play page
      if (data.status === "IN_SESSION" || data.status === "COMPLETED") {
        isCompletedRef.current = true
        router.push(`/room/${code}/play`)
        return
      }

      isCompletedRef.current = false
      // ISSUE-100: Detect newly joined members and show a toast
      const newMembers = (data.members as Member[]).filter(
        (m) => !prevMemberIdsRef.current.has(m.id)
      )
      if (newMembers.length > 0 && prevMemberIdsRef.current.size > 0) {
        const name = newMembers[0].nickname ||
          (newMembers[0].profile ? getDisplayName(newMembers[0].profile) : "ゲスト")
        setJoinToast(`${name}さんが参加しました 🎉`)
        setTimeout(() => setJoinToast(null), 3000)
        // ISSUE-124: 新規参加メンバーの行をハイライト
        setNewMemberIds(new Set(newMembers.map(m => m.id)))
        setTimeout(() => setNewMemberIds(new Set()), 3000)
      }
      prevMemberIdsRef.current = new Set((data.members as Member[]).map((m: Member) => m.id))

      // Skip re-render when key fields are unchanged (prevents QR image from re-fetching)
      setRoom(prev => {
        if (prev && prev.status === data.status && prev._count.members === data._count.members) return prev
        return data
      })
    } catch {
      setError("ルームの取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  // ISSUE-100: Supabase Realtime + polling fallback (same pattern as play/page.tsx)
  // Realtime fires instantly when members join; polling is the safety net.
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    fetchRoom()

    // Realtime: Room テーブルの変更を購読（メンバー参加も Room._count に反映される）
    const supabase = createClient()
    const channel = supabase
      .channel(`room-lobby:${code}`)
      .on(
        "postgres_changes" as Parameters<ReturnType<typeof supabase.channel>["on"]>[0],
        {
          event: "*",
          schema: "public",
          table: "Room",
          filter: `invite_code=eq.${code.toUpperCase()}`,
        },
        () => { fetchRoom() }
      )
      .subscribe()

    // Fallback polling: 5 秒ごと（Realtime が機能していない場合の安全網）
    const poll = async () => {
      await fetchRoom()
      if (!cancelled && !isCompletedRef.current) timeoutId = setTimeout(poll, 5000)
    }
    timeoutId = setTimeout(poll, 5000)

    return () => {
      cancelled = true
      if (timeoutId !== null) clearTimeout(timeoutId)
      supabase.removeChannel(channel)
    }
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  // ISSUE-036: オーナー判定 — 認証ユーザー or ゲストホスト（localStorage）
  useEffect(() => {
    if (!room) return
    const checkOwner = async () => {
      // ゲストホスト: localStorage の招待コードリストで確認
      try {
        const hostedRooms: string[] = JSON.parse(
          localStorage.getItem("ogoroulette_host_rooms") || "[]"
        )
        if (hostedRooms.includes(room.inviteCode)) {
          setIsOwner(true)
          return
        }
      } catch {
        // localStorage parse error — ignore
      }
      // 認証ユーザー: Supabase から取得して host メンバーと照合
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const isHost = room.members.some(m => m.isHost && m.profile?.id === user.id)
      setIsOwner(isHost)
    }
    checkOwner()
  }, [room])

  const copyInviteLink = async () => {
    const url = `${window.location.origin}/join/${room?.inviteCode}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard write failed (e.g., permissions denied)
    }
  }

  const shareRoom = async () => {
    const url = `${window.location.origin}/join/${room?.inviteCode}`
    const text = `OgoRouletteでルーレットしよう！\n${room?.name || "ルーレットルーム"}に参加: `
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'OgoRoulette',
          text: text,
          url: url
        })
      } catch {
        // User cancelled or share failed
      }
    } else {
      copyInviteLink()
    }
  }

  const shareUrl = room ? `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${room.inviteCode}` : ''

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </main>
    )
  }

  if (error || !room) {
    const isExpiredError = error === "expired"
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-[390px] md:max-w-lg min-h-screen flex flex-col px-5 py-6">
          <header className="flex items-center gap-4 mb-8">
            <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
              <Link href="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
          </header>

          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
              <QrCode className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">
              {isExpiredError ? "ルームの有効期限が切れています" : "ルームが見つかりません"}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {isExpiredError ? "このルームは使用できなくなりました" : error}
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              {isExpiredError && (
                <Button asChild className="bg-gradient-accent text-primary-foreground">
                  <Link href="/room/create">新しいルームを作る</Link>
                </Button>
              )}
              <Button asChild variant={isExpiredError ? "outline" : "default"} className={isExpiredError ? "border-white/10 bg-secondary text-foreground" : "bg-gradient-accent text-primary-foreground"}>
                <Link href="/home">ホームに戻る</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      {/* ISSUE-100: Join toast — shown when a new member arrives */}
      {joinToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-accent text-accent-foreground text-sm font-semibold shadow-xl animate-in fade-in slide-in-from-top-2 duration-300">
          {joinToast}
        </div>
      )}

      {/* Full Screen QR Modal */}
      {showQRFull && (
        <div 
          className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-8"
          onClick={() => setShowQRFull(false)}
        >
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Image 
                src="/images/logo-icon.png" 
                alt="OgoRoulette" 
                width={32} 
                height={32}
              />
              <span className="text-xl font-bold text-gray-900">
                Ogo<span className="text-[#F59E0B]">Roulette</span>
              </span>
            </div>
            <p className="text-gray-600 text-sm">スキャンしてルームに参加</p>
          </div>

          <div className="bg-white p-4 rounded-3xl shadow-xl">
            {shareUrl && (
              <QRCode value={shareUrl} size={256} bgColor="#FFFFFF" fgColor="#0B1B2B" />
            )}
          </div>

          <div className="mt-6 text-center">
            <p className="text-2xl font-mono font-bold text-gray-900 tracking-[0.2em]">
              {room.inviteCode}
            </p>
            <p className="text-gray-500 text-sm mt-1">{room.name || "ルーレットルーム"}</p>
          </div>

          <Button 
            onClick={() => setShowQRFull(false)}
            className="mt-8 bg-[#0B1B2B] text-white hover:bg-[#0B1B2B]/90"
          >
            閉じる
          </Button>
        </div>
      )}

      <div className="mx-auto max-w-[390px] md:max-w-lg min-h-screen flex flex-col px-5 py-6">
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
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={fetchRoom}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        </header>

        {/* ISSUE-010: 有効期限バナー */}
        {room.expiresAt && (() => {
          const expiresMs = new Date(room.expiresAt!).getTime()
          const isExpired = expiresMs < Date.now()
          const isExpiringSoon = !isExpired && expiresMs - Date.now() < 24 * 60 * 60 * 1000
          if (isExpired) return (
            <div className="mb-4 px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-between gap-2">
              <p className="text-xs text-red-400 font-medium">このルームは有効期限が切れています</p>
              <Link href="/room/create" className="text-xs text-red-400 underline shrink-0">新しいルームを作る</Link>
            </div>
          )
          if (isExpiringSoon) return (
            <div className="mb-4 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/25">
              <p className="text-xs text-yellow-400">
                有効期限: {new Date(expiresMs).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          )
          return null
        })()}

        {/* QR Code Section - Main Focus for Owner */}
        <section className="mb-6">
          <div className="glass-card rounded-3xl p-6 border border-white/10 text-center">
            <h2 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
              メンバーを招待
            </h2>
            
            {/* QR Code with logo overlay */}
            <button
              onClick={() => setShowQRFull(true)}
              className="mx-auto block bg-white rounded-2xl p-3 shadow-lg hover:shadow-xl transition-shadow mb-4"
            >
              <div className="relative inline-block">
                {shareUrl && (
                  <QRCode value={shareUrl} size={176} bgColor="#FFFFFF" fgColor="#0B1B2B" />
                )}
                {/* Logo overlay — white bg circle keeps QR decodable */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow">
                    <Image src="/images/logo-icon.png" alt="OgoRoulette" width={28} height={28} className="w-7 h-7" />
                  </div>
                </div>
              </div>
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
                onClick={copyInviteLink}
                variant="outline"
                className="flex-1 h-10 rounded-xl border-white/10 bg-secondary hover:bg-white/10 text-foreground text-sm"
              >
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                リンクコピー
              </Button>
            </div>
          </div>
        </section>

        {/* Members Section */}
        <section className="flex-1">
          {room._count.members >= room.maxMembers && (
            <div className="mb-4 px-4 py-3 rounded-2xl bg-primary/10 border border-primary/30 text-center">
              <p className="text-sm font-bold text-primary">✨ 全員揃いました！</p>
              <p className="text-xs text-muted-foreground mt-0.5">ゲームを開始できます</p>
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">参加者</h2>
            </div>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
              {room._count.members}/{room.maxMembers}人
            </span>
          </div>

          {room.members.length === 0 ? (
            <div className="p-6 rounded-2xl glass-card border border-white/10 text-center">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">
                メンバーの参加を待っています...
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                QRコードをスキャンして参加できます
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {room.members.map((member) => (
                <div
                  key={member.id}
                  className={`flex items-center gap-3 p-3 rounded-xl glass-card border transition-all ${
                    newMemberIds.has(member.id)
                      ? "border-primary/60 ring-2 ring-primary/60"
                      : "border-white/10"
                  }`}
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: member.color }}
                  >
                    {member.profile?.avatarUrl ? (
                      <Image
                        src={member.profile.avatarUrl}
                        alt={member.nickname || (member.profile ? getDisplayName(member.profile) : "User")}
                        width={40}
                        height={40}
                        className="rounded-full"
                        unoptimized
                      />
                    ) : (
                      (member.nickname || (member.profile ? getDisplayName(member.profile) : "?")).charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {member.nickname || (member.profile ? getDisplayName(member.profile) : "ゲスト")}
                      </span>
                      {member.isHost && (
                        <Crown className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    {member.isHost && (
                      <span className="text-xs text-primary">ホスト</span>
                    )}
                  </div>
                  <div 
                    className="w-3 h-3 rounded-full animate-pulse"
                    style={{ backgroundColor: '#22C55E' }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* 参加者向け：ホストがゲームを開始するのを待っている旨を表示 */}
          {!isOwner && room.status === "WAITING" && (
            <div className="mt-4 px-4 py-3 rounded-2xl glass-card border border-white/10 text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <p className="text-sm">ホストがゲームを開始するのを待っています</p>
              </div>
            </div>
          )}
        </section>

        {/* Start Roulette Button — オーナーのみ操作可、メンバーは待機メッセージ */}
        <section className="mt-6 space-y-3">
          {isOwner ? (
            <>
              <Button
                onClick={() => router.push(`/room/${code}/play`)}
                className="w-full h-14 text-lg font-bold rounded-2xl bg-gradient-accent hover:opacity-90 text-primary-foreground press-effect"
                disabled={room._count.members < 2}
              >
                {room._count.members < 2 ? "2人以上で開始できます" : "ルーレットを回す"}
              </Button>
              {room._count.members < 2 && (
                <p className="text-xs text-muted-foreground text-center">
                  あと{2 - room._count.members}人の参加が必要です
                </p>
              )}
            </>
          ) : (
            <>
              <Button
                onClick={() => router.push(`/room/${code}/play`)}
                className="w-full h-14 text-lg font-bold rounded-2xl bg-secondary hover:bg-white/10 text-foreground press-effect"
              >
                ルーレットを見る
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                ホストがルーレットを開始すると自動で始まります
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
