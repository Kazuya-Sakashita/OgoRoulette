"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { VideoRecorder, canRecord } from "@/lib/video-recorder"
import type { RecordingPhase } from "@/components/recording-canvas"

/**
 * Encapsulates the full video recording lifecycle for the roulette.
 *
 * Usage:
 *   1. Call `setRecordingPhase("countdown")` when the countdown begins.
 *   2. Call `startRecording()` when the wheel starts spinning.
 *   3. Call `stopRecordingAfterReveal()` when the winner is determined —
 *      this lets the reveal animation run for 2.5 s before stopping.
 *   4. Call `reset()` when the WinnerCard is closed.
 *
 * The hook manages RecordingCanvas's ref and wheelRotationRef internally.
 * Both must be forwarded to the corresponding JSX elements.
 */
export function useVideoRecorder() {
  const [recordingPhase, setRecordingPhase] = useState<RecordingPhase>("idle")
  const [recordedBlob, setRecordedBlob]     = useState<Blob | null>(null)
  const [showShareSheet, setShowShareSheet] = useState(false)

  const recordingCanvasRef = useRef<HTMLCanvasElement>(null)
  const wheelRotationRef   = useRef<number>(0)
  const recorderRef        = useRef(new VideoRecorder())
  const revealTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Start MediaRecorder. Sets recordingPhase → "spinning". */
  const startRecording = useCallback(() => {
    setRecordingPhase("spinning")
    if (recordingCanvasRef.current && canRecord(recordingCanvasRef.current)) {
      recorderRef.current.start(recordingCanvasRef.current)
    }
  }, [])

  /**
   * Enter reveal phase, then stop the recorder 2.5 s later.
   * Call this immediately when the wheel stops (handleSpinComplete).
   */
  const stopRecordingAfterReveal = useCallback(() => {
    setRecordingPhase("reveal")
    clearTimeout(revealTimerRef.current ?? undefined)
    revealTimerRef.current = setTimeout(async () => {
      setRecordingPhase("done")
      const blob = await recorderRef.current.stop()
      if (blob && blob.size > 0) setRecordedBlob(blob)
    }, 2500)
  }, [])

  /** Clear all recording state. Call when WinnerCard is dismissed. */
  const reset = useCallback(() => {
    setRecordedBlob(null)
    setShowShareSheet(false)
    setRecordingPhase("idle")
    clearTimeout(revealTimerRef.current ?? undefined)
    recorderRef.current.stop().catch(() => {})
  }, [])

  // Cleanup on unmount
  useEffect(() => () => clearTimeout(revealTimerRef.current ?? undefined), [])

  return {
    recordingPhase,
    setRecordingPhase,
    recordedBlob,
    showShareSheet,
    setShowShareSheet,
    recordingCanvasRef,
    wheelRotationRef,
    startRecording,
    stopRecordingAfterReveal,
    reset,
  }
}
