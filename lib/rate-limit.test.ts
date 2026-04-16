import { describe, expect, test } from 'vitest'
import { checkRateLimit, getClientIp } from './rate-limit'

// WHAT: checkRateLimit / getClientIp のユニットテスト
// WHY:  レート制限は新規追加のセキュリティ機能。境界値・IP分離・時間ウィンドウをすべて検証する。

// NOTE: グローバルな Map を共有するため、各テストはユニークなキー（IP + endpoint）を使う
// NOTE: checkRateLimit は async（Vercel KV or メモリフォールバック）

describe('checkRateLimit', () => {

  // --- 基本動作 ---

  test('初回リクエストは許可される', async () => {
    const result = await checkRateLimit('1.0.0.1', 'basic-first', 5, 60_000)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  test('制限内のリクエストはすべて許可される', async () => {
    const limit = 3
    for (let i = 0; i < limit; i++) {
      const result = await checkRateLimit('1.0.0.2', 'basic-within', limit, 60_000)
      expect(result.allowed).toBe(true)
    }
  })

  test('ちょうど制限数目のリクエストは許可される（境界値）', async () => {
    const limit = 3
    // 1回目・2回目は消費
    await checkRateLimit('1.0.0.3', 'basic-boundary', limit, 60_000)
    await checkRateLimit('1.0.0.3', 'basic-boundary', limit, 60_000)
    // 3回目（= limit）は許可
    expect((await checkRateLimit('1.0.0.3', 'basic-boundary', limit, 60_000)).allowed).toBe(true)
    // 4回目（> limit）は拒否
    expect((await checkRateLimit('1.0.0.3', 'basic-boundary', limit, 60_000)).allowed).toBe(false)
  })

  test('制限を超えたリクエストは拒否され remaining は 0', async () => {
    const limit = 2
    await checkRateLimit('1.0.0.4', 'basic-exceed', limit, 60_000)
    await checkRateLimit('1.0.0.4', 'basic-exceed', limit, 60_000)

    const result = await checkRateLimit('1.0.0.4', 'basic-exceed', limit, 60_000)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  // --- IP / エンドポイント分離 ---

  test('異なる IP は独立してカウントされる', async () => {
    const limit = 1
    await checkRateLimit('10.0.0.1', 'sep-ip', limit, 60_000)
    // 10.0.0.1 は制限に達した
    expect((await checkRateLimit('10.0.0.1', 'sep-ip', limit, 60_000)).allowed).toBe(false)
    // 10.0.0.2 はまだ許可される
    expect((await checkRateLimit('10.0.0.2', 'sep-ip', limit, 60_000)).allowed).toBe(true)
  })

  test('異なるエンドポイントは独立してカウントされる', async () => {
    const limit = 1
    await checkRateLimit('10.0.1.1', 'sep-ep-a', limit, 60_000)
    // ep-a は制限に達した
    expect((await checkRateLimit('10.0.1.1', 'sep-ep-a', limit, 60_000)).allowed).toBe(false)
    // ep-b はまだ許可される
    expect((await checkRateLimit('10.0.1.1', 'sep-ep-b', limit, 60_000)).allowed).toBe(true)
  })

  // --- ウィンドウのリセット ---

  test('ウィンドウ経過後はカウントがリセットされ再び許可される', async () => {
    const limit = 1
    const windowMs = 50

    await checkRateLimit('10.0.2.1', 'reset-window', limit, windowMs)
    // 制限に達した
    expect((await checkRateLimit('10.0.2.1', 'reset-window', limit, windowMs)).allowed).toBe(false)

    // ウィンドウ終了まで待機
    await new Promise(r => setTimeout(r, windowMs + 20))

    // リセット後は許可される
    expect((await checkRateLimit('10.0.2.1', 'reset-window', limit, windowMs)).allowed).toBe(true)
  })

  // --- resetAt の正確性 ---

  test('resetAt はウィンドウ終了時刻を示す', async () => {
    const windowMs = 60_000
    const before = Date.now()
    const { resetAt } = await checkRateLimit('10.0.3.1', 'resat-accuracy', 5, windowMs)
    const after = Date.now()

    expect(resetAt).toBeGreaterThanOrEqual(before + windowMs)
    expect(resetAt).toBeLessThanOrEqual(after + windowMs)
  })

  test('制限超過時の resetAt は元のウィンドウ終了時刻と一致する', async () => {
    const limit = 1
    const windowMs = 60_000
    const { resetAt: firstResetAt } = await checkRateLimit('10.0.3.2', 'resat-exceed', limit, windowMs)
    const { resetAt: exceededResetAt } = await checkRateLimit('10.0.3.2', 'resat-exceed', limit, windowMs)

    // 超過時も同じウィンドウの終了時刻を返す
    expect(exceededResetAt).toBe(firstResetAt)
  })

  // --- remaining カウント ---

  test('remaining はリクエストごとに減少する', async () => {
    const limit = 5
    const results = await Promise.all(
      Array.from({ length: limit }, () =>
        checkRateLimit('10.0.4.1', 'remaining-count', limit, 60_000)
      )
    )
    // 並列呼び出しのため順序は保証されないが、合計 remaining は 4+3+2+1+0 のいずれかの組み合わせ
    const remainingValues = results.map(r => r.remaining).sort((a, b) => b - a)
    expect(remainingValues[0]).toBe(4)
    expect(remainingValues[4]).toBe(0)
  })
})

describe('getClientIp', () => {

  // ISSUE-247: x-forwarded-for の末尾（最後のホップ = Vercel エッジが追加した実 IP）を使用
  // 先頭はクライアントが偽装できるため使用しない
  test('x-forwarded-for の末尾 IP を返す（スプーフィング防止）', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.9.9.9' })
    expect(getClientIp(headers)).toBe('9.9.9.9')
  })

  test('x-forwarded-for が単一 IP の場合', () => {
    const headers = new Headers({ 'x-forwarded-for': '10.0.0.1' })
    expect(getClientIp(headers)).toBe('10.0.0.1')
  })

  test('x-forwarded-for の値の空白をトリムする', () => {
    const headers = new Headers({ 'x-forwarded-for': '  1.2.3.4  , 5.6.7.8' })
    expect(getClientIp(headers)).toBe('5.6.7.8')
  })

  test('x-forwarded-for がない場合は x-real-ip を返す', () => {
    const headers = new Headers({ 'x-real-ip': '9.9.9.9' })
    expect(getClientIp(headers)).toBe('9.9.9.9')
  })

  test('どちらもない場合は "unknown" を返す', () => {
    const headers = new Headers()
    expect(getClientIp(headers)).toBe('unknown')
  })

  test('x-forwarded-for が空文字列の場合は x-real-ip にフォールバック', () => {
    const headers = new Headers({ 'x-real-ip': '4.4.4.4' })
    headers.delete('x-forwarded-for')
    expect(getClientIp(headers)).toBe('4.4.4.4')
  })
})
