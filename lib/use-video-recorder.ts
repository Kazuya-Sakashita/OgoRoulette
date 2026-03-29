"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { VideoRecorder, canRecord } from "@/lib/video-recorder"
import type { RecordingPhase } from "@/components/recording-canvas"

/**
 * Encapsulates the full video recording lifecycle for the roulette.
 *
 * Usage:
 *   1. Call `setRecordingPhase("countdown")` + `startRecording()` when countdown begins.
 *      This captures the 3→2→1 anticipation in the video (ISSUE-091).
 *   2. Call `setRecordingPhase("spinning")` when the wheel starts spinning.
 *   3. Call `stopRecordingAfterReveal()` when the winner is determined —
 *      this lets the reveal animation run for 4.5 s before stopping (ISSUE-091).
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

  /**
   * Start MediaRecorder. Phase must be set by the caller.
   * Call during "countdown" phase so the 3-2-1 anticipation is captured in the video.
   */
  const startRecording = useCallback(() => {
    if (recordingCanvasRef.current && canRecord(recordingCanvasRef.current)) {
      recorderRef.current.start(recordingCanvasRef.current)
    }
  }, [])

  /**
   * Enter reveal phase, then stop the recorder 4.5 s later.
   * 4.5 s covers the full WinnerCard Phase A animation (crown → name → reaction → amount).
   * Call this immediately when the wheel stops (handleSpinComplete).
   */
  const stopRecordingAfterReveal = useCallback(() => {
    setRecordingPhase("reveal")
    clearTimeout(revealTimerRef.current ?? undefined)
    revealTimerRef.current = setTimeout(async () => {
      setRecordingPhase("done")
      const blob = await recorderRef.current.stop()
      if (blob && blob.size > 0) setRecordedBlob(blob)
    }, 4500)
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
