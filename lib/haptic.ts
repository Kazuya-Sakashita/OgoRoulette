/**
 * haptic.ts
 * WHAT: navigator.vibrate のラッパー
 * WHY:  非対応端末（iOS Safari）で例外が出ないようにする
 *       音・振動は演出補助のみ。使えなくても体験は成立する。
 */

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // 非対応端末は無視
  }
}

// プリセット
export const HapticPattern: Record<string, number[]> = {
  press:  [40],               // ボタン押下
  start:  [60],               // 回転開始
  tick:   [20],               // 減速カチカチ
  result: [100, 50, 100],     // 結果確定
}
