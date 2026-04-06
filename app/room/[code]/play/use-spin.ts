"use client"

import { useEffect, useRef, useState } from "react"
import { vibrate, HapticPattern } from "@/lib/haptic"
import { playPressSound, playSpinStartSound, playTickSound, playResultSound, playNearMissSound, unlockAudioContext } from "@/lib/spin-sound"
import { SPIN_COUNTDOWN_MS } from "@/lib/constants"
import { trackEvent, AnalyticsEvent } from "@/lib/analytics"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import type { Phase, Room, Session, WinnerData } from "./types"

interface UseSpinParams {
  code: string
  room: Room | null
  isOwner: boolean
  currentUser: User | null
  guestHostTokenRef: React.RefObject<string | null>
  participants: string[]
  hasBillInput: boolean
  totalBill: number
  treatAmount: number
  splitAmount: number
  fetchRoom: () => Promise<void>
  fetchRanking: () => Promise<void>
  stopRecordingAfterReveal: () => void
  resetRecording: () => void
  setRecordingPhase: (p: "idle" | "countdown" | "spinning" | "done") => void
  startRecording: () => void
  // ISSUE-221: Broadcast 送信用チャンネル ref（use-room-sync.ts から渡される）
  spinSyncChannelRef: React.RefObject<ReturnType<ReturnType<typeof createClient>["channel"]> | null>
}

