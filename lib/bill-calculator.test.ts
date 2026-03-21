import { describe, expect, test } from 'vitest'
import { calculateBillSplit } from './bill-calculator'

// WHAT: calculateBillSplit の全ケースを検証する
// WHY:  金額計算は最優先保護対象。端数・奢り種別・異常系で正しく動くことを保証する。

describe('calculateBillSplit', () => {

  // --- 割り勘 (treatAmount=当選者負担額) ---

  // 2人で1000円・完全均等割り: 当選者も500円払う → treatAmount=500
  test('2人で1000円・均等割り: treatAmount=500 → splitAmount=500', () => {
    const { splitAmount, remainingAmount, isActive } = calculateBillSplit(1000, 500, 2)
    expect(splitAmount).toBe(500)
    expect(remainingAmount).toBe(500)
    expect(isActive).toBe(true)
  })

  // 当選者免除(treatAmount=0): 非当選者が全額負担
  test('2人で1000円・当選者免除: splitAmount=1000（非当選者1人が全額）', () => {
    const { splitAmount, remainingAmount } = calculateBillSplit(1000, 0, 2)
    expect(splitAmount).toBe(1000)
    expect(remainingAmount).toBe(1000)
  })

  test('3人で3000円・均等割り: treatAmount=1000 → splitAmount=1000', () => {
    const { splitAmount } = calculateBillSplit(3000, 1000, 3)
    // remaining = 2000, nonWinner = 2, ceil(2000/2) = 1000
    expect(splitAmount).toBe(1000)
  })

  test('3人・当選者免除: 残り全額を非当選者2人で割る', () => {
    const { splitAmount } = calculateBillSplit(3000, 0, 3)
    // ceil(3000 / 2) = 1500
    expect(splitAmount).toBe(1500)
  })

  test('端数切り上げ: 3人で1001円・当選者免除 → ceil(1001/2)=501', () => {
    const { splitAmount } = calculateBillSplit(1001, 0, 3)
    expect(splitAmount).toBe(501)
  })

  // --- 全額奢り ---

  test('全額奢り: 1人が全額負担、他は0円', () => {
    const { splitAmount, remainingAmount } = calculateBillSplit(10000, 10000, 3)
    expect(splitAmount).toBe(0)
    expect(remainingAmount).toBe(0)
  })

  test('全額奢り: isActive は true（金額が入力されているため）', () => {
    const { isActive } = calculateBillSplit(5000, 5000, 2)
    expect(isActive).toBe(true)
  })

  // --- 一部奢り ---

  test('一部奢り: 30000円のうち20000円を奢り、残り10000を2人で割る', () => {
    const { splitAmount, remainingAmount } = calculateBillSplit(30000, 20000, 3)
    expect(remainingAmount).toBe(10000)
    // ceil(10000 / 2) = 5000
    expect(splitAmount).toBe(5000)
  })

  test('一部奢り: 端数切り上げ', () => {
    const { splitAmount } = calculateBillSplit(10000, 3000, 3)
    // remaining = 7000, ceil(7000 / 2) = 3500
    expect(splitAmount).toBe(3500)
  })

  test('一部奢り: 奢り金額がぴったり残り割り切れる場合', () => {
    const { splitAmount } = calculateBillSplit(10000, 4000, 3)
    // remaining = 6000, ceil(6000 / 2) = 3000
    expect(splitAmount).toBe(3000)
  })

  // --- 異常系 ---

  test('金額0円: isActive は false、splitAmount は 0', () => {
    const { splitAmount, isActive } = calculateBillSplit(0, 0, 3)
    expect(isActive).toBe(false)
    expect(splitAmount).toBe(0)
  })

  test('人数1人: splitAmount は 0（ゼロ除算しない）', () => {
    const { splitAmount } = calculateBillSplit(10000, 0, 1)
    expect(splitAmount).toBe(0)
  })

  test('人数0人: splitAmount は 0（ゼロ除算しない）', () => {
    const { splitAmount } = calculateBillSplit(10000, 0, 0)
    expect(splitAmount).toBe(0)
  })

  test('人数2人未満: isActive が true でも 0 を返す', () => {
    const result = calculateBillSplit(5000, 0, 1)
    expect(result.splitAmount).toBe(0)
    expect(result.remainingAmount).toBe(0)
  })

  test('奢り金額が合計を超える: 合計に丸められる', () => {
    // treatAmount > totalBill は bill に clamp される
    const { splitAmount, remainingAmount } = calculateBillSplit(5000, 9999, 3)
    // treat は min(9999, 5000) = 5000 に丸められる
    expect(remainingAmount).toBe(0)
    expect(splitAmount).toBe(0)
  })

  test('負の金額: 0に正規化される', () => {
    const { isActive } = calculateBillSplit(-100, -50, 3)
    expect(isActive).toBe(false)
  })

  test('負の奢り金額: 0に正規化される', () => {
    const { splitAmount } = calculateBillSplit(10000, -5000, 3)
    // treat は max(0, -5000) = 0 に正規化
    // remaining = 10000, ceil(10000 / 2) = 5000
    expect(splitAmount).toBe(5000)
  })

  test('小数点入力: 切り捨てて整数として扱う', () => {
    const { splitAmount } = calculateBillSplit(999.9, 0, 3)
    // bill = floor(999.9) = 999, ceil(999 / 2) = 500
    expect(splitAmount).toBe(500)
  })

  // --- isActive フラグ ---

  test('totalBill > 0 なら isActive = true', () => {
    const { isActive } = calculateBillSplit(1, 0, 2)
    expect(isActive).toBe(true)
  })

  test('totalBill = 0 なら isActive = false', () => {
    const { isActive } = calculateBillSplit(0, 100, 2)
    expect(isActive).toBe(false)
  })

})
