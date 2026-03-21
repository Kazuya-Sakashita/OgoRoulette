import { describe, expect, test } from 'vitest'
import { canStartSpin, isSpinInProgress, determineMemberSpinAction } from './room-spin'

// WHAT: IN_SESSION 遷移ロジックとメンバーアクション判定を検証する
// WHY:  「オーナーのみがスピンを開始でき、メンバーには正しく通知が届く」仕様の核心ロジック

describe('canStartSpin', () => {
  test('WAITING 状態からスピンを開始できる', () => {
    expect(canStartSpin('WAITING')).toBe(true)
  })

  test('IN_SESSION 状態では開始できない（多重実行防止）', () => {
    expect(canStartSpin('IN_SESSION')).toBe(false)
  })

  test('COMPLETED 状態では開始できない', () => {
    expect(canStartSpin('COMPLETED')).toBe(false)
  })

  test('EXPIRED 状態では開始できない', () => {
    expect(canStartSpin('EXPIRED')).toBe(false)
  })
})

describe('isSpinInProgress', () => {
  test('IN_SESSION のときスピン中と判定する', () => {
    expect(isSpinInProgress('IN_SESSION')).toBe(true)
  })

  test('WAITING のときスピン中ではない', () => {
    expect(isSpinInProgress('WAITING')).toBe(false)
  })

  test('COMPLETED のときスピン中ではない', () => {
    expect(isSpinInProgress('COMPLETED')).toBe(false)
  })
})

describe('determineMemberSpinAction', () => {

  // --- オーナーは常に noop ---

  test('オーナーは常に noop（自分でハンドリング済み）', () => {
    expect(determineMemberSpinAction(true, 'COMPLETED', 'sess-1', null, false)).toBe('noop')
    expect(determineMemberSpinAction(true, 'COMPLETED', 'sess-1', undefined, false)).toBe('noop')
  })

  // --- 初回ロード（prevSessionId === undefined）---

  test('初回ロードで COMPLETED かつセッションあり → show-winner（アニメなし再表示）', () => {
    expect(determineMemberSpinAction(false, 'COMPLETED', 'sess-1', undefined, false)).toBe('show-winner')
  })

  test('初回ロードで WAITING → noop（まだ何も起きていない）', () => {
    expect(determineMemberSpinAction(false, 'WAITING', null, undefined, false)).toBe('noop')
  })

  test('初回ロードで COMPLETED だがセッションなし → noop', () => {
    expect(determineMemberSpinAction(false, 'COMPLETED', null, undefined, false)).toBe('noop')
  })

  // --- 新セッション検知 ---

  test('新しいセッションIDが来た → trigger-spin（アニメ付き結果表示）', () => {
    expect(determineMemberSpinAction(false, 'COMPLETED', 'sess-2', 'sess-1', false)).toBe('trigger-spin')
  })

  test('セッションIDが変わっていない → noop（ポーリング継続中）', () => {
    expect(determineMemberSpinAction(false, 'COMPLETED', 'sess-1', 'sess-1', false)).toBe('noop')
  })

  test('すでに当選者を表示中 → noop（二重表示防止）', () => {
    expect(determineMemberSpinAction(false, 'COMPLETED', 'sess-2', 'sess-1', true)).toBe('noop')
  })

  test('新しいセッションだが prevSessionId が null → trigger-spin', () => {
    // null = セッションなし状態を確認済み、その後初めてセッションが来た
    expect(determineMemberSpinAction(false, 'COMPLETED', 'sess-1', null, false)).toBe('trigger-spin')
  })
})
