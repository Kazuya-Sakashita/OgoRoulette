/**
 * analytics.ts — ISSUE-013: 行動分析ラッパー
 *
 * @vercel/analytics の track() を薄くラップし、主要イベントを型安全に記録する。
 * 将来的に PostHog 等へ差し替える場合はこのファイルのみ変更すればよい。
 *
 * 使い方: import { trackEvent } from "@/lib/analytics"
 *         trackEvent("spin_button_clicked", { participants_count: 3 })
 */

import { track } from "@vercel/analytics"

// --- イベント名の定義 ---

export const AnalyticsEvent = {
  // スピンファネル
  SPIN_BUTTON_CLICKED:     "spin_button_clicked",
  SPIN_API_SUCCESS:        "spin_api_success",
  SPIN_API_ERROR:          "spin_api_error",
  SPIN_ANIMATION_COMPLETE: "spin_animation_complete",
  SPIN_TIMEOUT:            "spin_timeout",            // ISSUE-003 のタイムアウト発火

  // シェアファネル
  SHARE_SHEET_OPENED:      "share_sheet_opened",
  SHARE_BUTTON_CLICKED:    "share_button_clicked",

  // ルームファネル
  RESPIN_CLICKED:          "respin_clicked",
  SPIN_COMPLETE_RETRY:     "spin_complete_retry",     // ISSUE-005 の retry 発火
  SPIN_COMPLETE_FAILED:    "spin_complete_failed",    // ISSUE-005 の全 retry 失敗

  // エラー
  PHASE_TIMEOUT:           "phase_timeout",           // {phase: "spinning" | "preparing"}
} as const

export type AnalyticsEventName = typeof AnalyticsEvent[keyof typeof AnalyticsEvent]

// --- 記録関数 ---

/**
 * Vercel Analytics にイベントを送信する。
 * サーバーサイドや SSR 環境では何もしない（track は client-only）。
 */
export function trackEvent(
  name: AnalyticsEventName,
  properties?: Record<string, string | number | boolean>
): void {
  if (typeof window === "undefined") return
  try {
    track(name, properties)
  } catch {
    // analytics の失敗はサイレントに
  }
}
