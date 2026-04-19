"use client"

import { useEffect, useRef, useState } from "react"
import { vibrate, HapticPattern } from "@/lib/haptic"
import { playPressSound, playSpinStartSound, playTickSound, playResultSound, playNearMissSound, unlockAudioContext } from "@/lib/spin-sound"
import { SPIN_COUNTDOWN_MS } from "@/lib/constants"
import { trackEvent, AnalyticsEvent } from "@/lib/analytics"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import type { Phase, Room, Session, SessionWinner, WinnerData } from "./types"

// ─── タイムアウト定数 ──────────────────────────────────────────────────────────
// spinning 安全網: アニメーション最大長 + バッファ
const SPINNING_TIMEOUT_MS = 4500 + 500 + 2500
// confetti 表示時間
const CONFETTI_DETAILS_MS = 3000  // winner card PhaseA→B
const CONFETTI_RESULT_MS = 6000   // 当選発表後フル演出
const PRISM_BURST_MS = 1800

// ─── 純粋ヘルパー ──────────────────────────────────────────────────────────────

/**
 * Session と当選参加者から WinnerData を組み立てる。
 * showResult / scheduleSpin / 初期ロードの3箇所で同一パターンが使われるため共通化。
 */
function buildWinnerFromSession(session: Session, wp: SessionWinner): WinnerData {
  return {
    name: wp.name,
    index: wp.orderIndex,
    totalAmount: session.totalAmount ?? undefined,
    treatAmount: session.treatAmount ?? undefined,
    perPersonAmount: session.perPersonAmount ?? undefined,
    sessionId: session.id,
    resultToken: session.resultToken,
  }
}

/** spin API エラーレスポンスからユーザー向けメッセージを生成する（副作用なし）。 */
function getSpinApiErrorMessage(status: number, errorData: Record<string, unknown>): string {
  if (status === 409) return "既にスピンが進行中です。少しお待ちください。"
  if (status >= 500) return "サーバーエラーが発生しました。もう一度お試しください。"
  return (errorData.error as string | undefined) || "スピンに失敗しました。もう一度お試しください。"
}

