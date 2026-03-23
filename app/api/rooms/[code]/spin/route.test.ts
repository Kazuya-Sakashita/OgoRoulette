import { describe, test, expect, vi, beforeEach, type Mock } from 'vitest'
import { verifyGuestToken } from '@/lib/guest-token'

// WHAT: スピン API の安全性と状態遷移を検証する
// WHY:  C-1 修正（participants を DB から取得）の回帰テスト。
//       クライアントが操作した participants を送っても DB メンバーが使われることを保証する。

// --- Prisma モック ---

const mockTx = {
  room: {
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    findUnique: vi.fn().mockResolvedValue(null),
  },
  rouletteSession: {
    create: vi.fn().mockResolvedValue({ id: 'session-uuid' }),
  },
}

const mockPrisma = {
  room: { findUnique: vi.fn() },
  roomMember: { findFirst: vi.fn() },
  profile: {
    upsert: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockReturnValue({ catch: vi.fn() }),
  },
  $transaction: vi.fn().mockImplementation((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

// --- Supabase モック（未認証ゲスト） ---

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  }),
}))

// --- guest-token モック（HMAC 検証をテスト環境でバイパス） ---
vi.mock('@/lib/guest-token', () => ({
  verifyGuestToken: vi.fn().mockReturnValue(true),
  signGuestToken: vi.fn().mockReturnValue('signed-test-token'),
}))

// --- crypto.randomInt を確定値にする ---

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>()
  return {
    ...actual,
    randomInt: vi.fn().mockReturnValue(1), // 常にインデックス 1 を返す
  }
})

// --- テスト用ヘルパー ---

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/rooms/TEST01/spin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Guest-Host-Token': 'host-member-uuid' },
    body: JSON.stringify(body),
  })
}

// DB メンバー 3人のサンプル（id / isHost を含む）
type MockMember = {
  id: string
  isHost: boolean
  nickname: string | null
  color: string
  profileId: string | null
  profile: { id: string; name: string | null } | null
}

const DB_MEMBERS: MockMember[] = [
  { id: 'host-member-uuid', isHost: true,  nickname: 'Alice', color: '#F97316', profileId: null, profile: null },
  { id: 'member-2',         isHost: false, nickname: 'Bob',   color: '#EC4899', profileId: null, profile: null },
  { id: 'member-3',         isHost: false, nickname: 'Carol', color: '#8B5CF6', profileId: null, profile: null },
]

function mockWaitingRoomWithMembers(members: MockMember[] = DB_MEMBERS) {
  mockPrisma.room.findUnique.mockResolvedValue({
    id: 'room-uuid',
    status: 'WAITING',
    ownerId: null,
    members,
  })
}

// --- テスト ---

