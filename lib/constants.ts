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

// ISSUE-139: 録画canvasのアニメーションタイミング定数
// recording-canvas.tsx のstagger・reveal計算でこれらを参照する
export const INTRO_STAGGER_START_S    = 0.08   // イントロ: 最初の名前が現れるまでの遅延（秒）
export const INTRO_STAGGER_STEP_S     = 0.10   // イントロ: 各名前のフェードイン開始間隔（秒）
export const INTRO_FADE_DURATION_S    = 0.12   // イントロ: 各名前のフェードイン時間（秒）
export const REVEAL_EXPAND_DURATION_S = 0.65   // reveal: グロウ拡大アニメーション時間（秒）

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
