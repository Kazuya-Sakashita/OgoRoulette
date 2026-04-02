"use client"

import { useEffect, useRef, useState, useMemo, use } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { calculateBillSplit } from "@/lib/bill-calculator"
import { isRoomOwner } from "@/lib/room-owner"
import { isSpinInProgress } from "@/lib/room-spin"
import { vibrate, HapticPattern } from "@/lib/haptic"
import { playPressSound, playSpinStartSound, playTickSound, playResultSound, playNearMissSound, unlockAudioContext } from "@/lib/spin-sound"
import Link from "next/link"
import { ArrowLeft, Calculator, ChevronDown, ChevronUp, Crown, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RouletteWheel } from "@/components/roulette-wheel"
import { WinnerCard } from "@/components/winner-card"
import { Confetti } from "@/components/confetti"
import { CountdownOverlay } from "@/components/countdown-overlay"
import { createClient } from "@/lib/supabase/client"
import { getDisplayName } from "@/lib/display-name"
import { SEGMENT_COLORS, SPIN_COUNTDOWN_MS } from "@/lib/constants"
import { formatCurrency } from "@/lib/format"
import { getTreatTitle } from "@/lib/group-storage"
import { useGroups } from "@/hooks/use-groups"
import { trackEvent, AnalyticsEvent } from "@/lib/analytics"
import { RecordingCanvas } from "@/components/recording-canvas"
import { ShareSheet } from "@/components/share-sheet"
import { useVideoRecorder } from "@/lib/use-video-recorder"
import type { User } from "@supabase/supabase-js"

// --- Types ---

// Phase state machine: waiting → preparing → spinning → result
// waiting:   初期状態。SPINボタン押下可能。
// preparing: オーナーがAPI呼び出し中 / メンバーが spinStartedAt まで待機中。
// spinning:  ルーレットアニメーション実行中。
// result:    当選者決定。WinnerCard 表示。
type Phase = "waiting" | "preparing" | "spinning" | "result"

interface Member {
  id: string
  nickname: string | null
  color: string
  isHost: boolean
  profile: { id: string; name: string | null; displayName: string | null; avatarUrl: string | null } | null
}

interface SessionWinner {
  name: string
  isWinner: boolean
  color: string
  orderIndex: number
}

interface Session {
  id: string
  status: string
  startedAt: string | null
  totalAmount: number | null
  treatAmount: number | null
  perPersonAmount: number | null
  participants: SessionWinner[]
}

interface Room {
  id: string
  name: string | null
  inviteCode: string
  maxMembers: number
  status: string
  expiresAt?: string | null
  members: Member[]
  sessions: Session[]
  _count: { members: number }
}

interface WinnerData {
  name: string
  index: number
  totalAmount?: number
  treatAmount?: number
  perPersonAmount?: number
}

// --- Helpers ---

// ISSUE-090: profile.name（プロバイダ由来名）は使わない。公開名を優先する。
function getMemberName(member: Member): string {
  return member.nickname || (member.profile ? getDisplayName(member.profile) : "ゲスト")
}

// --- Component ---

