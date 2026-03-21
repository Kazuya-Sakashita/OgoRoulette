/**
 * 一部奢り計算ロジック
 *
 * WHAT: totalBill から treatAmount を引いた残りを、当選者以外で頭割り（切り上げ）する
 * WHY:  計算ロジックをUIから分離し、テスト可能・再利用可能にする
 */

export interface BillSplit {
  remainingAmount: number  // 奢り後の残り総額
  splitAmount: number      // 当選者以外1人あたりの支払い額（切り上げ）
  isActive: boolean        // 金額入力が有効か（表示・保存の判断に使う）
}

/**
 * 一部奢り計算
 *
 * @param totalBill      合計金額（0以上の整数）
 * @param treatAmount    奢り金額（0以上、totalBill以下）
 * @param participantCount  参加人数（当選者を含む）
 */
export function calculateBillSplit(
  totalBill: number,
  treatAmount: number,
  participantCount: number
): BillSplit {
  // 入力値の正規化: 負値・小数を除去
  const bill = Math.max(0, Math.floor(totalBill))
  const treat = Math.min(Math.max(0, Math.floor(treatAmount)), bill)

  const isActive = bill > 0

  if (!isActive || participantCount < 2) {
    return { remainingAmount: 0, splitAmount: 0, isActive }
  }

  const remainingAmount = bill - treat
  const nonWinnerCount = participantCount - 1
  // ceil: 端数は切り上げ（日本の慣習に合わせ、合計は totalBill 以上になる場合がある）
  const splitAmount = nonWinnerCount > 0
    ? Math.ceil(remainingAmount / nonWinnerCount)
    : 0

  return { remainingAmount, splitAmount, isActive }
}
