import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

// WHAT: trackEvent のイベント送信ロジックを検証する
// WHY:  Analytics は fire-and-forget だが、SSR 安全性・例外耐性・イベント名の正確さを
//       保証しないと計測データが欠落または本番エラーになる

vi.mock('@vercel/analytics', () => ({
  track: vi.fn(),
}))

// モック後にインポート（Vitestの静的解析でもvi.mockは巻き上げられる）
import { trackEvent, AnalyticsEvent } from './analytics'
import { track } from '@vercel/analytics'

const mockTrack = track as ReturnType<typeof vi.fn>

describe('trackEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // グローバルに設定した window を戻す
    vi.unstubAllGlobals()
  })

  // --- SSR 安全性 ---

  test('window が未定義（SSR）では track を呼ばない', () => {
    // Node 環境ではデフォルトで window が undefined
    trackEvent(AnalyticsEvent.SPIN_BUTTON_CLICKED)
    expect(mockTrack).not.toHaveBeenCalled()
  })

  // --- ブラウザ環境での正常系 ---

  test('window がある場合は track を正しいイベント名で呼ぶ', () => {
    vi.stubGlobal('window', {})
    trackEvent(AnalyticsEvent.SPIN_BUTTON_CLICKED)
    expect(mockTrack).toHaveBeenCalledWith('spin_button_clicked', undefined)
  })

  test('プロパティ付きでイベントを送信できる', () => {
    vi.stubGlobal('window', {})
    trackEvent(AnalyticsEvent.SPIN_API_ERROR, { phase: 'spinning', count: 3 })
    expect(mockTrack).toHaveBeenCalledWith('spin_api_error', { phase: 'spinning', count: 3 })
  })

  test('SPIN_ANIMATION_COMPLETE イベントが正しいイベント名を持つ', () => {
    vi.stubGlobal('window', {})
    trackEvent(AnalyticsEvent.SPIN_ANIMATION_COMPLETE)
    expect(mockTrack).toHaveBeenCalledWith('spin_animation_complete', undefined)
  })

  // --- 例外耐性 ---

  test('track が例外を投げてもエラーを外部に伝播しない', () => {
    vi.stubGlobal('window', {})
    mockTrack.mockImplementationOnce(() => { throw new Error('network error') })
    expect(() => trackEvent(AnalyticsEvent.SPIN_BUTTON_CLICKED)).not.toThrow()
  })

  // --- AnalyticsEvent 定数の整合性 ---

  test('AnalyticsEvent の値はすべて文字列', () => {
    for (const value of Object.values(AnalyticsEvent)) {
      expect(typeof value).toBe('string')
    }
  })

  test('AnalyticsEvent の値はすべてスネークケース（小文字 + アンダースコア）', () => {
    for (const value of Object.values(AnalyticsEvent)) {
      expect(value).toMatch(/^[a-z][a-z0-9_]*$/)
    }
  })

})