/** ネットワークエラー時のユーザー向けメッセージ（オンライン状態で分岐）。 */
function getNetworkErrorMessage(): string {
  return !navigator.onLine
    ? "インターネット接続を確認してください。"
    : "ネットワークエラーが発生しました。もう一度お試しください。"
}

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

  // ISSUE-282: session ID ベースのガード（同一セッションの二重スケジュール防止）
  const spinScheduledRef = useRef<string | null>(null)
  // ISSUE-223: 連打防止 — React の非同期 state 更新より先に同期フラグでロックする
  const isSpinningRef = useRef(false)
  const pendingMemberWinnerRef = useRef<WinnerData | null>(null)
  // ISSUE-278: scheduleSpin が予約したセッション ID（showResult フォールバック検証用）
  const scheduledSessionIdRef = useRef<string | null>(null)
  // ISSUE-276: spin API レスポンスの sessionId / resultToken を保持（オーナー用）
  const resultTokenRef = useRef<string | null>(null)
  const resultSessionIdRef = useRef<string | null>(null)
  // ISSUE-279: 初回 fetchRoom 検出を明示的に管理（undefined の implicit 依存を排除）
  const prevSessionIdRef = useRef<string | null>(null)
  const hasInitializedRef = useRef(false)
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
    confettiTimerRef.current = setTimeout(() => setShowConfetti(false), CONFETTI_DETAILS_MS)
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
    spinScheduledRef.current = null

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
        setSpinError(getSpinApiErrorMessage(res.status, data))
        setPhase("waiting")
        return
      }

      trackEvent(AnalyticsEvent.SPIN_API_SUCCESS)
      const serverTime = Number(res.headers.get("X-Server-Time") ?? Date.now())
      const offset = serverTime - Date.now()
      clockOffsetMsRef.current = offset
      setClockOffsetMs(offset)
      const data = await res.json()

      // ISSUE-276: 正式抽選結果の検証トークンを保存（WinnerData に含めて share URL へ）
      resultTokenRef.current = data.resultToken ?? null
      resultSessionIdRef.current = data.sessionId ?? null

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
      // ISSUE-282: null チェックで未スケジュールを判定し、session ID を記録
      const ownerSessionId = data.sessionId ?? "__scheduled__"
      setTimeout(() => {
        if (spinScheduledRef.current === null) {
          spinScheduledRef.current = ownerSessionId
          setPhase("spinning")
        }
      }, delay)
    } catch {
      // ISSUE-224: ネットワーク断かどうかを判定して具体的に案内する
      setSpinError(getNetworkErrorMessage())
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
    spinScheduledRef.current = null
    prevSessionIdRef.current = null
    hasInitializedRef.current = false
    scheduledSessionIdRef.current = null
    pendingMemberWinnerRef.current = null
    resetRecording()
    trackEvent(AnalyticsEvent.RESPIN_CLICKED)
    // ISSUE-006: API 呼び出し前に楽観的更新してポーリングとの競合を防ぐ
    // fetchRoom が setRoom を呼ぶので直接 setRoom は不要。
    // 呼び出し元の page.tsx の setRoom を使う必要があるため、別途 onRespin callback で対応。
  }

  // ISSUE-278: expectedSessionId を渡すと古いセッションへのフォールバックを防ぐ
  const showResult = (currentRoom: Room | null, expectedSessionId?: string | null) => {
    const latestSession = currentRoom?.sessions?.[0]
    if (!latestSession) return
    if (expectedSessionId != null && latestSession.id !== expectedSessionId) {
      console.warn("[OgoRoulette] showResult: session ID mismatch, skipping stale fallback")
      return
    }
    const wp = latestSession.participants?.find((p) => p.isWinner)
    if (wp) {
      setWinner(buildWinnerFromSession(latestSession, wp))
      setPhase("result")
    }
  }

  // ISSUE-005: spin-complete API を最大 3 回リトライして COMPLETED に遷移させる。
  // IIFE から名前付き関数に切り出すことでスタックトレースを追いやすくした。
  const completeSpinOnServer = async () => {
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
  }

  const handleSpinComplete = (winnerName: string, winnerIndex: number) => {
    setPhase("result")
    setIsSlowingDown(false) // ISSUE-207: スロービルドアップ解除
    spinScheduledRef.current = null
    setPendingWinnerIndex(undefined)
    stopRecordingAfterReveal()
    trackEvent(AnalyticsEvent.SPIN_ANIMATION_COMPLETE)

    if (isOwner) {
      // [OWNER] WinnerData は bill 入力値 + API レスポンストークンから組み立てる
      setWinner({
        name: winnerName,
        index: winnerIndex,
        totalAmount: hasBillInput ? totalBill : undefined,
        treatAmount: hasBillInput ? treatAmount : undefined,
        perPersonAmount: hasBillInput ? splitAmount : undefined,
        sessionId: resultSessionIdRef.current ?? undefined,
        resultToken: resultTokenRef.current ?? undefined,
      })
      playResultSound()
      vibrate(HapticPattern.result)
      setShowConfetti(true)
      setShowPrismBurst(true)
      setTimeout(() => setShowPrismBurst(false), PRISM_BURST_MS)
      clearTimeout(confettiTimerRef.current ?? undefined)
      confettiTimerRef.current = setTimeout(() => setShowConfetti(false), CONFETTI_RESULT_MS)
      // ISSUE-005: ルームとセッションを COMPLETED にする（retry 付き）
      completeSpinOnServer().catch((err) => {
        console.error("[OgoRoulette] spin-complete unexpected error:", err)
        setSpinError("結果の保存に失敗しました。ページを再読み込みしてください")
      })
    } else {
      // [MEMBER] pendingMemberWinnerRef に事前キャッシュされた当選者を使う
      const serverWinner = pendingMemberWinnerRef.current
      if (serverWinner) {
        setWinner(serverWinner)
        pendingMemberWinnerRef.current = null
        playResultSound()
        vibrate(HapticPattern.result)
        setShowConfetti(true)
        setShowPrismBurst(true)
        setTimeout(() => setShowPrismBurst(false), PRISM_BURST_MS)
        clearTimeout(confettiTimerRef.current ?? undefined)
        confettiTimerRef.current = setTimeout(() => setShowConfetti(false), CONFETTI_RESULT_MS)
      } else {
        // フォールバック: room から再取得（pendingMemberWinnerRef が空の場合）
        showResult(room, scheduledSessionIdRef.current)
      }
    }
  }

  // --- Effects ---

  // ISSUE-003: phase="spinning" タイムアウト安全網
  useEffect(() => {
    if (phase !== "spinning") return
    const id = setTimeout(() => {
      console.warn("[OgoRoulette] spin animation timeout — resetting phase to waiting")
      trackEvent(AnalyticsEvent.PHASE_TIMEOUT, { phase: "spinning" })
      setPhase("waiting")
      setSpinError("アニメーションがタイムアウトしました。再試行してください")
      spinScheduledRef.current = null
      setPendingWinnerIndex(undefined)
    }, SPINNING_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [phase])

  // ISSUE-003: phase="preparing" タイムアウト安全網
  useEffect(() => {
    if (phase !== "preparing") return
    const id = setTimeout(() => {
      console.warn("[OgoRoulette] preparing phase timeout — resetting")
      trackEvent(AnalyticsEvent.PHASE_TIMEOUT, { phase: "preparing" })
      setPhase("waiting")
      setSpinError("準備がタイムアウトしました。再試行してください")
      spinScheduledRef.current = null
    }, SPIN_COUNTDOWN_MS + 6000)
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
      // ISSUE-282: 同一セッション ID なら既にスケジュール済み → スキップ
      if (spinScheduledRef.current === session.id) return
      const wp = session.participants?.find((p) => p.isWinner)
      if (!wp) return

      pendingMemberWinnerRef.current = buildWinnerFromSession(session, wp)
      // ISSUE-278: showResult フォールバック検証用にセッション ID を保存
      scheduledSessionIdRef.current = session.id
      setPendingWinnerIndex(wp.orderIndex)

      const startMs = session.startedAt ? new Date(session.startedAt).getTime() : Date.now()
      const MAX_SPIN_DELAY_MS = SPIN_COUNTDOWN_MS + 2000
      const delay = Math.max(0, Math.min(startMs - Date.now(), MAX_SPIN_DELAY_MS))
      setSpinStartedAtMs(startMs)
      // ISSUE-282: セッション ID を格納してどのセッションがスケジュール済みかを記録
      spinScheduledRef.current = session.id
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

    // ISSUE-279: undefined の implicit 依存を排除し、hasInitializedRef で初回を明示管理
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      prevSessionIdRef.current = latestId

      if (latestSession) {
        if (room.status === "COMPLETED") {
          const wp = latestSession.participants?.find((p) => p.isWinner)
          if (wp) {
            setWinner(buildWinnerFromSession(latestSession, wp))
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
