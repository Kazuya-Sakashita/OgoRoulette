"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Room } from "./types"

export function useRoomSync(code: string) {
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roomRanking, setRoomRanking] = useState<{ name: string; count: number }[] | undefined>(undefined)

  // ISSUE-146: ポーリング closure 内で最新の room status を参照するための ref
  // useState の room は closure でキャプチャすると stale になるため ref で管理する
  const roomStatusRef = useRef<string | undefined>(undefined)

  const fetchRoom = async () => {
    try {
      const res = await fetch(`/api/rooms/${code}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.expired ? "expired" : (data.error || "ルームが見つかりません"))
        return
      }

      // ISSUE-146: ポーリング interval を adaptive にするため常に最新 status を ref へ記録
      roomStatusRef.current = data.status
      // Skip re-render when key fields are unchanged (avoids unnecessary effects)
      setRoom(prev => {
        if (
          prev &&
          prev.status === data.status &&
          prev._count.members === data._count.members &&
          (prev.sessions?.length ?? 0) === (data.sessions?.length ?? 0)
        ) return prev
        return data
      })
    } catch {
      setError("ルームの取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  // ISSUE-047: 全スピン履歴からランキングを取得
  const fetchRanking = async () => {
    try {
      const res = await fetch(`/api/rooms/${code}/ranking`)
      if (!res.ok) return
      const data = await res.json()
      setRoomRanking(data.ranking)
    } catch {
      // ランキング取得失敗は非致命的 — 無視
    }
  }

  // ISSUE-009: Supabase Realtime サブスクリプション（主系）+ ポーリング 10s フォールバック（副系）
  // Realtime が Room テーブルの変更を検知したとき fetchRoom() を呼ぶ。
  // WebSocket が切れた場合や Realtime 未設定の場合はポーリングが 10 秒ごとにデータを再取得する。
  useEffect(() => {
    const supabase = createClient()
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    fetchRoom()
    fetchRanking()

    const channel = supabase
      .channel(`room-play:${code}`)
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
      .subscribe((status) => {
        if (status === "SUBSCRIBED") fetchRoom()
      })

    // ISSUE-146: フォールバックポーリング — Realtime が機能しない場合の安全網
    // IN_SESSION 中は 2 秒間隔に短縮してスピン通知をアニメーション窓内に届ける
    const poll = async () => {
      await fetchRoom()
      if (!cancelled) {
        const interval = roomStatusRef.current === "IN_SESSION" ? 2000 : 10000
        timeoutId = setTimeout(poll, interval)
      }
    }
    timeoutId = setTimeout(poll, 2000)

    return () => {
      cancelled = true
      if (timeoutId !== null) clearTimeout(timeoutId)
      supabase.removeChannel(channel)
    }
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  return { room, setRoom, loading, error, fetchRoom, fetchRanking, roomRanking, roomStatusRef }
}
