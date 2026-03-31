/**
 * spin-sound.ts
 * WHAT: Web Audio API による合成音ユーティリティ（音声ファイル不要）
 * WHY:  外部アセットなしに音が出せる。ミュート環境・非対応端末でも体験は成立する。
 * HOW:  OscillatorNode + GainNode の組み合わせで短いトーンを合成する
 *
 * iOS Safari 対応:
 *   AudioContext はシングルトンで保持し、ユーザーのタップ時に一度だけ
 *   unlockAudioContext() を呼んで "running" 状態にする。
 *   一度 running になれば setTimeout やアニメーションコールバックからも再生可能。
 */

// Singleton AudioContext — iOS では毎回 new すると suspended のまま音が出ない
let _ctx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!_ctx) {
    try {
      _ctx = new AudioContext()
    } catch {
      return null
    }
  }
  return _ctx
}

/**
 * iOS Safari 用: ユーザーのタップ（click/touchend）から呼ぶことで
 * AudioContext を suspended → running にアンロックする。
 * 一度 running になればその後の setTimeout 等からも音が出る。
 * handleSpin() など直接のユーザーアクションハンドラの先頭で呼ぶこと。
 */
export async function unlockAudioContext(): Promise<void> {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === "suspended") {
    await ctx.resume()
  }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  volume = 0.25,
  type: OscillatorType = "sine"
) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = type
  osc.frequency.setValueAtTime(freq, startTime)
  gain.gain.setValueAtTime(volume, startTime)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  osc.start(startTime)
  osc.stop(startTime + duration)
}

/** ボタン押下: 短いクリック音 */
export function playPressSound() {
  const ctx = getAudioContext()
  if (!ctx || ctx.state !== "running") return
  playTone(ctx, 800, ctx.currentTime, 0.03, 0.2, "square")
}

/** 回転開始: 上昇スウィープ */
export function playSpinStartSound() {
  const ctx = getAudioContext()
  if (!ctx || ctx.state !== "running") return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = "sine"
  osc.frequency.setValueAtTime(200, ctx.currentTime)
  osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.3)
  gain.gain.setValueAtTime(0.2, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
  osc.start()
  osc.stop(ctx.currentTime + 0.4)
}

/** 減速 tick: 乾いたカチ音 */
export function playTickSound() {
  const ctx = getAudioContext()
  if (!ctx || ctx.state !== "running") return
  playTone(ctx, 1100, ctx.currentTime, 0.02, 0.15, "square")
}

/** 結果確定: 3音ファンファーレ (G4 → B4 → D5) */
export function playResultSound() {
  const ctx = getAudioContext()
  if (!ctx || ctx.state !== "running") return
  const notes = [392, 494, 587] // G4, B4, D5
  const now = ctx.currentTime
  notes.forEach((freq, i) => {
    playTone(ctx, freq, now + i * 0.12, 0.18, 0.25, "sine")
  })
}
