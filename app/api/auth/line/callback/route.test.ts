import { describe, test, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// WHAT: LINE コールバックルートの Supabase ユーザー upsert ロジックを検証する
// WHY:  ISSUE-038 — Prisma profile を存在確認に使っていたため、
//       前回ログインが途中で失敗すると次回ログイン時に "already registered" で
//       /auth/error へリダイレクトされるバグがあった。
//       楽観的 create → already-exists フォールバックの実装を回帰テストで保護する。

// --- Prisma モック ---

const mockPrisma = {
  profile: {
    upsert: vi.fn().mockResolvedValue({}),
  },
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

// --- Supabase Admin モック ---

const mockCreateUser = vi.fn()
const mockGenerateLink = vi.fn()
const mockUpdateUserById = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        generateLink: mockGenerateLink,
        updateUserById: mockUpdateUserById,
      },
    },
  })),
}))

// --- Supabase SSR (createServerClient) モック ---

const mockVerifyOtp = vi.fn().mockResolvedValue({ error: null })

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      verifyOtp: mockVerifyOtp,
    },
  })),
}))

// --- LINE API モック ---

const LINE_PROFILE = {
  userId: 'U12345678',
  displayName: 'テストユーザー',
  pictureUrl: 'https://profile.line-sc.com/test.jpg',
}

const LINE_TOKEN = { access_token: 'test-token' }

const LINK_DATA_NEW = {
  user: { id: 'new-supabase-uuid' },
  properties: { hashed_token: 'hashed-token-new' },
}

const LINK_DATA_EXISTING = {
  user: { id: 'existing-supabase-uuid' },
  properties: { hashed_token: 'hashed-token-existing' },
}

// --- テスト用ヘルパー ---

function makeRequest(overrides: { state?: string } = {}) {
  const state = overrides.state ?? 'test-state-value'
  const url = `http://localhost/api/auth/line/callback?code=auth-code&state=${state}`
  // NextRequest を使用: .cookies プロパティが Cookie ヘッダーを自動でパースする
  const req = new NextRequest(url, {
    method: 'GET',
    headers: { Cookie: `line_oauth_state=${state}` },
  })
  return req
}

