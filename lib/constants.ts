// ISSUE-102: 録画尺の定数化 — 変更時はここだけ修正する
// reveal アニメーション（crown → name → reaction → amount）は約3秒で完了するが、
// 4.5秒のバッファを持たせて金額テキストが画面に残る時間を確保する
export const REVEAL_RECORD_DURATION_MS = 4500

// スピン同期定数
// SPIN_COUNTDOWN_MS: SPIN押下からアニメーション開始までの猶予時間
// この時間でオーナーはAPIレスポンスを待ち、メンバーはポーリングで同期できる
export const SPIN_COUNTDOWN_MS = 3000
// SPIN_DURATION_MS: RouletteWheelアニメーション全体の最大時間
export const SPIN_DURATION_MS = 5500

// Canonical roulette segment colors — shared across RouletteWheel and WinnerCard
// Order matters: index 0 = first segment color shown on wheel
// 10 colors to cover the default maxMembers of 10 without repeating
// 演出タイムアウト定数 — この1ファイルで全フェーズ尺を管理する
export const INTRO_DURATION_S      = 1.5   // イントロ参加者表示（秒）
export const COUNTDOWN_DURATION_S  = 3.0   // カウントダウン 3→2→1（秒）
export const BOUNCE_DURATION_MS    = 500   // バウンスアニメーション（ms）
export const SILENCE_BEFORE_REVEAL_MS = 500 // ホイール停止〜reveal開始までの溜め（ms）
export const CONFETTI_DURATION_MS  = 4000  // confetti表示時間（ms）

export const SEGMENT_COLORS = [
  "#F97316", // Orange
  "#EC4899", // Pink
  "#8B5CF6", // Purple
  "#3B82F6", // Blue
  "#22C55E", // Green
  "#FBBF24", // Yellow
  "#EF4444", // Red
  "#06B6D4", // Cyan
  "#A855F7", // Violet
  "#F59E0B", // Amber
]
