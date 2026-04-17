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

  // ISSUE-221: Broadcast 送信用チャンネル ref（オーナーが spin_start を送信する）
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null)

  // ISSUE-286: 並行 fetchRoom 呼び出しを防ぐゲートフラグ
  const isFetchingRef = useRef(false)

  const fetchRoom = async () => {
    // ISSUE-286: 既にフェッチ中なら新規リクエストをスキップ（Realtime + polling の二重発火対策）
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    // ISSUE-288: ネットワーク障害でフェッチがハングしても 10 秒でタイムアウトさせる
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)

    try {
      const res = await fetch(`/api/rooms/${code}`, { signal: controller.signal })
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
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        // ISSUE-288: タイムアウト時はユーザーにリロードを促すエラーを表示
        setError("接続がタイムアウトしました。ページをリロードしてください。")
      } else {
        setError("ルームの取得に失敗しました")
      }
    } finally {
      clearTimeout(timeoutId)
      isFetchingRef.current = false
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
    } catch (e) {
      // ISSUE-287: ランキング取得失敗は非致命的だがログを残して観測可能にする
      console.error("[OgoRoulette] fetchRanking failed", e)
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
          table: "rooms",
          filter: `invite_code=eq.${code.toUpperCase()}`,
        },
        () => { fetchRoom() }
      )
      // ISSUE-221: Broadcast 優先パス — postgres_changes より ~600ms 速く spin_start を検知
      // オーナーが API 成功後に送信する spin_start を受け取り即 fetchRoom() する
      .on("broadcast", { event: "spin_start" }, () => { fetchRoom() })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") fetchRoom()
        // ISSUE-275: CHANNEL_ERROR は anon ユーザーの RLS ブロック等で発生しうる。
        // polling fallback（2s/10s）がカバーするため致命的ではないが、
        // fetchRoom() を即時呼んで最新状態を確保する。
        if (status === "CHANNEL_ERROR") fetchRoom()
      })
    channelRef.current = channel

    // ISSUE-221: スマホタブがバックグラウンドから復帰したとき即再取得
    // iOS/Android は非アクティブタブの setTimeout を throttle するため
    // visibilitychange で補完することで演出を取りこぼさない
    const handleVisibilityChange = () => {
      if (!document.hidden) fetchRoom()
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

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
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  return { room, setRoom, loading, error, fetchRoom, fetchRanking, roomRanking, roomStatusRef, channelRef }
}
