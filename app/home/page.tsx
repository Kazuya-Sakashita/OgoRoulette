"use client"

import { Button } from "@/components/ui/button"
import { RouletteWheel } from "@/components/roulette-wheel"
import { Confetti } from "@/components/confetti"
import { PrismBurst } from "@/components/prism-burst"
import { WinnerCard } from "@/components/winner-card"
import { RecordingCanvas } from "@/components/recording-canvas"
import { ShareSheet } from "@/components/share-sheet"
import { CountdownOverlay } from "@/components/countdown-overlay"
import { QrCode, Sparkles, Plus, X as XIcon, History, ChevronDown, ChevronUp, Calculator, LogOut, Check, UserCircle, LogIn, Volume2, VolumeX } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { SEGMENT_COLORS } from "@/lib/constants"
import { calculateBillSplit } from "@/lib/bill-calculator"
import { formatCurrency } from "@/lib/format"
import {
  recordTreat,
  getTreatTitle,
  getGroupRanking,
  seedTreatStats,
  clearUserGroupData,
} from "@/lib/group-storage"
import { useGroups } from "@/hooks/use-groups"
import { GroupList } from "@/components/group-list"
import { ProfileSheet } from "@/components/profile-sheet"
import { useVideoRecorder } from "@/lib/use-video-recorder"
import { getDisplayName } from "@/lib/display-name"
import { usePWAInstall } from "@/lib/use-pwa-install"
import { unlockAudioContext, playPressSound, playSpinStartSound, playTickSound, playResultSound, playNearMissSound } from "@/lib/spin-sound"
import { useSoundSetting } from "@/lib/use-sound-setting"
import { vibrate, HapticPattern } from "@/lib/haptic"
import { trackEvent, AnalyticsEvent } from "@/lib/analytics"
import { SaveMembersModal } from "@/components/modals/save-members-modal"

