import { describe, test, expect, vi, beforeEach } from 'vitest'

// WHAT: reset API のトランザクション挙動・認証ガード・エラーパスを検証する
// WHY:  ISSUE-005 修正（$transaction で SPINNING セッションを CANCELLED にする）の回帰テスト

// --- Prisma モック ---

const mockPrisma = {
  room: {
    findUnique: vi.fn(),
    update: vi.fn().mockReturnValue({}),
  },
  roomMember: {
    findFirst: vi.fn(),
  },
  rouletteSession: {
    updateMany: vi.fn().mockReturnValue({}),
  },
  $transaction: vi.fn(),
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

// --- Supabase モック（デフォルト: 未認証ゲスト） ---

const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null } })

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}))

// --- guest-token モック ---

const mockVerifyGuestToken = vi.fn().mockReturnValue(true)

vi.mock('@/lib/guest-token', () => ({
  verifyGuestToken: mockVerifyGuestToken,
  signGuestToken: vi.fn().mockReturnValue('signed-test-token'),
}))

// --- テスト用ヘルパー ---

function makeRequest(opts: { token?: string | null } = {}): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.token !== null) {
    headers['X-Guest-Host-Token'] = opts.token ?? 'valid-host-token'
  }
  return new Request('http://localhost/api/rooms/TEST01/reset', {
    method: 'POST',
    headers,
  })
}

const VALID_ROOM = {
  id: 'room-uuid',
  status: 'IN_SESSION',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h 後（有効）
  ownerId: null,
}

describe('POST /api/rooms/[code]/reset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: null } })
    mockVerifyGuestToken.mockReturnValue(true)

    // デフォルト: ゲストルーム・有効・ホストメンバーあり
    mockPrisma.room.findUnique.mockResolvedValue(VALID_ROOM)
    mockPrisma.roomMember.findFirst.mockResolvedValue({ id: 'host-member-uuid' })
    mockPrisma.$transaction.mockResolvedValue([{}, { count: 1 }])
  })

  // ----------------------------------------------------------------
  // ISSUE-005: $transaction で room + SPINNING セッションを一括更新
  // ----------------------------------------------------------------

  describe('トランザクション実行（ISSUE-005 回帰テスト）', () => {
    test('$transaction が呼ばれ、room.update と rouletteSession.updateMany が渡される', async () => {
      const { POST } = await import('./route')

      await POST(makeRequest(), { params: Promise.resolve({ code: 'TEST01' }) })

      expect(mockPrisma.$transaction).toHaveBeenCalledOnce()
      // 配列形式の $transaction（Promise[]）を呼んでいることを確認
      const txArg = mockPrisma.$transaction.mock.calls[0][0]
      expect(Array.isArray(txArg)).toBe(true)
      expect(txArg).toHaveLength(2)
    })

    test('200 と { status: "WAITING" } を返す', async () => {
      const { POST } = await import('./route')

      const res = await POST(makeRequest(), { params: Promise.resolve({ code: 'TEST01' }) })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.status).toBe('WAITING')
    })
  })

  // ----------------------------------------------------------------
  // ルームが見つからない
  // ----------------------------------------------------------------

  describe('ルーム存在チェック', () => {
    test('存在しないルームは 404 を返す', async () => {
      mockPrisma.room.findUnique.mockResolvedValue(null)
      const { POST } = await import('./route')

      const res = await POST(makeRequest(), { params: Promise.resolve({ code: 'NOTEXIST' }) })

      expect(res.status).toBe(404)
    })
  })

  // ----------------------------------------------------------------
  // 期限切れルーム
  // ----------------------------------------------------------------

  describe('期限切れチェック', () => {
    test('expiresAt が過去のルームは 403 を返す', async () => {
      mockPrisma.room.findUnique.mockResolvedValue({
        ...VALID_ROOM,
        expiresAt: new Date(Date.now() - 1000), // 1 秒前（期限切れ）
      })
      const { POST } = await import('./route')

      const res = await POST(makeRequest(), { params: Promise.resolve({ code: 'TEST01' }) })

      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toContain('期限切れ')
    })

    test('expiresAt=null（常設グループ）は期限切れにならない', async () => {
      mockPrisma.room.findUnique.mockResolvedValue({
        ...VALID_ROOM,
        expiresAt: null,
      })
      const { POST } = await import('./route')

      const res = await POST(makeRequest(), { params: Promise.resolve({ code: 'TEST01' }) })

      expect(res.status).toBe(200)
    })
  })

  // ----------------------------------------------------------------
  // ゲストホスト認証
  // ----------------------------------------------------------------

  describe('ゲストホスト認証', () => {
    test('X-Guest-Host-Token なしは 403 を返す', async () => {
      const { POST } = await import('./route')

      const reqWithoutToken = new Request('http://localhost/api/rooms/TEST01/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await POST(reqWithoutToken, { params: Promise.resolve({ code: 'TEST01' }) })

      expect(res.status).toBe(403)
    })

    test('ホストメンバーが存在しない場合は 403 を返す', async () => {
      mockPrisma.roomMember.findFirst.mockResolvedValue(null)
      const { POST } = await import('./route')

      const res = await POST(makeRequest(), { params: Promise.resolve({ code: 'TEST01' }) })

      expect(res.status).toBe(403)
    })

    test('verifyGuestToken が false を返す場合は 403 を返す', async () => {
      mockVerifyGuestToken.mockReturnValueOnce(false)
      const { POST } = await import('./route')

      const res = await POST(makeRequest(), { params: Promise.resolve({ code: 'TEST01' }) })

      expect(res.status).toBe(403)
    })
  })

  // ----------------------------------------------------------------
  // 認証ユーザーフロー
  // ----------------------------------------------------------------

  describe('認証ユーザーフロー', () => {
    const authUser = { id: 'user-uuid' }

    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: authUser } })
      mockPrisma.room.findUnique.mockResolvedValue({
        ...VALID_ROOM,
        ownerId: 'user-uuid', // 認証ルーム
      })
    })

    test('認証オーナーはリセット成功（200）', async () => {
      mockPrisma.roomMember.findFirst.mockResolvedValue({ id: 'member-uuid' })
      const { POST } = await import('./route')

      const res = await POST(makeRequest(), { params: Promise.resolve({ code: 'TEST01' }) })

      expect(res.status).toBe(200)
    })

    test('オーナーでない認証ユーザーは 403 を返す', async () => {
      mockPrisma.roomMember.findFirst.mockResolvedValue(null) // ホストメンバーなし
      const { POST } = await import('./route')

      const res = await POST(makeRequest(), { params: Promise.resolve({ code: 'TEST01' }) })

      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toContain('オーナーのみ')
    })

    test('認証ルームへの未認証アクセスは 401 を返す', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } }) // 未認証に戻す
      const { POST } = await import('./route')

      const res = await POST(makeRequest(), { params: Promise.resolve({ code: 'TEST01' }) })

      expect(res.status).toBe(401)
    })
  })
})