describe('POST /api/rooms/[code]/spin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTx.room.updateMany.mockResolvedValue({ count: 1 })
    mockTx.room.findUnique.mockResolvedValue(null)
    mockTx.rouletteSession.create.mockResolvedValue({ id: 'session-uuid' })
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)
    )
  })

  // ----------------------------------------------------------------
  // C-1: participants は DB から取得する
  // ----------------------------------------------------------------

  describe('参加者リストは DB から取得する（C-1 修正の回帰テスト）', () => {
    test('body の participants は無視され DB メンバーで当選者が決まる', async () => {
      mockWaitingRoomWithMembers()
      const { POST } = await import('./route')

      // 悪意のあるリクエスト: body には 1 人だけ送り込んでいる
      const req = makeRequest({
        participants: [{ name: 'Fake Winner', index: 0, color: 'red', profileId: null }],
        totalAmount: null,
        treatAmount: null,
      })
      const res = await POST(req, { params: Promise.resolve({ code: 'TEST01' }) })
      const data = await res.json()

      expect(res.status).toBe(200)
      // randomInt が 1 を返すので DB の 2 番目（Bob）が当選
      expect(data.winnerIndex).toBe(1)
      expect(data.winnerName).toBe('Bob')
    })

    test('DB メンバーの name（nickname → profile.name → "ゲスト" の順）が使われる', async () => {
      mockWaitingRoomWithMembers([
        { id: 'host-member-uuid', isHost: true,  nickname: null,          color: '#F97316', profileId: 'p1', profile: { id: 'p1', name: 'ProfileName' } },
        { id: 'member-2',         isHost: false, nickname: 'HasNickname', color: '#EC4899', profileId: null, profile: null },
        { id: 'member-3',         isHost: false, nickname: null,          color: '#8B5CF6', profileId: null, profile: null }, // → "ゲスト"
      ])
      const { POST } = await import('./route')

      // randomInt = 1 → 2 番目（HasNickname）が当選
      const res = await POST(makeRequest({ totalAmount: null, treatAmount: null }), {
        params: Promise.resolve({ code: 'TEST01' }),
      })
      const data = await res.json()
      expect(data.winnerName).toBe('HasNickname')
    })

    test('session.participants は DB メンバー数で作成される', async () => {
      mockWaitingRoomWithMembers() // 3 人
      const { POST } = await import('./route')

      await POST(
        makeRequest({ participants: [], totalAmount: null, treatAmount: null }),
        { params: Promise.resolve({ code: 'TEST01' }) }
      )

      const createCall = mockTx.rouletteSession.create.mock.calls[0][0]
      expect(createCall.data.participants.create).toHaveLength(3)
    })

    test('isWinner フラグは DB メンバーの index に基づく', async () => {
      mockWaitingRoomWithMembers() // randomInt=1 → index 1 が当選
      const { POST } = await import('./route')

      await POST(makeRequest({ totalAmount: null, treatAmount: null }), {
        params: Promise.resolve({ code: 'TEST01' }),
      })

      const participants = mockTx.rouletteSession.create.mock.calls[0][0].data.participants.create
      expect(participants[0].isWinner).toBe(false) // Alice
      expect(participants[1].isWinner).toBe(true)  // Bob（index 1）
      expect(participants[2].isWinner).toBe(false) // Carol
    })
  })

  // ----------------------------------------------------------------
  // 参加者数バリデーション
  // ----------------------------------------------------------------

  describe('参加者数バリデーション', () => {
    test('DB メンバーが 1 人のみの場合は 400 を返す', async () => {
      mockPrisma.room.findUnique.mockResolvedValue({
        id: 'room-uuid', status: 'WAITING', ownerId: null,
        members: [{ id: 'solo-uuid', isHost: true, nickname: 'Solo', color: '#F97316', profileId: null, profile: null }],
      })
      const { POST } = await import('./route')

      const res = await POST(makeRequest({ totalAmount: null, treatAmount: null }), {
        params: Promise.resolve({ code: 'TEST01' }),
      })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('2人以上')
    })

    test('DB メンバーが 0 人の場合は 400 を返す', async () => {
      mockPrisma.room.findUnique.mockResolvedValue({
        id: 'room-uuid', status: 'WAITING', ownerId: null, members: [],
      })
      const { POST } = await import('./route')

      const res = await POST(makeRequest({ totalAmount: null, treatAmount: null }), {
        params: Promise.resolve({ code: 'TEST01' }),
      })
      expect(res.status).toBe(400)
    })
  })

  // ----------------------------------------------------------------
  // ルームステータスのガード
  // ----------------------------------------------------------------

  describe('ルームステータスのガード', () => {
    test('COMPLETED ルームへのスピンは 409 を返す', async () => {
      mockPrisma.room.findUnique.mockResolvedValue({
        id: 'room-uuid', status: 'COMPLETED', ownerId: null, members: DB_MEMBERS,
      })
      const { POST } = await import('./route')

      const res = await POST(makeRequest({ totalAmount: null, treatAmount: null }), {
        params: Promise.resolve({ code: 'TEST01' }),
      })
      expect(res.status).toBe(409)
    })

    test('IN_SESSION ルームへのスピンは 409 を返す（二重スピン防止）', async () => {
      mockPrisma.room.findUnique.mockResolvedValue({
        id: 'room-uuid', status: 'IN_SESSION', ownerId: null, members: DB_MEMBERS,
      })
      const { POST } = await import('./route')

      const res = await POST(makeRequest({ totalAmount: null, treatAmount: null }), {
        params: Promise.resolve({ code: 'TEST01' }),
      })
      expect(res.status).toBe(409)
    })

    test('存在しないルームは 404 を返す', async () => {
      mockPrisma.room.findUnique.mockResolvedValue(null)
      const { POST } = await import('./route')

      const res = await POST(makeRequest({ totalAmount: null, treatAmount: null }), {
        params: Promise.resolve({ code: 'NOTEXIST' }),
      })
      expect(res.status).toBe(404)
    })
  })

  // ----------------------------------------------------------------
  // ゲストホスト認証
  // ----------------------------------------------------------------

  describe('ゲストホスト認証', () => {
    test('X-Guest-Host-Token なしはゲストルームで 403 を返す', async () => {
      mockPrisma.room.findUnique.mockResolvedValue({
        id: 'room-uuid', status: 'WAITING', ownerId: null, members: DB_MEMBERS,
      })
      const { POST } = await import('./route')

      const req = new Request('http://localhost/api/rooms/TEST01/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalAmount: null, treatAmount: null }),
      })
      const res = await POST(req, { params: Promise.resolve({ code: 'TEST01' }) })
      expect(res.status).toBe(403)
    })

    test('無効なトークンはゲストルームで 403 を返す', async () => {
      mockPrisma.room.findUnique.mockResolvedValue({
        id: 'room-uuid', status: 'WAITING', ownerId: null, members: DB_MEMBERS,
      })
      // verifyGuestToken が false を返す = 無効なトークン
      vi.mocked(verifyGuestToken).mockReturnValueOnce(false)
      const { POST } = await import('./route')

      const res = await POST(makeRequest({ totalAmount: null, treatAmount: null }), {
        params: Promise.resolve({ code: 'TEST01' }),
      })
      expect(res.status).toBe(403)
    })
  })

  // ----------------------------------------------------------------
  // 楽観的ロック（$transaction 内の二重スピン防止）
  // ----------------------------------------------------------------

  describe('楽観的ロックによる二重スピン防止', () => {
    test('updateMany count=0 のとき 409 を返す', async () => {
      mockWaitingRoomWithMembers()
      mockTx.room.updateMany.mockResolvedValue({ count: 0 })
      mockTx.room.findUnique.mockResolvedValue({ status: 'IN_SESSION' })

      const { POST } = await import('./route')
      const res = await POST(makeRequest({ totalAmount: null, treatAmount: null }), {
        params: Promise.resolve({ code: 'TEST01' }),
      })
      expect(res.status).toBe(409)
    })
  })

  // ----------------------------------------------------------------
  // 金額計算
  // ----------------------------------------------------------------

  describe('金額計算', () => {
    test('totalAmount が 0 のときセッションに金額は保存されない', async () => {
      mockWaitingRoomWithMembers()
      const { POST } = await import('./route')

      await POST(makeRequest({ totalAmount: 0, treatAmount: 0 }), {
        params: Promise.resolve({ code: 'TEST01' }),
      })

      const createData = mockTx.rouletteSession.create.mock.calls[0][0].data
      expect(createData.totalAmount).toBeNull()
      expect(createData.treatAmount).toBeNull()
      expect(createData.perPersonAmount).toBeNull()
    })

    test('totalAmount が正数のときセッションに金額が保存される', async () => {
      mockWaitingRoomWithMembers() // 3 人
      const { POST } = await import('./route')

      // 3000円・当選者免除 → 非当選者 2 人で ceil(3000/2)=1500
      await POST(makeRequest({ totalAmount: 3000, treatAmount: 0 }), {
        params: Promise.resolve({ code: 'TEST01' }),
      })

      const createData = mockTx.rouletteSession.create.mock.calls[0][0].data
      expect(createData.totalAmount).toBe(3000)
      expect(createData.treatAmount).toBe(0)
      expect(createData.perPersonAmount).toBe(1500)
    })
  })
})
