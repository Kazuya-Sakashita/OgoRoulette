// Phase state machine: waiting → preparing → spinning → result
// waiting:   初期状態。SPINボタン押下可能。
// preparing: オーナーがAPI呼び出し中 / メンバーが spinStartedAt まで待機中。
// spinning:  ルーレットアニメーション実行中。
// result:    当選者決定。WinnerCard 表示。
export type Phase = "waiting" | "preparing" | "spinning" | "result"

export interface Member {
  id: string
  nickname: string | null
  color: string
  isHost: boolean
  profile: { id: string; name: string | null; displayName: string | null; avatarUrl: string | null } | null
}

export interface SessionWinner {
  name: string
  isWinner: boolean
  color: string
  orderIndex: number
}

export interface Session {
  id: string
  status: string
  startedAt: string | null
  totalAmount: number | null
  treatAmount: number | null
  perPersonAmount: number | null
  participants: SessionWinner[]
  // ISSUE-276: 正式抽選結果の検証トークン（room GET API が計算して付与）
  resultToken?: string
}

export interface Room {
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

export interface WinnerData {
  name: string
  index: number
  totalAmount?: number
  treatAmount?: number
  perPersonAmount?: number
  // ISSUE-276: 結果URL検証用（spin API または room GET から取得）
  sessionId?: string
  resultToken?: string
}
