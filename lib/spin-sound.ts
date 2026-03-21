/**
 * spin-sound.ts
 * WHAT: Web Audio API による合成音ユーティリティ（音声ファイル不要）
 * WHY:  外部アセットなしに音が出せる。ミュート環境・非対応端末でも体験は成立する。
 * HOW:  OscillatorNode + GainNode の組み合わせで短いトーンを合成する
 */

function getAudioContext(): AudioContext | null {
  try {
    return new AudioContext()
  } catch {
    return null
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
  if (!ctx) return
  playTone(ctx, 800, ctx.currentTime, 0.03, 0.2, "square")
}

/** 回転開始: 上昇スウィープ */
export function playSpinStartSound() {
  const ctx = getAudioContext()
  if (!ctx) return
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
  if (!ctx) return
  playTone(ctx, 1100, ctx.currentTime, 0.02, 0.15, "square")
}

/** 結果確定: 3音ファンファーレ (G4 → B4 → D5) */
export function playResultSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  const notes = [392, 494, 587] // G4, B4, D5
  const now = ctx.currentTime
  notes.forEach((freq, i) => {
    playTone(ctx, freq, now + i * 0.12, 0.18, 0.25, "sine")
  })
}
