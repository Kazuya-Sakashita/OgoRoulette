import { describe, expect, test } from 'vitest'
import { validateReturnTo } from './safe-redirect'

// WHAT: validateReturnTo の全セキュリティケースを検証する
// WHY:  open redirect 脆弱性（ISSUE-180）の根絶を保証する。
//       攻撃パターンが新たに追加されても既存テストが回帰を検出できる。

describe('validateReturnTo', () => {

  // --- 正常系: 有効な相対パスを受け入れる ---

  test('/home → そのまま返す', () => {
    expect(validateReturnTo('/home')).toBe('/home')
  })

  test('ネストしたパス → そのまま返す', () => {
    expect(validateReturnTo('/room/ABC123/play')).toBe('/room/ABC123/play')
  })

  test('クエリ文字列付きパス → そのまま返す', () => {
    expect(validateReturnTo('/home?tab=groups')).toBe('/home?tab=groups')
  })

  test('結果ページのパス → そのまま返す', () => {
    expect(validateReturnTo('/result?winner=太郎')).toBe('/result?winner=太郎')
  })

  // --- 異常系: null / undefined / 空文字 ---

  test('null → /home', () => {
    expect(validateReturnTo(null)).toBe('/home')
  })

  test('undefined → /home', () => {
    expect(validateReturnTo(undefined)).toBe('/home')
  })

  test('空文字 → /home', () => {
    expect(validateReturnTo('')).toBe('/home')
  })

  // --- 攻撃パターン: 外部URLリダイレクト ---

  test('https://evil.com → /home', () => {
    expect(validateReturnTo('https://evil.com')).toBe('/home')
  })

  test('http://evil.com → /home', () => {
    expect(validateReturnTo('http://evil.com')).toBe('/home')
  })

  // --- 攻撃パターン: プロトコル相対URL ---

  test('//evil.com → /home', () => {
    expect(validateReturnTo('//evil.com')).toBe('/home')
  })

  test('//evil.com/path → /home', () => {
    expect(validateReturnTo('//evil.com/path')).toBe('/home')
  })

  // --- 攻撃パターン: URLエンコードによるバイパス ---

  test('%2F%2Fevil.com → /home（デコード後に//で始まる）', () => {
    expect(validateReturnTo('%2F%2Fevil.com')).toBe('/home')
  })

  // --- 攻撃パターン: バックスラッシュによるパス偽装 ---

  test('/\\evil.com → /home', () => {
    expect(validateReturnTo('/\\evil.com')).toBe('/home')
  })

  // --- 攻撃パターン: 過度に長いパス ---

  test('300文字超のパス → /home', () => {
    const longPath = '/' + 'a'.repeat(300)
    expect(validateReturnTo(longPath)).toBe('/home')
  })

  test('300文字以内のパス → 受け入れる', () => {
    const validPath = '/' + 'a'.repeat(10)
    expect(validateReturnTo(validPath)).toBe(validPath)
  })

  // --- 境界値: 相対パスでない文字列 ---

  test('スラッシュで始まらない文字列 → /home', () => {
    expect(validateReturnTo('evil.com')).toBe('/home')
  })

  test('相対パスのみ（スラッシュ1つ） → 受け入れる', () => {
    expect(validateReturnTo('/')).toBe('/')
  })

})