export function useSpin({
  code,
  room,
  isOwner,
  currentUser,
  guestHostTokenRef,
  participants,
  hasBillInput,
  totalBill,
  treatAmount,
  splitAmount,
  fetchRoom,
  fetchRanking,
  stopRecordingAfterReveal,
  resetRecording,
  setRecordingPhase,
  startRecording,
  spinSyncChannelRef,
}: UseSpinParams) {
  const [phase, setPhase] = useState<Phase>("waiting")
  const [spinError, setSpinError] = useState<string | null>(null)
  const [pendingWinnerIndex, setPendingWinnerIndex] = useState<number | undefined>(undefined)
  const [winner, setWinner] = useState<WinnerData | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showPrismBurst, setShowPrismBurst] = useState(false)
  const [confettiBurstKey, setConfettiBurstKey] = useState(0)
  // ISSUE-207: 感情ピーク — スロービルドアップ演出フラグ
  const [isSlowingDown, setIsSlowingDown] = useState(false)
  const [spinStartedAtMs, setSpinStartedAtMs] = useState<number | null>(null)
  const [spinRemainingMs, setSpinRemainingMs] = useState<number>(4500)
  const [clockOffsetMs, setClockOffsetMs] = useState<number>(0)
  const [countdownValue, setCountdownValue] = useState<number | null>(null)

  const spinScheduledRef = useRef(false)
  // ISSUE-223: 連打防止 — React の非同期 state 更新より先に同期フラグでロックする
  const isSpinningRef = useRef(false)
  const pendingMemberWinnerRef = useRef<WinnerData | null>(null)
  const prevSessionIdRef = useRef<string | null | undefined>(undefined)
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clockOffsetMsRef = useRef<number>(0)

  // Cleanup confetti timer on unmount
  useEffect(() => () => clearTimeout(confettiTimerRef.current ?? undefined), [])

  // ISSUE-202: メンバークライアントは spin API を呼ばないため clockOffsetMs が常に 0 になる。
  // マウント時に /api/time で NTP 方式の時刻同期を行い、clockOffsetMsRef を補正する。
  useEffect(() => {
    if (isOwner) return
    const t0 = performance.now()
    const t0Date = Date.now()
    fetch("/api/time").then((res) => {
      const serverTime = Number(res.headers.get("X-Server-Time") ?? 0)
      if (!serverTime) return
      const rtt = performance.now() - t0
      // adjustedNow = Date.now() + offset がサーバー現在時刻に近くなるよう補正
      // offset = serverTime - t0Date + rtt/2 とし、RTT の半分をサーバー処理時点として近似
      const offset = serverTime - t0Date + Math.round(rtt / 2)
      clockOffsetMsRef.current = offset
      setClockOffsetMs(offset)
    }).catch(() => {
      // ネットワークエラー時は offset=0 のまま（演出ズレは許容）
    })
  }, [isOwner]) // eslint-disable-line react-hooks/exhaustive-deps

  const buildGuestAuthHeaders = (): Record<string, string> => {
    if (currentUser || !guestHostTokenRef.current) return {}
    return { "X-Guest-Host-Token": guestHostTokenRef.current }
  }

  // --- Handlers ---

  // 減速フェーズ（結果直前）の演出: tick 音 × 3回 + 振動 + ISSUE-207 緊張感オーバーレイ
  const handleSlowingDown = () => {
    setIsSlowingDown(true)
    const delays = [0, 500, 950]
    delays.forEach((d) => {
      setTimeout(() => {
        playTickSound()
        vibrate(HapticPattern.tick)
      }, d)
    })
  }

  const handleNearMiss = () => {
    playNearMissSound()
    vibrate(HapticPattern.tick)
  }

  const handleSpinStart = () => {
    playSpinStartSound()
    vibrate(HapticPattern.start)
  }

  // Called when WinnerCard transitions from Phase A → Phase B.
  const handleDetailsPhase = () => {
    setConfettiBurstKey((k) => k + 1)
    setShowConfetti(true)
    clearTimeout(confettiTimerRef.current ?? undefined)
    confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 3000)
  }

  const handleSpin = async () => {
    if (phase !== "waiting" || participants.length < 2) return
    // ISSUE-223: 連打防止 — setPhase("preparing") より前に同期フラグでロックする
    if (isSpinningRef.current) return
    isSpinningRef.current = true

    unlockAudioContext()
    playPressSound()
    vibrate(HapticPattern.press)
    trackEvent(AnalyticsEvent.SPIN_BUTTON_CLICKED, { participants_count: participants.length })
    setSpinError(null)
    setPhase("preparing")
    setWinner(null)
    spinScheduledRef.current = false

    try {
      const res = await fetch(`/api/rooms/${code}/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildGuestAuthHeaders() },
        body: JSON.stringify({
          totalAmount: hasBillInput ? totalBill : null,
          treatAmount: hasBillInput ? treatAmount : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        trackEvent(AnalyticsEvent.SPIN_API_ERROR, { error: data.error ?? "unknown", status: res.status })
        // ISSUE-224: ステータスコード別の具体的メッセージ
        const status = res.status
        const msg =
          status === 409 ? "既にスピンが進行中です。少しお待ちください。" :
          status >= 500 ? "サーバーエラーが発生しました。もう一度お試しください。" :
          data.error || "スピンに失敗しました。もう一度お試しください。"
        setSpinError(msg)
        setPhase("waiting")
        return
      }

      trackEvent(AnalyticsEvent.SPIN_API_SUCCESS)
      const serverTime = Number(res.headers.get("X-Server-Time") ?? Date.now())
      const offset = serverTime - Date.now()
      clockOffsetMsRef.current = offset
      setClockOffsetMs(offset)
      const data = await res.json()

      // ISSUE-221: メンバーに spin_start を Broadcast 送信（postgres_changes より ~600ms 速い）
      // メンバーは受信後に即 fetchRoom() してスケジュールを組むため同期精度が大幅に向上する
      spinSyncChannelRef.current?.send({
        type: "broadcast",
        event: "spin_start",
        payload: { startedAt: data.spinStartedAt },
      })

      const MAX_SPIN_DELAY_MS = SPIN_COUNTDOWN_MS + 2000
      const delay = Math.max(0, Math.min(data.spinStartedAt - Date.now(), MAX_SPIN_DELAY_MS))
      setSpinStartedAtMs(data.spinStartedAt)
      setPendingWinnerIndex(data.winnerIndex)
      setSpinRemainingMs(4500)
      setTimeout(() => {
        if (!spinScheduledRef.current) {
          spinScheduledRef.current = true
          setPhase("spinning")
        }
      }, delay)
    } catch {
      // ISSUE-224: ネットワーク断かどうかを判定して具体的に案内する
      const msg = !navigator.onLine
        ? "インターネット接続を確認してください。"
        : "ネットワークエラーが発生しました。もう一度お試しください。"
      setSpinError(msg)
      setPhase("waiting")
    } finally {
      // ISSUE-223: 非同期処理完了後にロック解除（エラー時も成功時も）
      isSpinningRef.current = false
    }
  }

  const handleRespin = async () => {
    setIsSlowingDown(false) // ISSUE-207: リスピン時にオーバーレイをリセット
    setWinner(null)
    setPhase("waiting")
    setPendingWinnerIndex(undefined)
    setSpinError(null)
    setSpinStartedAtMs(null)
    setSpinRemainingMs(4500)
    spinScheduledRef.current = false
    prevSessionIdRef.current = null
    pendingMemberWinnerRef.current = null
    resetRecording()
    trackEvent(AnalyticsEvent.RESPIN_CLICKED)
    // ISSUE-006: API 呼び出し前に楽観的更新してポーリングとの競合を防ぐ
    // fetchRoom が setRoom を呼ぶので直接 setRoom は不要。
    // 呼び出し元の page.tsx の setRoom を使う必要があるため、別途 onRespin callback で対応。
  }

  const showResult = (currentRoom: Room | null) => {
    const latestSession = currentRoom?.sessions?.[0]
    if (!latestSession) return
    const wp = latestSession.participants?.find((p) => p.isWinner)
    if (wp) {
      setWinner({
        name: wp.name,
        index: wp.orderIndex,
        totalAmount: latestSession.totalAmount ?? undefined,
        treatAmount: latestSession.treatAmount ?? undefined,
        perPersonAmount: latestSession.perPersonAmount ?? undefined,
      })
      setPhase("result")
    }
  }

  const handleSpinComplete = (winnerName: string, winnerIndex: number) => {
    setPhase("result")
    setIsSlowingDown(false) // ISSUE-207: スロービルドアップ解除
    spinScheduledRef.current = false
    setPendingWinnerIndex(undefined)
    stopRecordingAfterReveal()
    trackEvent(AnalyticsEvent.SPIN_ANIMATION_COMPLETE)

    if (isOwner) {
      setWinner({
        name: winnerName,
        index: winnerIndex,
        totalAmount: hasBillInput ? totalBill : undefined,
        treatAmount: hasBillInput ? treatAmount : undefined,
        perPersonAmount: hasBillInput ? splitAmount : undefined,
      })
      playResultSound()
      vibrate(HapticPattern.result)
      setShowConfetti(true)
      setShowPrismBurst(true)
      setTimeout(() => setShowPrismBurst(false), 1800)
      clearTimeout(confettiTimerRef.current ?? undefined)
      confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 6000)
      // ISSUE-005: ルームとセッションを COMPLETED にする（retry 付き）
      ;(async () => {
        const MAX_RETRIES = 3
        for (let i = 0; i < MAX_RETRIES; i++) {
          try {
            const res = await fetch(`/api/rooms/${code}/spin-complete`, {
              method: "POST",
              headers: buildGuestAuthHeaders(),
            })
            if (res.ok || res.status === 404) {
              if (res.ok) {
                fetchRanking()
                trackEvent(AnalyticsEvent.ROOM_COMPLETED)
              }
              return
            }
            if (res.status === 409) return
          } catch {
            // ネットワークエラー → retry
          }
          if (i < MAX_RETRIES - 1) {
            await new Promise(r => setTimeout(r, 1000 * (i + 1)))
          } else {
            console.error("[OgoRoulette] spin-complete failed after retries")
            trackEvent(AnalyticsEvent.SPIN_COMPLETE_FAILED)
            setSpinError("結果の保存に失敗しました。ページを再読み込みしてください")
          }
        }
      })().catch((err) => {
        console.error("[OgoRoulette] spin-complete unexpected error:", err)
        setSpinError("結果の保存に失敗しました。ページを再読み込みしてください")
      })
    } else {
      const serverWinner = pendingMemberWinnerRef.current
      if (serverWinner) {
        setWinner(serverWinner)
        pendingMemberWinnerRef.current = null
        playResultSound()
        vibrate(HapticPattern.result)
        setShowConfetti(true)
        setShowPrismBurst(true)
        setTimeout(() => setShowPrismBurst(false), 1800)
        clearTimeout(confettiTimerRef.current ?? undefined)
        confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 6000)
      } else {
        showResult(room)
      }
    }
  }

  // --- Effects ---

  // ISSUE-003: phase="spinning" タイムアウト安全網
  useEffect(() => {
    if (phase !== "spinning") return
    const SPIN_TIMEOUT_MS = 4500 + 500 + 2500
    const id = setTimeout(() => {
      console.warn("[OgoRoulette] spin animation timeout — resetting phase to waiting")
      trackEvent(AnalyticsEvent.PHASE_TIMEOUT, { phase: "spinning" })
      setPhase("waiting")
      setSpinError("アニメーションがタイムアウトしました。再試行してください")
      spinScheduledRef.current = false
      setPendingWinnerIndex(undefined)
    }, SPIN_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [phase])

  // ISSUE-003: phase="preparing" タイムアウト安全網
  useEffect(() => {
    if (phase !== "preparing") return
    const PREPARING_TIMEOUT_MS = SPIN_COUNTDOWN_MS + 6000
    const id = setTimeout(() => {
      console.warn("[OgoRoulette] preparing phase timeout — resetting")
      trackEvent(AnalyticsEvent.PHASE_TIMEOUT, { phase: "preparing" })
      setPhase("waiting")
      setSpinError("準備がタイムアウトしました。再試行してください")
      spinScheduledRef.current = false
    }, PREPARING_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [phase])

  // Countdown display — driven by spinStartedAtMs while in preparing phase
  useEffect(() => {
    if (phase !== "preparing" || spinStartedAtMs === null) {
      setCountdownValue(null)
      return
    }
    const tick = () => {
      const remaining = spinStartedAtMs - Date.now()
      if (remaining <= 0) {
        setCountdownValue(null)
        return
      }
      setCountdownValue(Math.ceil(remaining / 1000))
    }
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [phase, spinStartedAtMs])

  // Sync roulette phase → recording phase
  useEffect(() => {
    if (phase === "preparing") {
      setRecordingPhase("countdown")
      startRecording()
    } else if (phase === "spinning") {
      setRecordingPhase("spinning")
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Member: react to polling results, sync animation start to server's spinStartedAt
  useEffect(() => {
    if (!room || isOwner) return

    const latestSession = room.sessions?.[0] ?? null
    const latestId = latestSession?.id ?? null

    const scheduleSpin = (session: Session) => {
      if (spinScheduledRef.current) return
      const wp = session.participants?.find((p) => p.isWinner)
      if (!wp) return

      pendingMemberWinnerRef.current = {
        name: wp.name,
        index: wp.orderIndex,
        totalAmount: session.totalAmount ?? undefined,
        treatAmount: session.treatAmount ?? undefined,
        perPersonAmount: session.perPersonAmount ?? undefined,
      }
      setPendingWinnerIndex(wp.orderIndex)

      const startMs = session.startedAt ? new Date(session.startedAt).getTime() : Date.now()
      const MAX_SPIN_DELAY_MS = SPIN_COUNTDOWN_MS + 2000
      const delay = Math.max(0, Math.min(startMs - Date.now(), MAX_SPIN_DELAY_MS))
      setSpinStartedAtMs(startMs)
      spinScheduledRef.current = true
      setPhase("preparing")

      setTimeout(() => {
        const now = Date.now()
        const adjustedNow = now + clockOffsetMsRef.current
        const elapsed = Math.max(0, adjustedNow - startMs)

        // ISSUE-220: スキップ判定を削除。elapsed がどれだけ大きくても必ずアニメーションを再生する。
        // 旧実装は elapsed をサーバー起点で測定していたため、メンバーのポーリング遅延(>5.5s)で
        // 「今初めてスピンを知った」状態でもスキップ判定が発動し演出が表示されなかった。
        // 修正: 常に spinning フェーズを経由し、最低 0.5 秒の短縮アニメーションを保証する。
        const cappedElapsed = Math.min(elapsed, 3000)
        const remaining = Math.max(500, 4500 - cappedElapsed)
        setSpinRemainingMs(remaining)
        setPhase("spinning")
      }, delay)
    }

    if (prevSessionIdRef.current === undefined) {
      prevSessionIdRef.current = latestId

      if (latestSession) {
        if (room.status === "COMPLETED") {
          const wp = latestSession.participants?.find((p) => p.isWinner)
          if (wp) {
            setWinner({
              name: wp.name,
              index: wp.orderIndex,
              totalAmount: latestSession.totalAmount ?? undefined,
              treatAmount: latestSession.treatAmount ?? undefined,
              perPersonAmount: latestSession.perPersonAmount ?? undefined,
            })
            setPhase("result")
          }
        } else if (room.status === "IN_SESSION") {
          scheduleSpin(latestSession)
        }
      }
      return
    }

    if (latestId && latestId !== prevSessionIdRef.current) {
      prevSessionIdRef.current = latestId
      if (latestSession) scheduleSpin(latestSession)
    } else {
      prevSessionIdRef.current = latestId
    }
  }, [room, isOwner]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    phase,
    setPhase,
    spinError,
    pendingWinnerIndex,
    winner,
    setWinner,
    showConfetti,
    showPrismBurst,
    confettiBurstKey,
    isSlowingDown,
    spinStartedAtMs,
    spinRemainingMs,
    clockOffsetMs,
    countdownValue,
    handleSpin,
    handleRespin,
    showResult,
    handleSpinComplete,
    handleDetailsPhase,
    handleSlowingDown,
    handleNearMiss,
    handleSpinStart,
    prevSessionIdRef,
    spinScheduledRef,
  }
}
