"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

// ISSUE-229: 絵文字リアクションのロジックを hook に抽出
// overlays 内部 state だったものを page.tsx で共有できるようにする
// → SpinControls (waiting フェーズ) と WinnerCard (result フェーズ) 両方で handleReact を使用可能

export type FloatingEmoji = { id: string; emoji: string; x: number }

export function useEmojiReactions(roomCode: string) {
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([])
  const reactChannelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`reactions:${roomCode}`)
      .on("broadcast", { event: "emoji_reaction" }, ({ payload }: { payload: { emoji: string } }) => {
        const id = Math.random().toString(36).slice(2)
        setFloatingEmojis((prev) => [...prev, { id, emoji: payload.emoji, x: Math.random() * 70 + 15 }])
        setTimeout(() => setFloatingEmojis((prev) => prev.filter((e) => e.id !== id)), 2300)
      })
      .subscribe()
    reactChannelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [roomCode]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleReact = (emoji: string) => {
    // ローカル即時表示
    const id = Math.random().toString(36).slice(2)
    setFloatingEmojis((prev) => [...prev, { id, emoji, x: Math.random() * 70 + 15 }])
    setTimeout(() => setFloatingEmojis((prev) => prev.filter((e) => e.id !== id)), 2300)
    // 他メンバーに broadcast
    reactChannelRef.current?.send({ type: "broadcast", event: "emoji_reaction", payload: { emoji } })
  }

  return { floatingEmojis, handleReact }
}
