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

  // ISSUE-190: ファネル計測（新規）
  HOME_VIEWED:             "home_viewed",             // ホーム画面表示

  // Retention（ISSUE-182）
  REENGAGEMENT_CTA_CLICKED: "reengagement_cta_clicked", // 再開CTA クリック
  GROUP_SAVED:             "group_saved",             // グループ保存
  GROUP_SELECTED:          "group_selected",          // グループ選択してスピン

  // Share（ISSUE-181/183）
  SHARE_PRIMARY_CLICKED:   "share_primary_clicked",   // Phase B「シェアする」クリック
  SHARE_CARD_GENERATED:    "share_card_generated",    // Canvas 画像生成成功
  SHARE_X_CLICKED:         "share_x_clicked",         // X シェアボタン
  SHARE_LINE_CLICKED:      "share_line_clicked",      // LINE シェアボタン
  DETAILS_ACCORDION_OPENED: "details_accordion_opened", // 詳細アコーディオン展開

  // Viral（ISSUE-187）
  SHARE_JOIN_CLICK:        "share_join_click",        // ref=share で join ページ到達
  SHARE_JOIN_COMPLETE:     "share_join_complete",     // ref=share 経由でルーム参加完了

  // ルームライフサイクル
  ROOM_CREATED:            "room_created",
  ROOM_JOINED:             "room_joined",
  ROOM_COMPLETED:          "room_completed",          // ルーム完走（全員スピン完了）

  // Push（ISSUE-188）
  PUSH_SUBSCRIBE_SUCCESS:  "push_subscribe_success",
  PUSH_SUBSCRIBE_FAILED:   "push_subscribe_failed",
  PUSH_PROMPT_SHOWN:       "push_prompt_shown",
  PUSH_PROMPT_DISMISSED:   "push_prompt_dismissed",

  // ISSUE-238: NSM 計測 — スピン回数/セッション（North Star Metric）
  // properties: { session_spin_count: number, participants_count: number }
  HOME_SPIN_COMPLETE:      "home_spin_complete",

  // ISSUE-238: ゲスト→ログイン転換率計測
  // モーダル表示が分母、SIGNED_IN が分子
  GUEST_CONVERSION_MODAL_SHOWN: "guest_conversion_modal_shown",
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