export default function RoomPlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)

  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)

  // Phase-based roulette state
  const [phase, setPhase] = useState<Phase>("waiting")
  const [spinError, setSpinError] = useState<string | null>(null)
  const [pendingWinnerIndex, setPendingWinnerIndex] = useState<number | undefined>(undefined)
  const [winner, setWinner] = useState<WinnerData | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  // Increment to remount Confetti and trigger a fresh burst (e.g. Phase A → B transition)
  const [confettiBurstKey, setConfettiBurstKey] = useState(0)
  // ISSUE-047: ranking は全スピン履歴から集計した専用 API で取得
  const [roomRanking, setRoomRanking] = useState<{ name: string; count: number }[] | undefined>(undefined)

  // ISSUE-141: モバイル端末の実表示域に合わせてルーレットサイズを動的に調整する
  // window.innerHeight = iOS Safariの実際の表示域（100vhとは異なり、ブラウザChromeを除いた値）
  const [wheelSize, setWheelSize] = useState(280)

  // Bill input
  const [showBillInput, setShowBillInput] = useState(false)
  const [totalBill, setTotalBill] = useState(0)
  const [treatAmount, setTreatAmount] = useState(0)

  // Tracks latest known session ID to detect new results across polls
  const prevSessionIdRef = useRef<string | null | undefined>(undefined)
  // Prevents double-scheduling the animation setTimeout (owner and member share this guard)
  const spinScheduledRef = useRef(false)
  // Member: stores server-confirmed winner while local wheel animation runs
  const pendingMemberWinnerRef = useRef<WinnerData | null>(null)

  // Countdown display — driven by spinStartedAtMs vs Date.now()
  const [spinStartedAtMs, setSpinStartedAtMs] = useState<number | null>(null)
  // ルーム同期: メンバーがアニメーション開始時点で spinStartedAt から何 ms 経過しているか
  const [spinElapsedMs, setSpinElapsedMs] = useState<number>(0)
  const [countdownValue, setCountdownValue] = useState<number | null>(null)

  // Video recording
  const {
    recordingPhase,
    setRecordingPhase,
    recordedBlob,
    showShareSheet,
    setShowShareSheet,
    recordingCanvasRef,
    wheelRotationRef,
    startRecording,
    stopRecordingAfterReveal,
    reset: resetRecording,
    isRecording,
  } = useVideoRecorder()

  // Group save — hook 呼び出しはここで固定（Hook の呼び出し順を安定させるため）
  // isCurrentGroupSaved / handleSaveGroup は participants に依存するため
  // participants の useMemo 定義後（--- Derived --- セクション末尾）に配置する
  const { groups: savedGroups, saveGroup } = useGroups(currentUser)

  // Guest host detection
  const [isGuestHost, setIsGuestHost] = useState(false)
  // isGuestHostResolved: true once localStorage has been read (or currentUser confirms auth user)
  // Used in loading guard to prevent member-side effects from firing before isOwner is settled
  const [isGuestHostResolved, setIsGuestHostResolved] = useState(false)
  // Guest host token — used as X-Guest-Host-Token header for server-side auth
  const guestHostTokenRef = useRef<string | null>(null)
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // --- Derived ---

  const membersKey = room?.members.map(getMemberName).join("\0") ?? ""
  const participants = useMemo(
    () => (membersKey ? membersKey.split("\0") : []),
    [membersKey]
  )

  const isOwner = currentUser
    ? isRoomOwner(room?.members ?? [], currentUser.id)
    : isGuestHost

  const isCompleted = room?.status === "COMPLETED"

  // ISSUE-010: 有効期限の派生状態
  const expiresAtMs = room?.expiresAt ? new Date(room.expiresAt).getTime() : null
  const isExpired = expiresAtMs !== null && expiresAtMs < Date.now()
  const isExpiringSoon = expiresAtMs !== null && !isExpired && expiresAtMs - Date.now() < 24 * 60 * 60 * 1000

  const { splitAmount, isActive: hasBillInput } = calculateBillSplit(
    totalBill,
    treatAmount,
    participants.length
  )

  const quickAmounts = [5000, 10000, 15000, 20000]

  // participants 依存の派生値 — participants の useMemo より後に定義する必要がある
  // ※ 定義順を participants より前に置くと TDZ エラー（Cannot access 'participants' before initialization）
  const isCurrentGroupSaved = savedGroups.some(
    (g) =>
      g.participants.length === participants.length &&
      [...g.participants].sort().join() === [...participants].sort().join()
  )
  const handleSaveGroup = async (name: string) => {
    await saveGroup(name, participants)
  }

  // ISSUE-047: roomRanking は API から取得 (state 宣言は上部)

  // --- Effects ---

  // ISSUE-141: ビューポートサイズに合わせてルーレットホイールのサイズを動的に計算する
  // window.innerHeight を使うことで iOS Safari のブラウザChromeを除いた実表示域を取得できる
  // （100vh は chrome 非表示時の大きい値を返すため、iPhoneで見切れる原因になる）
  useEffect(() => {
    // ヘッダー・参加者リスト・SPIN ボタン等の固定 UI の概算合計（px）
    // ルーレット以外の縦方向占有量: コンテナpaddingx2(48) + ヘッダー(56) + 参加者(70) +
    //   金額入力（68）+ ルーレット内py+mb+ボタン等(190) = 432px
    const RESERVED_HEIGHT = 440
    const update = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      // max-w-[390px] + px-5 (10px × 2) → コンテンツ幅から余白を引いた値
      const byWidth = Math.min(280, vw - 40)
      const byHeight = Math.min(280, vh - RESERVED_HEIGHT)
      setWheelSize(Math.max(200, Math.min(byWidth, byHeight)))
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user)
      setAuthLoaded(true)
    })
  }, [])

  const fetchRoom = async () => {
    try {
      const res = await fetch(`/api/rooms/${code}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.expired ? "expired" : (data.error || "ルームが見つかりません"))
        return
      }

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
  // ⚠️ Supabase ダッシュボードで Room テーブルの Realtime を有効化し、
  //    RLS ポリシー（inviteCode で読み取り許可）を設定する必要があります。
  useEffect(() => {
    const supabase = createClient()
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    // 初回取得
    fetchRoom()
    fetchRanking()

    // Realtime: Room テーブルの変更を購読（ポーリングより低レイテンシ）
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
        // ISSUE-146: Realtime 再接続時に即座に fetchRoom() してミスしたイベントをリカバリー
        // 初回 SUBSCRIBED でも fetchRoom() を呼ぶが、line 284 の初回取得と競合しても idempotent
        if (status === "SUBSCRIBED") fetchRoom()
      })

    // フォールバックポーリング: 10 秒ごと（Realtime が機能していない場合の安全網）
    const poll = async () => {
      await fetchRoom()
      if (!cancelled) timeoutId = setTimeout(poll, 10000)
    }
    timeoutId = setTimeout(poll, 10000)

    return () => {
      cancelled = true
      if (timeoutId !== null) clearTimeout(timeoutId)
      supabase.removeChannel(channel)
    }
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(confettiTimerRef.current ?? undefined), [])

  // Called when WinnerCard transitions from Phase A (cinematic reveal) → Phase B (details sheet).
  // Remounts Confetti with a fresh lighter burst so the details sheet feels celebratory.
  const handleDetailsPhase = () => {
    setConfettiBurstKey((k) => k + 1)
    setShowConfetti(true)
    clearTimeout(confettiTimerRef.current ?? undefined)
    confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 3000)
  }

  // Drive countdown display from spinStartedAtMs while in preparing phase.
  // Polls at 200 ms for smooth second-level accuracy.
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

  // スピン中のページ離脱を警告する
  useEffect(() => {
    if (phase !== "spinning" && phase !== "preparing") return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [phase])

  // ISSUE-045: オーナーがスピン中にページを離脱したとき room を WAITING にリセットする
  // pagehide は実際のページアンロード時のみ発火し、キャンセルダイアログには反応しない
  // sendBeacon はカスタムヘッダーを送れないため、ゲストトークンは body で渡す
  useEffect(() => {
    if ((phase !== "spinning" && phase !== "preparing") || !isOwner) return
    const handlePageHide = () => {
      const url = `/api/rooms/${code}/reset`
      const token = guestHostTokenRef.current
      if (token) {
        navigator.sendBeacon(url, new Blob([JSON.stringify({ guestToken: token })], { type: "application/json" }))
      } else {
        navigator.sendBeacon(url)
      }
    }
    window.addEventListener("pagehide", handlePageHide)
    return () => window.removeEventListener("pagehide", handlePageHide)
  }, [phase, isOwner, code])

  // ISSUE-003: phase="spinning" タイムアウト安全網
  // アニメーション総時間（4.5秒+バウンス0.5秒）+ バッファ2.5秒 = 7.5秒
  // Framer Motion の .then() が発火しない稀なケースで phase が "spinning" に固まるのを回収する
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
  // SPIN_COUNTDOWN_MS(3秒) + clock skew 許容(2秒) + バッファ(4秒) = 9秒
  // ISSUE-001/002 の isOwner フリッカーや ISSUE-004 の clock skew で preparing に固まった場合の回収
  // cleanup が phase 変化時に timeout をキャンセルするため、発火時は必ず phase === "preparing"
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

  useEffect(() => {
    // 認証ユーザーは localStorage チェック不要なので即 resolved
    if (currentUser) {
      setIsGuestHostResolved(true)
      return
    }
    if (!room) return
    const stored: string[] = JSON.parse(
      localStorage.getItem("ogoroulette_host_rooms") || "[]"
    )
    setIsGuestHost(stored.includes(room.inviteCode))
    guestHostTokenRef.current = localStorage.getItem(`ogoroulette_host_token_${room.inviteCode}`)
    setIsGuestHostResolved(true)
  }, [room?.inviteCode, currentUser]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync roulette phase → recording phase.
  // ISSUE-091: Start recording at "countdown" (not "spinning") so the 3-2-1
  // anticipation is captured in the video. "spinning" only updates the phase.
  useEffect(() => {
    if (phase === "preparing") {
      setRecordingPhase("countdown")
      startRecording()
    } else if (phase === "spinning") {
      setRecordingPhase("spinning")
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ゲストホスト専用: サーバー認可用ヘッダーを組み立てる
  const buildGuestAuthHeaders = (): Record<string, string> => {
    if (currentUser || !guestHostTokenRef.current) return {}
    return { "X-Guest-Host-Token": guestHostTokenRef.current }
  }

  // Member: react to polling results, sync animation start to server's spinStartedAt
  useEffect(() => {
    if (!room || isOwner) return

    const latestSession = room.sessions?.[0] ?? null
    const latestId = latestSession?.id ?? null

    // Schedule animation aligned to server spinStartedAt
    // spinScheduledRef prevents double-scheduling on consecutive polls
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

      // Align to server spinStartedAt — if in the past, starts immediately
      const startMs = session.startedAt ? new Date(session.startedAt).getTime() : Date.now()
      const delay = Math.max(0, startMs - Date.now())
      setSpinStartedAtMs(startMs)
      spinScheduledRef.current = true
      setPhase("preparing")
      // ISSUE-146: アニメーション終了後もポーリング fallback (10秒) が間に合うよう余裕を持たせる
      // spin 4500ms + bounce 500ms = 5000ms に 3000ms バッファを加算
      // elapsed = 7000ms (10秒ポーリング - 3秒カウントダウン) < 8000ms → スキップしない
      const TOTAL_ANIM_MS = 8000
      setTimeout(() => {
        const elapsed = Math.max(0, Date.now() - startMs)
        // 受信が遅すぎてアニメーション終了済みの場合 → アニメーションをスキップして直接 result 表示
        if (elapsed >= TOTAL_ANIM_MS) {
          const winnerData = pendingMemberWinnerRef.current
          if (winnerData) {
            setWinner(winnerData)
            setPhase("result")
            spinScheduledRef.current = false
          }
          return
        }
        setSpinElapsedMs(elapsed)
        setPhase("spinning")
      }, delay)
    }

    // First load
    if (prevSessionIdRef.current === undefined) {
      prevSessionIdRef.current = latestId

      if (latestSession) {
        if (room.status === "COMPLETED") {
          // Reload of finished room → show without animation
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
          // Mid-spin join → schedule using startedAt
          scheduleSpin(latestSession)
        }
      }
      return
    }

    // Subsequent polls: detect new session
    if (latestId && latestId !== prevSessionIdRef.current) {
      prevSessionIdRef.current = latestId
      if (latestSession) scheduleSpin(latestSession)
    } else {
      prevSessionIdRef.current = latestId
    }
  }, [room, isOwner])

  // --- Handlers ---

  // 減速フェーズ（結果直前）の演出: tick 音 × 3回 + 振動
  const handleSlowingDown = () => {
    const delays = [0, 500, 950]
    delays.forEach((d) => {
      setTimeout(() => {
        playTickSound()
        vibrate(HapticPattern.tick)
      }, d)
    })
  }

  // ニアミス演出コールバック（RouletteWheel → onNearMiss）
  const handleNearMiss = () => {
    playNearMissSound()
    vibrate(HapticPattern.tick)
  }

  // 回転開始直後の演出（RouletteWheel からコールバック）
  const handleSpinStart = () => {
    playSpinStartSound()
    vibrate(HapticPattern.start)
  }

  const handleSpin = async () => {
    if (phase !== "waiting" || participants.length < 2) return

    // iOS Safari: ユーザータップのタイミングで AudioContext をアンロック（sync）
    // 無音バッファ再生で確実に unlock し、以降の setTimeout 等からも音が出る
    unlockAudioContext()

    // 押下フィードバック（音・振動）は即時
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
        setSpinError(data.error || "スピンに失敗しました")
        setPhase("waiting")
        return
      }

      trackEvent(AnalyticsEvent.SPIN_API_SUCCESS)
      const data = await res.json()
      // サーバーが決定した spinStartedAt まで待ってからアニメーション開始
      // clock skew 上限: SPIN_COUNTDOWN_MS + 2秒（最大5秒）を超えないようにキャップ
      const MAX_SPIN_DELAY_MS = SPIN_COUNTDOWN_MS + 2000
      const delay = Math.max(0, Math.min(data.spinStartedAt - Date.now(), MAX_SPIN_DELAY_MS))
      setSpinStartedAtMs(data.spinStartedAt)
      setPendingWinnerIndex(data.winnerIndex)
      setSpinElapsedMs(0) // オーナーは常にフル duration で開始
      setTimeout(() => {
        if (!spinScheduledRef.current) {
          spinScheduledRef.current = true
          setPhase("spinning")
        }
      }, delay)
    } catch {
      setSpinError("ネットワークエラーが発生しました")
      setPhase("waiting")
    }
  }

  const handleRespin = async () => {
    setWinner(null)
    setPhase("waiting")
    setPendingWinnerIndex(undefined)
    setSpinError(null)
    setSpinStartedAtMs(null)
    setSpinElapsedMs(0)
    spinScheduledRef.current = false
    prevSessionIdRef.current = null
    pendingMemberWinnerRef.current = null
    resetRecording()

    trackEvent(AnalyticsEvent.RESPIN_CLICKED)
    // ISSUE-006: API 呼び出し前に楽観的更新してポーリングとの競合を防ぐ
    // これにより SPIN ボタンが「結果を見る」に一時的に切り替わらなくなる
    setRoom(prev => prev ? { ...prev, status: "WAITING", sessions: [] } : prev)

    try {
      const res = await fetch(`/api/rooms/${code}/reset`, {
        method: "POST",
        headers: buildGuestAuthHeaders(),
      })
      if (!res.ok) {
        const data = await res.json()
        setSpinError(data.error || "リセットに失敗しました")
        // 楽観的更新をロールバック（最新状態を再取得）
        await fetchRoom()
      }
    } catch {
      setSpinError("ネットワークエラーが発生しました")
      await fetchRoom()
    }
  }

  const showResult = () => {
    const latestSession = room?.sessions?.[0]
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
      clearTimeout(confettiTimerRef.current ?? undefined)
      // 6000ms matches the Confetti component's internal intense-mode timer (intense ? 6000 : 4000)
      confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 6000)
      // ISSUE-005: ルームとセッションを COMPLETED にする（retry 付き）
      // 失敗すると room が IN_SESSION のまま残り次スピンが 409 になるため retry する
      ;(async () => {
        const MAX_RETRIES = 3
        for (let i = 0; i < MAX_RETRIES; i++) {
          try {
            const res = await fetch(`/api/rooms/${code}/spin-complete`, {
              method: "POST",
              headers: buildGuestAuthHeaders(),
            })
            if (res.ok || res.status === 404) {
              if (res.ok) fetchRanking() // スピン完了後にランキング更新 (ISSUE-047)
              return // 完了済み or ルームなし → 終了
            }
            // 409 は別セッションがすでに COMPLETED → 終了
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
      })()
    } else {
      // Member: サーバー確定の当選者を使う
      const serverWinner = pendingMemberWinnerRef.current
      if (serverWinner) {
        setWinner(serverWinner)
        pendingMemberWinnerRef.current = null
        playResultSound()
        vibrate(HapticPattern.result)
        setShowConfetti(true)
        clearTimeout(confettiTimerRef.current ?? undefined)
        confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 6000)
      }
    }
  }

  // --- Render: loading / error ---

  if (loading || !authLoaded || !isGuestHostResolved) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-[390px] md:max-w-lg min-h-dvh flex flex-col px-5 py-6">
          {/* Header skeleton */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-9 h-9 rounded-xl bg-white/10 animate-pulse" />
            <div className="h-5 w-32 rounded-full bg-white/10 animate-pulse" />
            <div className="ml-auto h-5 w-16 rounded-full bg-white/10 animate-pulse" />
          </div>
          {/* Wheel skeleton */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-0">
            <div className="rounded-full bg-white/10 animate-pulse" style={{ width: wheelSize, height: wheelSize }} />
            <div className="w-64 h-16 rounded-2xl bg-white/10 animate-pulse" />
          </div>
        </div>
      </main>
    )
  }

  if (error || !room) {
    const isExpiredError = error === "expired"
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-[390px] md:max-w-lg min-h-dvh flex flex-col px-5 py-6">
          <header className="flex items-center gap-4 mb-8">
            <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
              <Link href="/home">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-muted-foreground mb-4">
              {isExpiredError ? "このルームは有効期限が切れています" : error}
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              {isExpiredError && (
                <Button asChild className="bg-gradient-accent text-primary-foreground">
                  <Link href="/room/create">新しいルームを作る</Link>
                </Button>
              )}
              <Button asChild variant={isExpiredError ? "outline" : "default"}>
                <Link href="/home">ホームに戻る</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // --- Render: main ---

  return (
    <main className="min-h-screen bg-background overflow-x-clip">
      {/* Hidden recording canvas — off-screen, captured by MediaRecorder */}
      <RecordingCanvas
        phase={recordingPhase}
        countdown={countdownValue}
        wheelRotationRef={wheelRotationRef}
        participants={participants}
        winnerIndex={winner?.index ?? null}
        winner={winner?.name ?? null}
        winnerColor={winner ? SEGMENT_COLORS[winner.index % SEGMENT_COLORS.length] : SEGMENT_COLORS[0]}
        canvasRef={recordingCanvasRef}
      />

      {/* REC indicator — visible only when MediaRecorder is actually running (ISSUE-103: hidden on iOS) */}
      {isRecording && (
        <div className="fixed top-4 right-4 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/90 text-white text-xs font-bold animate-pulse pointer-events-none">
          ● REC
        </div>
      )}

      {/* Share sheet — appears once recording is ready */}
      {showShareSheet && recordedBlob && winner && (
        <ShareSheet
          blob={recordedBlob}
          winner={winner.name}
          winnerColor={SEGMENT_COLORS[winner.index % SEGMENT_COLORS.length]}
          onClose={() => setShowShareSheet(false)}
          onRespin={isOwner ? () => { resetRecording(); handleRespin() } : undefined}
        />
      )}

      <Confetti
        key={confettiBurstKey}
        active={showConfetti}
        intense={confettiBurstKey === 0 && !!winner}
        winnerColor={winner ? SEGMENT_COLORS[winner.index % SEGMENT_COLORS.length] : undefined}
      />

      {/* Countdown overlay — shows 3→2→1 during preparing phase */}
      <CountdownOverlay
        countdown={countdownValue}
        participants={participants}
        memberCount={room._count.members}
      />

      {winner && (
        <WinnerCard
          winner={winner.name}
          winnerIndex={winner.index}
          onClose={() => {
            setWinner(null)
            setPhase("waiting")
            resetRecording()
          }}
          totalBill={winner.totalAmount}
          treatAmount={winner.treatAmount}
          splitAmount={winner.perPersonAmount}
          participants={participants}
          isOwner={isOwner}
          roomCode={code}
          onRespin={isOwner ? handleRespin : undefined}
          treatCount={roomRanking?.find((r) => r.name === winner.name)?.count}
          treatTitle={(() => {
            const c = roomRanking?.find((r) => r.name === winner.name)?.count
            return c ? getTreatTitle(c) : undefined
          })()}
          ranking={roomRanking}
          videoBlob={recordedBlob}
          onShareVideo={() => setShowShareSheet(true)}
          recordingCanvasRef={recordingCanvasRef}
          onSaveGroup={isCurrentGroupSaved ? undefined : handleSaveGroup}
          isGuest={!currentUser}
          onAdvanceToDetails={handleDetailsPhase}
        />
      )}

      <div className="mx-auto max-w-[390px] md:max-w-lg min-h-dvh flex flex-col px-5 py-6">

        {/* Header */}
        <header className="flex items-center gap-3 mb-4">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <Link href="/home">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <Link href={`/room/${code}`} className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">
              {room.name || "ルーレット"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isOwner ? "オーナー" : "参加中"} · {room._count.members}人
            </p>
          </Link>
        </header>

        {/* ISSUE-127: ゲスト参加者向けログイン誘導 */}
        {!currentUser && !isOwner && (
          <p className="text-xs text-muted-foreground/60 text-center mb-2">
            ゲスト参加中 · <Link href="/auth/login" className="text-primary hover:underline">ログインして公開名を設定</Link>
          </p>
        )}

        {/* ISSUE-010: 有効期限バナー */}
        {isExpired && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-between gap-2">
            <p className="text-xs text-red-400 font-medium">このルームは有効期限が切れています</p>
            <Link href="/room/create" className="text-xs text-red-400 underline shrink-0">新しいルームを作る</Link>
          </div>
        )}
        {isExpiringSoon && expiresAtMs && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/25">
            <p className="text-xs text-yellow-400">
              有効期限: {new Date(expiresAtMs).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        )}

        {/* Participants */}
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              参加者
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {room.members.map((member, index) => (
              <div
                key={member.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-card border border-white/10"
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                >
                  {getMemberName(member).charAt(0)}
                </div>
                <span className="text-sm font-medium text-foreground">
                  {getMemberName(member)}
                </span>
                {member.isHost && <Crown className="w-3 h-3 text-primary" />}
              </div>
            ))}
          </div>
        </section>

        {/* Bill input — hidden while spinning or in result */}
        <section className={`mb-4 ${phase !== "waiting" ? "hidden" : ""}`}>
          <button
            onClick={() => setShowBillInput(!showBillInput)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl glass-card border border-white/10 hover:border-primary/30 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-accent flex items-center justify-center">
                <Calculator className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="text-left">
                <span className="text-sm font-medium text-foreground">金額を設定</span>
                {hasBillInput && (
                  <p className="text-xs text-muted-foreground">
                    奢り {formatCurrency(treatAmount)} / 割り勘 {formatCurrency(splitAmount)}
                  </p>
                )}
              </div>
            </div>
            {showBillInput
              ? <ChevronUp className="w-5 h-5 text-muted-foreground" />
              : <ChevronDown className="w-5 h-5 text-muted-foreground" />
            }
          </button>

          {showBillInput && (
            <div className="mt-3 p-4 rounded-2xl glass-card border border-white/10 space-y-4">
              {/* Total bill */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  合計金額
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">
                    ¥
                  </span>
                  <input
                    type="number"
                    value={totalBill || ""}
                    min="0"
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value))
                      setTotalBill(val)
                      if (treatAmount > val) setTreatAmount(val)
                    }}
                    className="w-full h-12 pl-9 pr-4 text-xl font-bold text-foreground bg-secondary rounded-xl border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    placeholder="30000"
                  />
                </div>
              </div>

              {/* Treat amount */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  奢り金額（勝者が払う）
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">
                    ¥
                  </span>
                  <input
                    type="number"
                    value={treatAmount || ""}
                    min="0"
                    max={totalBill}
                    onChange={(e) =>
                      setTreatAmount(Math.min(Math.max(0, Number(e.target.value)), totalBill))
                    }
                    className="w-full h-12 pl-9 pr-4 text-xl font-bold text-foreground bg-secondary rounded-xl border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    placeholder="20000"
                  />
                </div>
                <div className="flex gap-2 mt-3">
                  {quickAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() =>
                        setTreatAmount(Math.min(amount, totalBill || amount))
                      }
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                        treatAmount === amount
                          ? "bg-gradient-accent text-primary-foreground"
                          : "bg-secondary text-muted-foreground hover:text-foreground border border-white/10"
                      }`}
                    >
                      ¥{amount.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live preview */}
              {hasBillInput && (
                <div className="p-4 rounded-xl bg-gradient-accent text-primary-foreground">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="opacity-80">合計</span>
                      <span className="font-semibold">{formatCurrency(totalBill)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-80">奢り</span>
                      <span className="font-semibold">- {formatCurrency(treatAmount)}</span>
                    </div>
                    <div className="h-px bg-white/30" />
                    <div className="flex justify-between pt-1">
                      <span className="font-medium">1人あたり</span>
                      <span className="text-lg font-bold">{formatCurrency(splitAmount)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Roulette wheel */}
        {/* ISSUE-141: min-h-0 で flex アイテムが正しく縮小できるようにする */}
        <div className="flex-1 flex flex-col items-center justify-center py-4 min-h-0">
          {/* ホイール周囲のグロー: spinning 中に拡大 */}
          <div className="relative mb-6">
            <motion.div
              className="absolute inset-0 rounded-full pointer-events-none"
              animate={{
                scale: phase === "spinning" ? [1.5, 1.7, 1.5] : 1.5,
                opacity: phase === "spinning" ? [0.15, 0.25, 0.15] : 0.1,
              }}
              transition={phase === "spinning"
                ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.5 }
              }
              style={{ background: "radial-gradient(circle, #F97316 0%, transparent 70%)", filter: "blur(30px)" }}
            />
            <RouletteWheel
              isSpinning={phase === "spinning"}
              size={wheelSize}
              participants={participants}
              targetWinnerIndex={pendingWinnerIndex}
              onSpinComplete={handleSpinComplete}
              onSpinStart={handleSpinStart}
              onSlowingDown={handleSlowingDown}
              onNearMiss={handleNearMiss}
              wheelRotationRef={wheelRotationRef}
              spinElapsedMs={spinElapsedMs}
              spinSeed={spinStartedAtMs ?? undefined}
            />
          </div>

          {spinError && (
            <div className="flex flex-col items-center gap-2 mb-3 px-4">
              <p className="text-sm text-red-400 text-center">{spinError}</p>
              {/* ISSUE-131: spin-complete全失敗時にリロードで復旧できることを伝える */}
              {spinError.includes("再読み込み") && (
                <button
                  onClick={() => window.location.reload()}
                  className="text-xs text-primary hover:underline"
                >
                  ページを再読み込みする →
                </button>
              )}
            </div>
          )}

          <AnimatePresence mode="wait">
            {isCompleted ? (
              <motion.div
                key="completed"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 w-full max-w-[280px]"
              >
                <Button
                  onClick={showResult}
                  className="w-full h-14 text-base font-bold rounded-2xl bg-gradient-accent hover:opacity-90 text-white shadow-lg transition-all"
                >
                  結果を見る
                </Button>
                <Button
                  asChild
                  className="w-full h-12 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all"
                >
                  <Link href="/home">ホームへ戻る</Link>
                </Button>
                {isOwner && (
                  <Button
                    asChild
                    variant="outline"
                    className="w-full h-12 rounded-2xl border-white/20 text-muted-foreground hover:text-foreground transition-all"
                  >
                    <Link href="/room/create">新しい抽選を作る</Link>
                  </Button>
                )}
              </motion.div>
            ) : isOwner ? (
              <motion.button
                key="spin-btn"
                onClick={handleSpin}
                disabled={phase !== "waiting" || participants.length < 2}
                className="w-full max-w-[280px] h-16 text-xl font-bold rounded-2xl bg-gradient-accent text-white shadow-lg glow-primary disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                // 待機中: ゆったりした呼吸感。押下中: scale down。準備中以降: アニメーション停止。
                animate={
                  phase === "waiting"
                    ? { scale: [1, 1.025, 1], boxShadow: ["0 0 20px rgba(249,115,22,0.3)", "0 0 35px rgba(249,115,22,0.6)", "0 0 20px rgba(249,115,22,0.3)"] }
                    : { scale: 1, boxShadow: "0 0 20px rgba(249,115,22,0.3)" }
                }
                transition={phase === "waiting"
                  ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.2 }
                }
                whileTap={{ scale: 0.93 }}
              >
                <AnimatePresence mode="wait">
                  {phase === "preparing" ? (
                    <motion.span
                      key="preparing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2"
                    >
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      準備中...
                    </motion.span>
                  ) : phase === "spinning" ? (
                    <motion.span
                      key="spinning"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2"
                    >
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      回転中...
                    </motion.span>
                  ) : (
                    <motion.span
                      key="ready"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                    >
                      🎯 運命を回す
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            ) : (
              // メンバー待機表示
              <motion.div
                key="member-waiting"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-center py-5 px-6 rounded-2xl glass-card border w-full max-w-[280px] transition-colors duration-500 ${
                  isSpinInProgress(room.status) || phase === "preparing" || phase === "spinning"
                    ? "border-primary/40"
                    : "border-white/10"
                }`}
              >
                {isSpinInProgress(room.status) || phase === "preparing" || phase === "spinning" ? (
                  <>
                    <motion.div
                      className="w-3 h-3 rounded-full bg-green-400 mx-auto mb-3"
                      animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                    {/* ISSUE-134: preparingフェーズではスピン開始前の「準備中」を伝える */}
                    <p className="text-sm font-semibold text-primary">
                      {phase === "preparing" && countdownValue === null
                        ? "ホストが準備中..."
                        : "スピン中！"}
                    </p>
                  </>
                ) : (
                  <>
                    <motion.div
                      className="w-3 h-3 rounded-full bg-primary mx-auto mb-3"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <p className="text-base font-bold text-foreground tracking-wide">
                      誰が奢る
                      <motion.span
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      >
                        …？
                      </motion.span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">オーナーの回転を待っています</p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ISSUE-011: SPIN ボタンが押せない理由を状態別に表示 */}
          {isOwner && (phase === "result" || (phase === "waiting" && participants.length < 2)) && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              {phase === "result"
                ? "結果カードを閉じると再スピンできます"
                : "参加者を2人以上追加してください"}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