// LINE API をモックする（fetch をオーバーライド）
function mockLineApi() {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (url === 'https://api.line.me/oauth2/v2.1/token') {
      return Promise.resolve(new Response(JSON.stringify(LINE_TOKEN), { status: 200 }))
    }
    if (url === 'https://api.line.me/v2/profile') {
      return Promise.resolve(new Response(JSON.stringify(LINE_PROFILE), { status: 200 }))
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`))
  }))
}

// --- テスト ---

describe('GET /api/auth/line/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLineApi()
    // デフォルト: verifyOtp は成功
    mockVerifyOtp.mockResolvedValue({ error: null })
    // デフォルト: profile upsert は成功
    mockPrisma.profile.upsert.mockResolvedValue({})
    // デフォルト: updateUserById は成功（non-blocking）
    mockUpdateUserById.mockResolvedValue({ error: null })
  })

  // ----------------------------------------------------------------
  // 正常系: 新規ユーザー
  // ----------------------------------------------------------------

  describe('新規ユーザーの初回ログイン', () => {
    test('createUser 成功 → generateLink → verifyOtp → /home へリダイレクト', async () => {
      mockCreateUser.mockResolvedValue({ data: { user: { id: 'new-supabase-uuid' } }, error: null })
      mockGenerateLink.mockResolvedValue({ data: LINK_DATA_NEW, error: null })

      const { GET } = await import('./route')
      const res = await GET(makeRequest() )

      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/home')

      // createUser が lineEmail で呼ばれたことを確認
      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: `line_${LINE_PROFILE.userId}@line.ogoroulette.app`,
          email_confirm: true,
        })
      )

      // generateLink でトークン取得
      expect(mockGenerateLink).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'magiclink' })
      )

      // verifyOtp で新規トークンを使用
      expect(mockVerifyOtp).toHaveBeenCalledWith(
        expect.objectContaining({ token_hash: 'hashed-token-new', type: 'email' })
      )

      // Prisma profile upsert が呼ばれた
      expect(mockPrisma.profile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'new-supabase-uuid' },
          create: expect.objectContaining({
            email: `line_${LINE_PROFILE.userId}@line.ogoroulette.app`,
            name: LINE_PROFILE.displayName,
          }),
        })
      )
    })
  })

  // ----------------------------------------------------------------
  // 正常系: 再ログイン（Supabase Auth にユーザーが存在する通常パターン）
  // ----------------------------------------------------------------

  describe('既存ユーザーの再ログイン（Supabase Auth にユーザー存在）', () => {
    test('"already registered" エラー → generateLink でフォールバック → /home へリダイレクト', async () => {
      mockCreateUser.mockResolvedValue({
        data: null,
        error: { message: 'A user with this email address has already been registered' },
      })
      mockGenerateLink.mockResolvedValue({ data: LINK_DATA_EXISTING, error: null })

      const { GET } = await import('./route')
      const res = await GET(makeRequest() )

      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/home')

      // フォールバック: generateLink で既存ユーザーのトークンを取得
      expect(mockGenerateLink).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'magiclink',
          email: `line_${LINE_PROFILE.userId}@line.ogoroulette.app`,
        })
      )

      // verifyOtp で既存ユーザーのトークンを使用
      expect(mockVerifyOtp).toHaveBeenCalledWith(
        expect.objectContaining({ token_hash: 'hashed-token-existing', type: 'email' })
      )

      // Prisma profile upsert でプロフィール同期
      expect(mockPrisma.profile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'existing-supabase-uuid' },
        })
      )
    })

    test('"already registered" の別バリエーション ("already been registered") でもフォールバックが機能する', async () => {
      mockCreateUser.mockResolvedValue({
        data: null,
        error: { message: 'User already been registered' },
      })
      mockGenerateLink.mockResolvedValue({ data: LINK_DATA_EXISTING, error: null })

      const { GET } = await import('./route')
      const res = await GET(makeRequest() )

      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/home')
      expect(mockVerifyOtp).toHaveBeenCalledWith(
        expect.objectContaining({ token_hash: 'hashed-token-existing' })
      )
    })
  })

  // ----------------------------------------------------------------
  // 中途失敗状態からの回復
  // ISSUE-038 のバグ再現シナリオ:
  // 1st login: createUser OK → verifyOtp FAIL → /auth/error (Prisma profile 未作成)
  // 2nd login: Supabase Auth にはユーザーが存在するが Prisma profile がない状態
  // ----------------------------------------------------------------

  describe('中途失敗状態からの回復（ISSUE-038 バグ再現）', () => {
    test('Supabase に存在するが Prisma profile がない状態でも 2 回目ログインが成功する', async () => {
      // Supabase Auth にユーザーが存在する（前回の createUser は成功したが verifyOtp が失敗した状態）
      mockCreateUser.mockResolvedValue({
        data: null,
        error: { message: 'A user with this email address has already been registered' },
      })
      // generateLink は成功（Supabase Auth に正常にユーザーが存在する）
      mockGenerateLink.mockResolvedValue({ data: LINK_DATA_EXISTING, error: null })
      // Prisma profile.upsert は初回作成（中途失敗で profile が未作成だった場合）
      mockPrisma.profile.upsert.mockResolvedValue({ id: LINK_DATA_EXISTING.user.id })

      const { GET } = await import('./route')
      const res = await GET(makeRequest() )

      // /auth/error に行かず /home にリダイレクトされることを確認
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/home')
      expect(res.headers.get('location')).not.toContain('/auth/error')

      // verifyOtp が呼ばれ、セッションが確立される
      expect(mockVerifyOtp).toHaveBeenCalled()

      // Prisma profile.upsert でプロフィールが作成/更新される
      expect(mockPrisma.profile.upsert).toHaveBeenCalled()
    })

    test('旧実装のバグ: Prisma profile を先にチェックすると "already registered" で /auth/error になる（ドキュメント）', async () => {
      // このテストは「旧実装では壊れていた」ことを説明するドキュメントテストです。
      // 新実装では createUser を楽観的に試み、"already registered" をフォールバックとして扱うため、
      // Prisma profile の存在有無に関係なくログインが成功します。
      // -----------------------------------------------------------------------
      // 旧実装の問題: prisma.profile.findUnique が null を返す
      //   → else ブランチで createUser → "already registered" → /auth/error
      // 新実装の対応: createUser を先に試みる
      //   → "already registered" → generateLink でユーザー ID + token 取得
      //   → verifyOtp でセッション確立 → /home
      // -----------------------------------------------------------------------
      expect(true).toBe(true) // 設計上の意図を記録するためのプレースホルダー
    })
  })

  // ----------------------------------------------------------------
  // エラー系
  // ----------------------------------------------------------------

  describe('エラーハンドリング', () => {
    test('state 不一致は /auth/error にリダイレクト', async () => {
      const url = 'http://localhost/api/auth/line/callback?code=auth-code&state=wrong-state'
      const req = new NextRequest(url, {
        method: 'GET',
        headers: { Cookie: 'line_oauth_state=correct-state' },
      })

      const { GET } = await import('./route')
      const res = await GET(req )

      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/auth/error')
    })

    test('createUser の予期しないエラーは /auth/error にリダイレクト', async () => {
      mockCreateUser.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      })

      const { GET } = await import('./route')
      const res = await GET(makeRequest() )

      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/auth/error')
    })

    test('フォールバック時の generateLink 失敗は /auth/error にリダイレクト', async () => {
      mockCreateUser.mockResolvedValue({
        data: null,
        error: { message: 'A user with this email address has already been registered' },
      })
      mockGenerateLink.mockResolvedValue({
        data: null,
        error: { message: 'generateLink failed' },
      })

      const { GET } = await import('./route')
      const res = await GET(makeRequest() )

      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/auth/error')
    })

    test('verifyOtp 失敗は /auth/error にリダイレクト', async () => {
      mockCreateUser.mockResolvedValue({ data: { user: { id: 'new-uuid' } }, error: null })
      mockGenerateLink.mockResolvedValue({ data: LINK_DATA_NEW, error: null })
      mockVerifyOtp.mockResolvedValue({ error: { message: 'OTP expired' } })

      const { GET } = await import('./route')
      const res = await GET(makeRequest() )

      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/auth/error')
    })

    test('LINE トークン取得失敗は /auth/error にリダイレクト', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        if (url === 'https://api.line.me/oauth2/v2.1/token') {
          return Promise.resolve(new Response('error', { status: 400 }))
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`))
      }))

      const { GET } = await import('./route')
      const res = await GET(makeRequest() )

      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/auth/error')
    })
  })
})
