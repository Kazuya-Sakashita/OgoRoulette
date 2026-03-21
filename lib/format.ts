/**
 * WHAT: 表示用フォーマットユーティリティ
 * WHY:  同一の Intl.NumberFormat 呼び出しが複数ファイルに重複していたため共通化
 */

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(amount)
}
