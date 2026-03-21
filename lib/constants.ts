// スピン同期定数
// SPIN_COUNTDOWN_MS: SPIN押下からアニメーション開始までの猶予時間
// この時間でオーナーはAPIレスポンスを待ち、メンバーはポーリングで同期できる
export const SPIN_COUNTDOWN_MS = 3000
// SPIN_DURATION_MS: RouletteWheelアニメーション全体の最大時間
export const SPIN_DURATION_MS = 5500

// Canonical roulette segment colors — shared across RouletteWheel and WinnerCard
// Order matters: index 0 = first segment color shown on wheel
export const SEGMENT_COLORS = [
  "#F97316", // Orange
  "#EC4899", // Pink
  "#8B5CF6", // Purple
  "#3B82F6", // Blue
  "#22C55E", // Green
  "#FBBF24", // Yellow
]