export default function HomePage() {
  const [isSpinning, setIsSpinning] = useState(false)
  // ISSUE-157: Responsive roulette size — larger at desktop (lg: 1024px+)
  const [wheelSize, setWheelSize] = useState(280)
  // ISSUE-161: session spin counter for desktop stats bar
  const [sessionSpinCount, setSessionSpinCount] = useState(0)
  // ISSUE-195: サウンド ON/OFF 設定
  const { soundEnabled, toggle: toggleSound } = useSoundSetting()
  // ISSUE-162: first-visit hint — pulse on SPIN button until first spin
  const [showSpinHint, setShowSpinHint] = useState(false)
  // ISSUE-222: 初回スピン後バナー「ルームを作ってみる」導線
  const [showFirstSpinBanner, setShowFirstSpinBanner] = useState(false)
  // ISSUE-234: ゲスト→ログイン転換モーダル
  const [showSaveMembersModal, setShowSaveMembersModal] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    const update = (e: MediaQueryList | MediaQueryListEvent) => setWheelSize(e.matches ? 360 : 280)
    update(mql)
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  // ISSUE-190: ホーム画面の表示を記録（ファネル計測の起点）
  useEffect(() => {
    trackEvent(AnalyticsEvent.HOME_VIEWED)
  }, [])
  const [participants, setParticipants] = useState(["さくら", "たろう", "はな", "けんた"])
  const [showAddInput, setShowAddInput] = useState(false)
  const [newName, setNewName] = useState("")
  const [winner, setWinner] = useState<{ name: string; index: number } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showPrismBurst, setShowPrismBurst] = useState(false)
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<{ id: string; displayName: string | null; displayNameConfirmedAt: string | null } | null>(null)
  const [showProfileSheet, setShowProfileSheet] = useState(false)
  const router = useRouter()

  const { groups: savedGroups, isLoaded: groupsLoaded, selectedGroupId, selectGroup, saveGroup, updateGroup, deleteGroup, recordGroupSpin } = useGroups(user)
  // ISSUE-101: PWA install prompt — shows "ホーム画面に追加" banner on supported browsers
  const { canInstall, promptInstall } = usePWAInstall()
  const [createRoomLoading, setCreateRoomLoading] = useState(false)
  const [createRoomError, setCreateRoomError] = useState<string | null>(null)
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  // Modal-local participant state — initialized from home participants on open
  const [modalParticipants, setModalParticipants] = useState<string[]>([])
  const [saveGroupSuccess, setSaveGroupSuccess] = useState(false)
  const [modalEditIdx, setModalEditIdx] = useState<number | null>(null)
  const [modalEditName, setModalEditName] = useState("")
  const [showModalAdd, setShowModalAdd] = useState(false)
  const [modalAddName, setModalAddName] = useState("")

  // Winner gamification state (set after spin)
  const [lastTreatCount, setLastTreatCount] = useState<number | undefined>(undefined)
  const [lastTreatTitle, setLastTreatTitle] = useState<string | undefined>(undefined)
  const [lastRanking, setLastRanking] = useState<Array<{ name: string; count: number }> | undefined>(undefined)
  // ISSUE-243: グループ連続当選カウント
  const [lastConsecutiveCount, setLastConsecutiveCount] = useState<number | undefined>(undefined)

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
  const winnerIndexForColor = winner ? winner.index : 0

  // Partial Treat Split state
  const [showBillInput, setShowBillInput] = useState(false)
  const [totalBill, setTotalBill] = useState<number>(0)
  const [treatAmount, setTreatAmount] = useState<number>(0)

  const { remainingAmount, splitAmount, isActive: hasBillInput } = calculateBillSplit(
    totalBill,
    treatAmount,
    participants.length
  )

  useEffect(() => {
    // /home に到達した時点で訪問フラグをセット。
    // Google/LINE のみで使ってきたユーザーはログアウト後 WelcomePage に
    // 閉じ込められる問題を防ぐ（WelcomePage は user || hasVisited で /home へ転送する）。
    localStorage.setItem('ogoroulette_visited', 'true')
    // ISSUE-162: show spin hint to first-time visitors until they spin once
    if (!localStorage.getItem('ogoroulette_spun_once')) {
      setShowSpinHint(true)
    }

    // ISSUE-237: 前回スピン時のメンバー構成を復元（EEM Valley 解消）
    try {
      const saved = localStorage.getItem('ogoroulette_last_members')
      if (saved) {
        const parsed = JSON.parse(saved) as unknown
        if (
          Array.isArray(parsed) &&
          parsed.length >= 2 &&
          parsed.every((m) => typeof m === 'string' && m.trim())
        ) {
          setParticipants(parsed as string[])
        }
      }
    } catch {
      // localStorage 読み取り失敗 — デフォルトのまま
    }

    // Optimistic: show cached profile immediately (zero lag on repeat visits)
    const CACHE_KEY = "ogoroulette_profile_v1"
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      try {
        const p = JSON.parse(cached) as { id: string; displayName: string | null; displayNameConfirmedAt: string | null }
        setProfile({ id: p.id, displayName: p.displayName ?? null, displayNameConfirmedAt: p.displayNameConfirmedAt ?? null })
      } catch {
        localStorage.removeItem(CACHE_KEY)
      }
    }

    const supabase = createClient()
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        // Lightweight endpoint: auth + single Prisma query (no stats)
        const res = await fetch("/api/profile/name")
        if (res.ok) {
          const data = await res.json() as { id: string; displayName: string | null; displayNameConfirmedAt: string | null }
          setProfile({ id: data.id, displayName: data.displayName ?? null, displayNameConfirmedAt: data.displayNameConfirmedAt ?? null })
          localStorage.setItem(CACHE_KEY, JSON.stringify({ id: data.id, displayName: data.displayName ?? null, displayNameConfirmedAt: data.displayNameConfirmedAt ?? null }))
        }
      }
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user)
        const res = await fetch("/api/profile/name")
        if (res.ok) {
          const data = await res.json() as { id: string; displayName: string | null; displayNameConfirmedAt: string | null }
          setProfile({ id: data.id, displayName: data.displayName ?? null, displayNameConfirmedAt: data.displayNameConfirmedAt ?? null })
          localStorage.setItem(CACHE_KEY, JSON.stringify({ id: data.id, displayName: data.displayName ?? null, displayNameConfirmedAt: data.displayNameConfirmedAt ?? null }))
        }
      } else if (event === "SIGNED_OUT") {
        setUser(null)
        setProfile(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ISSUE-195: soundEnabled ガード付き音声再生ヘルパー（各コールバックで使用）
  const playIfEnabled = (fn: () => void) => { if (soundEnabled) fn() }

  // Sessions sync — seed treat stats in LocalStorage from cloud history
  useEffect(() => {
    if (!user) return
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((sessions: Array<{ participants?: Array<{ isWinner: boolean; name: string }>; treatAmount?: number | null }>) => {
        const cloudStats: Record<string, { count: number; totalAmount: number }> = {}
        for (const s of sessions) {
          const winner = s.participants?.find((p) => p.isWinner)
          if (winner?.name) {
            const prev = cloudStats[winner.name] ?? { count: 0, totalAmount: 0 }
            cloudStats[winner.name] = {
              count: prev.count + 1,
              totalAmount: prev.totalAmount + (s.treatAmount ?? 0),
            }
          }
        }
        seedTreatStats(cloudStats)
      })
      .catch((e: unknown) => {
        // セッション同期失敗はUXをブロックしない（ローカル統計で動作継続）
        console.warn("[OgoRoulette] sessions sync failed:", e)
      })
  }, [user])

  useEffect(() => () => clearTimeout(confettiTimerRef.current ?? undefined), [])
  useEffect(() => () => countdownTimersRef.current.forEach(clearTimeout), [])

  // ISSUE-240: グループ読み込み完了時に最後に使ったグループを自動選択
  // ログインユーザーのみ。ISSUE-237 の last_members より保存グループを優先する
  useEffect(() => {
    if (!groupsLoaded || savedGroups.length === 0) return
    try {
      const lastGroupId = localStorage.getItem('ogoroulette_last_group_id')
      if (!lastGroupId) return
      const lastGroup = savedGroups.find((g) => g.id === lastGroupId)
      if (!lastGroup) return
      const members = selectGroup(lastGroup.id)
      setParticipants(members)
    } catch {
      // localStorage unavailable — silently skip
    }
  }, [groupsLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    const supabase = createClient()
    // ユーザー依存の localStorage データをクリアしてから signOut
    clearUserGroupData()
    localStorage.removeItem("ogoroulette_profile_v1")
    await supabase.auth.signOut()
    router.push('/')
  }

  // スピン開始の共通ロジック — participantCount を受け取ることで参加者 state に依存しない
  // 回転開始コールバック（RouletteWheel → onSpinStart）
  const handleSpinStart = () => {
    playIfEnabled(playSpinStartSound)
  }

  // 減速フェーズコールバック（RouletteWheel → onSlowingDown）
  const handleSlowingDown = () => {
    if (!soundEnabled) return
    const delays = [0, 500, 950]
    delays.forEach((d) => {
      setTimeout(() => playTickSound(), d)
    })
  }

  // ニアミス演出コールバック（RouletteWheel → onNearMiss）
  const handleNearMiss = () => {
    playIfEnabled(playNearMissSound)
  }

  const startSpin = (participantCount: number) => {
    if (isSpinning || participantCount < 2 || countdown !== null) return
    setWinner(null)
    resetRecording()
    setRecordingPhase("countdown")
    setCountdown(3)
    countdownTimersRef.current.forEach(clearTimeout)
    countdownTimersRef.current = [
      setTimeout(() => setCountdown(2), 1000),
      setTimeout(() => setCountdown(1), 2000),
      setTimeout(() => {
        setCountdown(null)
        setIsSpinning(true)
        startRecording()
      }, 3000),
    ]
  }

  const handleSpin = () => {
    unlockAudioContext() // iOS: ユーザータップで AudioContext を unlock
    playIfEnabled(playPressSound)
    startSpin(participants.length)
  }

  // グループカードの「▶ 回す」ボタン — 1タップでそのグループのメンバーをセットしてスピン開始
  const handleSpinWithGroup = (id: string) => {
    unlockAudioContext()
    playIfEnabled(playPressSound)
    trackEvent(AnalyticsEvent.GROUP_SELECTED)
    const members = selectGroup(id)
    setParticipants(members)
    startSpin(members.length)
    // ISSUE-240: 最後にスピンしたグループを記録
    try { localStorage.setItem('ogoroulette_last_group_id', id) } catch {}
  }

  // ISSUE-023: グループからルームを作成 — ログインユーザー専用
  // グループのメンバー名をプリセットとしてルームを作成し、QRコードロビーへ遷移
  const handleCreateRoomWithGroup = async (id: string) => {
    if (!user || createRoomLoading) return
    const group = savedGroups.find((g) => g.id === id)
    if (!group) return

    setCreateRoomLoading(true)
    setCreateRoomError(null)

    try {
      const ownerName = profile ? getDisplayName(profile) : ""
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: group.name,
          maxMembers: Math.max(10, group.participants.length + 2),
          presetMemberNames: group.participants.filter((n) => n !== ownerName),
        }),
      })
      const data = await res.json()
      if (res.ok && data.inviteCode) {
        router.push(`/room/${data.inviteCode}`)
        // navigation/unmount が loading をクリアするため setCreateRoomLoading(false) 不要
      } else {
        setCreateRoomError(data.error ?? "ルームの作成に失敗しました。もう一度お試しください。")
        setCreateRoomLoading(false)
      }
    } catch {
      setCreateRoomError("ルームの作成に失敗しました。もう一度お試しください。")
      setCreateRoomLoading(false)
    }
  }

  const handleSpinComplete = (winnerName: string, winnerIndex: number) => {
    setIsSpinning(false)
    // ISSUE-161: increment session spin counter
    const nextSpinCount = sessionSpinCount + 1
    setSessionSpinCount(nextSpinCount)
    // ISSUE-238: NSM 計測 — スピン回数/セッション
    trackEvent(AnalyticsEvent.HOME_SPIN_COMPLETE, {
      session_spin_count: nextSpinCount,
      participants_count: participants.length,
    })
    // ISSUE-162: dismiss hint after first spin
    // ISSUE-222: 初回スピン後バナーを表示
    if (showSpinHint) {
      setShowSpinHint(false)
      localStorage.setItem('ogoroulette_spun_once', 'true')
      setShowFirstSpinBanner(true)
    }
    // ISSUE-155: 300ms silence after wheel stops — creates anticipation before reveal
    setTimeout(() => {
      playIfEnabled(playResultSound)
      vibrate(HapticPattern.result)
      setWinner({ name: winnerName, index: winnerIndex })
      // ISSUE-236: PrismBurst は WinnerCard 出現と同時に発火（暗転→フラッシュ演出）
      setShowPrismBurst(true)
      setTimeout(() => setShowPrismBurst(false), 1800)
      // ISSUE-236: Confetti は名前 spring アニメーション完了後（+700ms）に発火
      setTimeout(() => {
        setShowConfetti(true)
        clearTimeout(confettiTimerRef.current ?? undefined)
        confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 4000)
      }, 700)

      // ISSUE-234: 2回目のスピン完了後（ゲストのみ）、1.5秒後にメンバー保存モーダル表示
      if (!user && nextSpinCount >= 2) {
        try {
          if (!sessionStorage.getItem('ogoroulette_save_modal_dismissed')) {
            setTimeout(() => {
              setShowSaveMembersModal(true)
              // ISSUE-238: ゲスト転換率の分母を計測
              trackEvent(AnalyticsEvent.GUEST_CONVERSION_MODAL_SHOWN)
            }, 1500)
          }
        } catch {
          // sessionStorage unavailable — silently skip
        }
      }

      // ISSUE-182/198: グループが選択されていた場合、スピン結果をグループに記録（履歴・リテンション用）
      // ISSUE-243: consecutiveCount を受け取ってWinnerCardに渡す
      if (selectedGroupId) {
        const { consecutiveCount } = recordGroupSpin(selectedGroupId, winnerName, participants)
        setLastConsecutiveCount(consecutiveCount >= 2 ? consecutiveCount : undefined)
      } else {
        setLastConsecutiveCount(undefined)
      }

      // Record treat in LocalStorage and compute gamification data
      const amount = hasBillInput ? treatAmount : 0
      const newCount = recordTreat(winnerName, amount)
      setLastTreatCount(newCount)
      setLastTreatTitle(getTreatTitle(newCount))
      setLastRanking(getGroupRanking(participants).map(r => ({ name: r.name, count: r.count })))

      // Trigger reveal phase in recording canvas, then stop recording 2.5s later
      stopRecordingAfterReveal()

      // ISSUE-237: 現在のメンバー構成を保存（次回起動時に即復元）
      try {
        localStorage.setItem('ogoroulette_last_members', JSON.stringify(participants))
      } catch {
        // localStorage unavailable — silently skip
      }

      // ISSUE-163: save to localStorage for guest local history
      try {
        const LOCAL_HISTORY_KEY = 'ogoroulette_local_history'
        const prev = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]') as Array<{
          winner: string; participants: string[]; totalBill: number | null; treatAmount: number | null; createdAt: string
        }>
        prev.unshift({
          winner: winnerName,
          participants: [...participants],
          totalBill: hasBillInput ? totalBill : null,
          treatAmount: hasBillInput ? treatAmount : null,
          createdAt: new Date().toISOString(),
        })
        localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(prev.slice(0, 20)))
      } catch {
        // localStorage unavailable — silently skip
      }

      // Save session to DB (fire-and-forget — don't block the UX)
      if (user) {
        fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            totalAmount: hasBillInput ? totalBill : null,
            treatAmount: hasBillInput ? treatAmount : null,
            perPersonAmount: hasBillInput ? splitAmount : null,
            winnerName,
            winnerIndex,
            participants: participants.map((name, index) => ({
              name,
              color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
              index,
            })),
          }),
        }).catch(() => {
          // Silently ignore — session save failure must not interrupt the spin experience
        })
      }
    }, 300)
  }

  const closeWinnerCard = () => {
    setWinner(null)
    setLastTreatCount(undefined)
    setLastTreatTitle(undefined)
    setLastRanking(undefined)
    setLastConsecutiveCount(undefined)
    resetRecording()
  }

  // ISSUE-234: メンバー保存モーダルを閉じる — 同セッション内は再表示しない
  const dismissSaveMembersModal = () => {
    setShowSaveMembersModal(false)
    try {
      sessionStorage.setItem('ogoroulette_save_modal_dismissed', '1')
    } catch {
      // sessionStorage unavailable — silently skip
    }
  }

  // ISSUE-196: 再スピン — WinnerCard を閉じて同メンバーで即スピン
  // ISSUE-206: 二重タップ防止 ref
  const isRespinningRef = useRef(false)
  const handleRespin = () => {
    if (isRespinningRef.current) return
    isRespinningRef.current = true
    setTimeout(() => { isRespinningRef.current = false }, 500)
    setWinner(null)
    setLastTreatCount(undefined)
    setLastTreatTitle(undefined)
    setLastRanking(undefined)
    resetRecording()
    startSpin(participants.length)
  }

  const addParticipant = () => {
    if (newName.trim() && participants.length < 8) {
      setParticipants([...participants, newName.trim()])
      setNewName("")
      setShowAddInput(false)
    }
  }

  const handleSelectGroup = (id: string) => {
    const members = selectGroup(id)
    setParticipants(members)
    // ISSUE-240: 最後に選択したグループを記録
    try { localStorage.setItem('ogoroulette_last_group_id', id) } catch {}
  }

  const isCurrentGroupSaved = savedGroups.some(
    (g) =>
      g.participants.length === participants.length &&
      [...g.participants].sort().join() === [...participants].sort().join()
  )

  const openSaveInput = () => {
    setModalParticipants([...participants])
    setShowSaveInput(true)
  }

  const closeSaveInput = () => {
    setShowSaveInput(false)
    setNewGroupName("")
    setSaveGroupSuccess(false)
    setModalParticipants([])
    setModalEditIdx(null)
    setShowModalAdd(false)
    setModalAddName("")
  }

  const handleSaveGroup = async (name: string) => {
    const members = modalParticipants.filter((p) => p.trim())
    if (members.length < 2) return
    await saveGroup(name, members)
    trackEvent(AnalyticsEvent.GROUP_SAVED)
    setSaveGroupSuccess(true)
    setTimeout(closeSaveInput, 1500)
  }

  // ISSUE-151: WinnerCard inline save — uses current participants (not modal state)
  const handleSaveGroupFromWinner = async (name: string) => {
    const members = participants.filter((p) => p.trim())
    if (members.length < 2) return
    await saveGroup(name, members)
    trackEvent(AnalyticsEvent.GROUP_SAVED)
  }

  const removeParticipant = (index: number) => {
    // ISSUE-203: カウントダウン中・スピン中は削除不可（勝者インデックスズレ防止）
    if (isSpinning || countdown !== null) return
    if (participants.length > 2) {
      setParticipants(participants.filter((_, i) => i !== index))
    }
  }

  // Quick amount presets
  const quickAmounts = [5000, 10000, 15000, 20000]

  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      {/* ISSUE-164: aria-live region — announces winner to screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {winner ? `${winner.name}さんが奢りに決定しました` : ''}
      </div>

      {/* Hidden recording canvas — off-screen, captured by MediaRecorder */}
      <RecordingCanvas
        phase={recordingPhase}
        countdown={countdown}
        wheelRotationRef={wheelRotationRef}
        participants={participants}
        winnerIndex={winner?.index ?? null}
        winner={winner?.name ?? null}
        winnerColor={SEGMENT_COLORS[winnerIndexForColor % SEGMENT_COLORS.length]}
        canvasRef={recordingCanvasRef}
      />

      {/* Countdown overlay — shown before spin starts */}
      <CountdownOverlay countdown={countdown} participants={participants} />

      {/* Prism burst — rainbow ring explosion at winner reveal moment */}
      <PrismBurst
        active={showPrismBurst}
        winnerColor={winner ? SEGMENT_COLORS[winner.index % SEGMENT_COLORS.length] : undefined}
      />

      {/* Confetti effect — ISSUE-197: 3回戦以降は intense モード */}
      <Confetti
        active={showConfetti}
        intense={sessionSpinCount >= 3}
        winnerColor={winner ? SEGMENT_COLORS[winner.index % SEGMENT_COLORS.length] : undefined}
      />

      {/* REC indicator — visible only when MediaRecorder is actually running (ISSUE-103: hidden on iOS) */}
      {isRecording && (
        <div className="fixed top-4 right-4 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/90 text-white text-xs font-bold animate-pulse pointer-events-none">
          ● REC
        </div>
      )}

      {/* Winner Card Modal with payment breakdown */}
      {winner && (
        <WinnerCard
          winner={winner.name}
          winnerIndex={winner.index}
          onClose={closeWinnerCard}
          totalBill={hasBillInput ? totalBill : undefined}
          treatAmount={hasBillInput ? treatAmount : undefined}
          splitAmount={hasBillInput ? splitAmount : undefined}
          participants={participants}
          treatCount={lastTreatCount}
          treatTitle={lastTreatTitle}
          ranking={lastRanking}
          consecutiveCount={lastConsecutiveCount}
          videoBlob={recordedBlob}
          onShareVideo={() => setShowShareSheet(true)}
          onSaveGroup={isCurrentGroupSaved ? undefined : handleSaveGroupFromWinner}
          isGuest={!user}
          onRespin={handleRespin}
          sessionSpinCount={sessionSpinCount}
        />
      )}

      {/* ISSUE-234: ゲスト→ログイン転換モーダル — 2回目スピン後1.5秒で出現 */}
      {showSaveMembersModal && (
        <SaveMembersModal onDismiss={dismissSaveMembersModal} />
      )}

      {/* Share sheet — appears when recording is ready */}
      {showShareSheet && recordedBlob && winner && (
        <ShareSheet
          blob={recordedBlob}
          winner={winner.name}
          winnerColor={SEGMENT_COLORS[winner.index % SEGMENT_COLORS.length]}
          profile={profile}
          onProfileConfirmed={(confirmedAt) =>
            setProfile((p) => p ? { ...p, displayNameConfirmedAt: confirmedAt } : p)
          }
          onClose={() => {
            setShowShareSheet(false)
          }}
          onRespin={closeWinnerCard}
        />
      )}

      {/* ISSUE-079: プロフィール編集シート */}
      {showProfileSheet && user && (
        <ProfileSheet
          profile={profile ?? { id: user.id, displayName: null }}
          onClose={() => setShowProfileSheet(false)}
          onSaved={(newDisplayName) =>
            setProfile((p) => p ? { ...p, displayName: newDisplayName } : { id: user.id, displayName: newDisplayName, displayNameConfirmedAt: null })
          }
        />
      )}

      {/* グループ登録モーダル — GroupList の「新しいグループを登録」から開く */}
      {showSaveInput && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={saveGroupSuccess ? undefined : closeSaveInput}
          />
          {/* Bottom sheet */}
          <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-8 pt-4 rounded-t-3xl bg-[#0F2236] border-t border-white/10 shadow-2xl">
            {/* Drag handle */}
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Success state */}
            {saveGroupSuccess ? (
              <div className="flex flex-col items-center py-6 gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check className="w-6 h-6 text-primary" />
                </div>
                <p className="text-base font-semibold text-foreground">登録しました</p>
                <p className="text-sm text-muted-foreground">「{newGroupName}」をいつものメンバーに追加しました</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-foreground">いつものメンバーを登録</h3>
                  <button
                    onClick={closeSaveInput}
                    className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Editable participant chips */}
                <p className="text-xs text-muted-foreground mb-2">
                  メンバー（タップして名前を変更できます）
                </p>
                <div className="flex flex-wrap gap-2 mb-5">
                  {modalParticipants.map((name, idx) =>
                    modalEditIdx === idx ? (
                      <input
                        key={idx}
                        value={modalEditName}
                        onChange={(e) => setModalEditName(e.target.value)}
                        onBlur={() => {
                          if (modalEditName.trim()) {
                            const updated = [...modalParticipants]
                            updated[idx] = modalEditName.trim()
                            setModalParticipants(updated)
                          }
                          setModalEditIdx(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur()
                          if (e.key === "Escape") setModalEditIdx(null)
                        }}
                        maxLength={10}
                        autoFocus
                        className="w-24 h-8 px-3 rounded-full bg-primary/20 border border-primary/50 text-foreground text-sm focus:outline-none"
                      />
                    ) : (
                      <button
                        key={idx}
                        onClick={() => { setModalEditIdx(idx); setModalEditName(name) }}
                        className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 hover:border-primary/40 transition-all"
                      >
                        <span className="text-sm text-foreground">{name}</span>
                        {modalParticipants.length > 2 && (
                          <span
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setModalParticipants(modalParticipants.filter((_, i) => i !== idx))
                            }}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <XIcon className="w-3 h-3" />
                          </span>
                        )}
                      </button>
                    )
                  )}
                  {modalParticipants.length < 8 && (
                    showModalAdd ? (
                      <input
                        value={modalAddName}
                        onChange={(e) => setModalAddName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && modalAddName.trim()) {
                            setModalParticipants([...modalParticipants, modalAddName.trim()])
                            setModalAddName("")
                            setShowModalAdd(false)
                          }
                          if (e.key === "Escape") { setShowModalAdd(false); setModalAddName("") }
                        }}
                        onBlur={() => { setShowModalAdd(false); setModalAddName("") }}
                        maxLength={10}
                        autoFocus
                        placeholder="名前"
                        className="w-24 h-8 px-3 rounded-full bg-white/10 border border-white/30 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => setShowModalAdd(true)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-white/20 text-muted-foreground hover:text-foreground hover:border-white/40 transition-all text-sm"
                      >
                        <Plus className="w-3 h-3" />
                        追加
                      </button>
                    )
                  )}
                </div>

                {/* Group name input + register */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newGroupName.trim()) handleSaveGroup(newGroupName.trim())
                      if (e.key === "Escape") closeSaveInput()
                    }}
                    placeholder="グループ名（例: 飲み会メンバー）"
                    maxLength={20}
                    className="flex-1 h-12 px-4 rounded-xl bg-white/10 border border-white/20 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                  <Button
                    onClick={() => newGroupName.trim() && handleSaveGroup(newGroupName.trim())}
                    disabled={!newGroupName.trim() || modalParticipants.filter((p) => p.trim()).length < 2}
                    className="h-12 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm disabled:opacity-40"
                  >
                    登録
                  </Button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Container: mobile 390px / desktop max-w-4xl with 2-column layout */}
      <div className="mx-auto max-w-[390px] lg:max-w-4xl min-h-screen flex flex-col px-5 py-6">

        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Image
              src="/images/logo-icon.png"
              alt="OgoRoulette"
              width={36}
              height={36}
              className="w-9 h-9"
              priority
            />
            <span className="text-lg font-bold tracking-tight">
              <span className="text-foreground">Ogo</span>
              <span className="text-gradient">Roulette</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* ISSUE-195: サウンドトグル */}
            <Button
              onClick={toggleSound}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              aria-label={soundEnabled ? "サウンドをオフにする" : "サウンドをオンにする"}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </Button>
            {user && (
              <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Link href="/history">
                  <History className="w-5 h-5" />
                </Link>
              </Button>
            )}
            {user && (
              <Button
                onClick={() => setShowProfileSheet(true)}
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                title="プロフィール編集"
              >
                <UserCircle className="w-5 h-5" />
              </Button>
            )}
            {user ? (
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            ) : (
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm">
                <Link href="/auth/login">
                  ログイン
                </Link>
              </Button>
            )}
          </div>
        </header>

        {/* User greeting if logged in */}
        {/* ISSUE-088: provider由来名（full_name/email）は本名が含まれるため使用禁止。getDisplayName() のみ使う */}
        {user && (
          <div className="mb-2 px-4 py-3 rounded-2xl glass-card border border-white/10">
            {/* ISSUE-138: プロフィール取得中はskeletonを表示してフリッカーを防ぐ */}
            {user && !profile ? (
              <div className="animate-pulse flex items-center gap-2">
                <div className="w-28 h-4 rounded bg-white/10" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {profile
                  ? <>こんにちは、<span className="text-foreground font-medium">{getDisplayName(profile)}</span> さん 👋</>
                  : "今日もルーレット回しますか？"}
              </p>
            )}
          </div>
        )}

        {/* Tagline */}
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight mb-1">
            今日の<span className="text-gradient">奢り</span>は誰だ？
          </h1>
          <p className="text-muted-foreground text-sm">
            楽しく、平和に、運命で決めよう。
          </p>
        </div>

        {/* Social Proof Chips */}
        <div className="flex flex-wrap justify-center gap-2 mb-2">
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20">
            飲み会で盛り上がる
          </span>
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-accent/10 text-accent border border-accent/20">
            すぐ使える
          </span>
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20">
            みんなで参加
          </span>
        </div>

        {/* ISSUE-023: ルーム作成中 / エラー通知 */}
        {createRoomLoading && (
          <div className="mb-3 px-4 py-2.5 rounded-2xl border border-white/10 bg-white/5 text-sm text-muted-foreground text-center">
            ルームを作成中...
          </div>
        )}
        {createRoomError && !createRoomLoading && (
          <div className="mb-3 px-4 py-3 rounded-2xl border border-destructive/40 bg-destructive/10 text-sm text-destructive flex items-center justify-between gap-2">
            <span>{createRoomError}</span>
            <button
              onClick={() => setCreateRoomError(null)}
              className="shrink-0 text-destructive/60 hover:text-destructive"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Desktop 2-column grid: GroupA(右上) / GroupB(左ルーレット) / GroupC(右下) */}
        <div className="flex-1 flex flex-col lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">

        {/* Group A: グループ選択・金額設定 — desktop: right column top */}
        <div className="lg:col-start-2 lg:row-start-1">

        {/* ISSUE-182: リテンション再開CTA — 最後にスピンしたグループを再開 */}
        {groupsLoaded && (() => {
          const activeGroup = savedGroups.find((g) => g.lastSpinAt)
          if (!activeGroup) return null
          const daysDiff = Math.floor((Date.now() - (activeGroup.lastSpinAt ?? 0)) / 86_400_000)
          const when = daysDiff === 0 ? "今日" : daysDiff === 1 ? "昨日" : `${daysDiff}日前`
          return (
            <div className="mb-4 p-4 rounded-2xl glass-card border border-primary/30 bg-primary/5">
              <p className="text-xs font-semibold text-primary mb-2">🎰 またこのメンバーで？</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{activeGroup.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {activeGroup.participants.join(" · ")}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    {when}{activeGroup.lastWinner && <> · 前回の奢り: <span className="text-foreground/70">{activeGroup.lastWinner}</span></>}
                  </p>
                </div>
                <button
                  onClick={() => {
                    trackEvent(AnalyticsEvent.REENGAGEMENT_CTA_CLICKED, { group_id: activeGroup.id })
                    handleSpinWithGroup(activeGroup.id)
                  }}
                  className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-accent hover:opacity-90 active:scale-95 transition-all"
                >
                  回す
                </button>
              </div>
            </div>
          )
        })()}

        {/* いつものメンバー — shown above roulette for 1-tap access */}
        <GroupList
          groups={savedGroups}
          loading={!groupsLoaded}
          selectedGroupId={selectedGroupId}
          onSelect={handleSelectGroup}
          onSpin={handleSpinWithGroup}
          onCreateRoom={user ? handleCreateRoomWithGroup : undefined}
          onUpdate={updateGroup}
          onDelete={deleteGroup}
          onNew={openSaveInput}
        />

        {/* Partial Treat Split Input */}
        <section className="mb-4">
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
            {showBillInput ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          {showBillInput && (
            <div className="mt-3 p-4 rounded-2xl glass-card border border-white/10 space-y-4">
              {/* Total Bill Input */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  合計金額
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">¥</span>
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

              {/* Treat Amount Input */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  奢り金額（勝者が払う）
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">¥</span>
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

                {/* Quick amount buttons */}
                <div className="flex gap-2 mt-3">
                  {quickAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => {
                        const newTreat = Math.min(amount, totalBill || amount)
                        setTreatAmount(newTreat)
                        if (!totalBill) setTotalBill(amount)
                      }}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                        treatAmount === amount
                          ? 'bg-gradient-accent text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:text-foreground border border-white/10'
                      }`}
                    >
                      ¥{amount.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Calculation Preview */}
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
                    <div className="flex justify-between">
                      <span className="opacity-80">残り</span>
                      <span className="font-semibold">{formatCurrency(remainingAmount)}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="font-medium">1人あたり（÷{participants.length - 1}人）</span>
                      <span className="text-lg font-bold">{formatCurrency(splitAmount)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        </div>{/* /Group A */}

        {/* Group B: ルーレット — desktop: left column, sticky */}
        <div className="flex-1 flex flex-col items-center justify-center py-2 lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6 lg:py-8">

        {/* Roulette Wheel - Centerpiece (ISSUE-063: ホイール全体タップ可能) */}
          <div
            className="relative mb-2"
            onClick={!isSpinning && participants.length >= 2 && countdown === null ? handleSpin : undefined}
            style={{ cursor: !isSpinning && participants.length >= 2 && countdown === null ? "pointer" : "default" }}
            aria-label={!isSpinning && participants.length >= 2 ? "ルーレットを回す" : undefined}
            role={!isSpinning && participants.length >= 2 ? "button" : undefined}
          >
            {/* Ambient background glow */}
            <div className="absolute inset-0 scale-[1.6] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

            <RouletteWheel
              isSpinning={isSpinning}
              size={wheelSize}
              participants={participants}
              onSpinComplete={handleSpinComplete}
              onSpinStart={handleSpinStart}
              onSlowingDown={handleSlowingDown}
              onNearMiss={handleNearMiss}
              wheelRotationRef={wheelRotationRef}
            />
          </div>

          {/* Visual connector: wheel → button */}
          <div className="flex flex-col items-center gap-1 mb-1">
            <div className="w-px h-3 bg-white/20 rounded-full" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
          </div>

          {/* ISSUE-162: first-visit hint tooltip */}
          {showSpinHint && !isSpinning && (
            <div className="mb-2 px-3 py-1.5 rounded-xl bg-primary/20 border border-primary/40 text-xs text-primary font-medium animate-bounce pointer-events-none">
              ↓ タップして回してみよう！
            </div>
          )}

          {/* SPIN Button */}
          <Button
            onClick={handleSpin}
            disabled={isSpinning || participants.length < 2 || countdown !== null}
            aria-busy={isSpinning}
            aria-label={isSpinning ? 'ルーレット回転中' : participants.length < 2 ? '参加者を2人以上追加してください' : 'ルーレットを回す'}
            className={`w-full max-w-[280px] h-16 text-xl font-bold rounded-2xl bg-gradient-accent hover:opacity-90 text-white shadow-lg glow-primary press-effect disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase tracking-wider animate-pulse-glow ${showSpinHint ? 'ring-4 ring-primary/50 ring-offset-2 ring-offset-background' : ''}`}
          >
            {isSpinning ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                回転中...
              </span>
            ) : (
              "SPIN"
            )}
          </Button>
          {/* ISSUE-161: Desktop stats bar — visible only at lg+ */}
          {/* ISSUE-222: 初回スピン後バナー — WinnerCard が閉じた後に表示 */}
          {showFirstSpinBanner && !winner && (
            <div className="relative mt-4 p-4 rounded-2xl bg-primary/10 border border-primary/20 text-center w-full max-w-[280px]">
              <button
                onClick={() => setShowFirstSpinBanner(false)}
                className="absolute top-2 right-2 text-muted-foreground/50 hover:text-muted-foreground text-lg leading-none"
                aria-label="閉じる"
              >
                ×
              </button>
              <p className="text-sm font-semibold text-foreground mb-1">友達と一緒に使うともっと楽しい！</p>
              <p className="text-xs text-muted-foreground mb-3">QRコードで招待して全員で回そう</p>
              <Link
                href="/room/create"
                className="inline-block px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(to right, #F97316, #EC4899)' }}
              >
                ルームを作る →
              </Link>
            </div>
          )}

          {sessionSpinCount > 0 && (
            <div className="hidden lg:flex items-center gap-4 mt-4 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-muted-foreground">
              <span>👥 {participants.length}人</span>
              <div className="w-px h-3 bg-white/20" />
              <span>🎰 このセッション {sessionSpinCount}回</span>
              {hasBillInput && (
                <>
                  <div className="w-px h-3 bg-white/20" />
                  <span>💴 {formatCurrency(totalBill)}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Group C: 参加者・アクション — desktop: right column bottom */}
        <div className="lg:col-start-2 lg:row-start-2">

        {/* Participants Section */}
        <section className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              参加者
            </h2>
            <span className="text-xs text-muted-foreground">
              {participants.length}/8人
            </span>
          </div>

          {/* Participant list */}
          <div className="flex flex-wrap gap-2 mb-3">
            {participants.map((name, index) => (
              <div
                key={index}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-full glass-card border border-white/10 transition-all hover:border-primary/30"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground"
                  style={{
                    background: `linear-gradient(135deg, ${['#F59E0B', '#F43F5E', '#8B5CF6', '#3B82F6', '#22C55E', '#FBBF24'][index % 6]}, ${['#FBBF24', '#FB7185', '#A78BFA', '#60A5FA', '#4ADE80', '#FCD34D'][index % 6]})`
                  }}
                >
                  {name.charAt(0)}
                </div>
                <span className="text-sm font-medium text-foreground">{name}</span>
                {participants.length > 2 && (
                  <button
                    onClick={() => removeParticipant(index)}
                    disabled={isSpinning || countdown !== null}
                    aria-label={`${name}を削除`}
                    className="opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 w-5 h-5 rounded-full bg-destructive/20 flex items-center justify-center text-destructive hover:bg-destructive/30 transition-all disabled:opacity-0 disabled:pointer-events-none"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add participant */}
          {showAddInput ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
                placeholder="名前を入力"
                maxLength={10}
                className="flex-1 h-10 px-4 rounded-xl bg-secondary border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                autoFocus
              />
              <Button
                onClick={addParticipant}
                disabled={!newName.trim()}
                className="h-10 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm"
              >
                追加
              </Button>
              <Button
                onClick={() => { setShowAddInput(false); setNewName(""); }}
                variant="ghost"
                className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground"
              >
                <XIcon className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setShowAddInput(true)}
              disabled={participants.length >= 8}
              variant="outline"
              className="w-full h-10 rounded-xl border-dashed border-white/20 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all text-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              プレイヤーを追加
            </Button>
          )}

        </section>

        {/* Bottom Actions */}
        <section className="mt-6 space-y-3">
          <Button
            asChild
            className="w-full h-14 rounded-2xl bg-gradient-accent hover:opacity-90 text-primary-foreground font-bold press-effect text-base"
          >
            <Link href="/room/create">
              <Sparkles className="w-5 h-5 mr-2" />
              ルームを作成
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full h-12 rounded-xl border-white/10 bg-secondary hover:bg-white/10 text-foreground font-semibold press-effect text-sm"
          >
            <Link href="/scan">
              <QrCode className="w-4 h-4 mr-2" />
              QRで参加
            </Link>
          </Button>
        </section>

        {/* Non-logged-in CTA */}
        {!user && (
          <section className="mt-4 px-4 py-3 rounded-2xl border border-white/8 bg-white/3 flex items-center gap-3">
            <UserCircle className="w-8 h-8 text-primary/70 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">ログインでさらに便利に</p>
              <p className="text-xs text-muted-foreground">メンバー保存・履歴・公開名が使えます</p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 h-8 rounded-lg border-white/15 bg-transparent text-xs font-semibold">
              <Link href="/auth/login">
                <LogIn className="w-3 h-3 mr-1" />
                ログイン
              </Link>
            </Button>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-6 pt-4 border-t border-white/5">
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">プライバシー</Link>
            <span>・</span>
            <Link href="/terms" className="hover:text-foreground transition-colors">利用規約</Link>
            <span>・</span>
            <Link href="/how-to-use" className="hover:text-foreground transition-colors">使い方</Link>
            <span>・</span>
            <Link href="/help" className="hover:text-foreground transition-colors">ヘルプ</Link>
          </div>
          <p className="text-center text-xs text-muted-foreground/60 mt-2">
            © 2026 OgoRoulette
          </p>
        </footer>
        </div>{/* /Group C */}
        </div>{/* /layout grid */}
      </div>

      {/* ISSUE-101: PWA install prompt — subtle fixed banner at the bottom */}
      {canInstall && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-secondary border border-white/10 shadow-xl text-sm">
          <span className="text-foreground font-medium">📱 ホーム画面に追加</span>
          <button
            onClick={promptInstall}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-primary-foreground"
            style={{ background: 'linear-gradient(to right, #F97316, #EC4899)' }}
          >
            追加する
          </button>
        </div>
      )}
    </main>
  )
}
