/**
 * spin-sound.ts
 * WHAT: Web Audio API による合成音ユーティリティ（音声ファイル不要）
 * WHY:  外部アセットなしに音が出せる。ミュート環境・非対応端末でも体験は成立する。
 * HOW:  OscillatorNode + GainNode の組み合わせで短いトーンを合成する
 *
 * iOS Safari 対応:
 *   AudioContext はシングルトン。ユーザーのタップ時に unlockAudioContext() を呼ぶ。
 *   unlock は「無音バッファの再生」で行う（Howler.js / Tone.js と同じ手法）。
 *   ctx.resume() のみでは iOS で動かないケースがある。
 *   sync 関数なので async handleSpin でも普通の onClick でも呼べる。
 */

let _ctx: AudioContext | null = null
let _unlocked = false

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
 * iOS Safari 用アンロック。ユーザーのタップハンドラから呼ぶ。
 *
 * ctx.resume() + 無音バッファ再生の両方を実行する。
 * 無音バッファ再生が iOS の autoplay ポリシーを確実に解除する
 * (Howler.js と同じ手法)。
 * 同期関数なので async/await 不要。一度 unlock されれば以後は即時 return。
 */
export function unlockAudioContext(): void {
  if (_unlocked) return
  const ctx = getAudioContext()
  if (!ctx) return

  // resume() を呼ぶ（suspended → running への移行を開始）
  ctx.resume().catch(() => {})

  // iOS 用: 無音の 1 サンプルバッファを再生して autoplay lock を解除する
  // resume() だけでは不十分なケースへの対策
  try {
    const buffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
    source.disconnect()
    _unlocked = true
  } catch {
    // 非対応環境では無視
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
