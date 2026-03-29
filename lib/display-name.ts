/**
 * display-name.ts
 *
 * 公開表示名の取得ロジックを一元管理する。
 *
 * 設計方針:
 *   - provider_name（Profile.name）は外部公開しない
 *   - display_name が設定されていれば使う
 *   - 未設定の場合は "ユーザー" + id末尾4文字 を返す（本名が出ない）
 *
 * 使用箇所:
 *   - SNS シェアテキスト
 *   - 結果画面（result）
 *   - 履歴画面（history）
 *   - ルーム招待ページのオーナー名
 *   - 動画書き出し・OGP 画像
 */

export interface DisplayNameSource {
  id: string
  displayName?: string | null
}

/**
 * ユーザーの公開表示名を返す。
 * display_name が設定されていれば使い、未設定なら fallback を返す。
 * Provider から取得した本名（Profile.name）は絶対に返さない。
 */
export function getDisplayName(profile: DisplayNameSource): string {
  if (profile.displayName?.trim()) return profile.displayName.trim()
  return buildFallbackName(profile.id)
}

/**
 * display_name 未設定時の fallback 名を生成する。
 * id ベースで一意かつ再現性がある（毎回変わらない）。
 */
export function buildFallbackName(id: string): string {
  return "ユーザー" + id.slice(-4)
}

/**
 * 初回シェア前に公開名確認ボトムシートを表示すべきかを返す。
 * display_name_confirmed_at が NULL のログインユーザーが対象。
 */
export function needsDisplayNameConfirmation(profile: {
  displayNameConfirmedAt?: Date | null
} | null): boolean {
  if (!profile) return false
  return !profile.displayNameConfirmedAt
}
