/**
 * video-recorder.ts
 *
 * MediaRecorder wrapper that records a canvas element's stream.
 * Supports WebM (VP9/VP8) and MP4 depending on browser support.
 * Gracefully degrades when recording is unavailable.
 */

export function getSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return ""
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ]
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? ""
}

/** Returns true if canvas recording is supported in this browser. */
export function canRecord(canvas?: HTMLCanvasElement | null): boolean {
  if (typeof window === "undefined") return false
  if (typeof MediaRecorder === "undefined") return false
  if (!canvas) return false
  if (typeof (canvas as HTMLCanvasElement & { captureStream?: unknown }).captureStream !== "function") return false
  return getSupportedMimeType() !== ""
}

export class VideoRecorder {
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private _active = false

  /**
   * Start recording the given canvas at `fps` frames per second.
   * Returns true if recording started successfully.
   */
  start(canvas: HTMLCanvasElement, fps = 30): boolean {
    try {
      const stream = (canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(fps)
      const mimeType = getSupportedMimeType()
      this.chunks = []
      this.recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType, videoBitsPerSecond: 2_500_000 } : {}
      )
      this.recorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data)
      }
      this.recorder.start(200) // collect every 200 ms
      this._active = true
      return true
    } catch {
      this._active = false
      return false
    }
  }

  /** Stop recording and return the recorded Blob (or null on failure). */
  stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      this._active = false
      if (!this.recorder || this.recorder.state === "inactive") {
        resolve(null)
        return
      }
      this.recorder.onstop = () => {
        if (this.chunks.length === 0) {
          resolve(null)
          return
        }
        const mimeType = this.recorder?.mimeType ?? "video/webm"
        resolve(new Blob(this.chunks, { type: mimeType }))
        this.chunks = []
      }
      this.recorder.stop()
    })
  }

  get isActive(): boolean {
    return this._active && this.recorder?.state === "recording"
  }
}
