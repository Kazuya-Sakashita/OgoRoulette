"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import jsQR from "jsqr"
import { Camera, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

type QrError = "permission_denied" | "no_camera" | "unknown"

interface QrScannerProps {
  onScan: (code: string) => void
  onError?: (error: QrError) => void
  active?: boolean
}

// ISSUE-089: <video> は常に DOM に存在させる。
// setStatus("loading") した瞬間に <video> が消えると videoRef.current = null になり、
// getUserMedia 成功後に srcObject を設定できず「起動中」のまま固着する。
// loading / error / scanning をオーバーレイで重ねる構造にして videoRef を常に有効にする。

export function QrScanner({ onScan, onError, active = true }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const scannedRef = useRef(false)
  const statusRef = useRef<"idle" | "loading" | "scanning" | "error">("idle")

  const [status, setStatus] = useState<"idle" | "loading" | "scanning" | "error">("idle")
  const [errorType, setErrorType] = useState<QrError | null>(null)

  const setStatusBoth = useCallback((s: "idle" | "loading" | "scanning" | "error") => {
    statusRef.current = s
    setStatus(s)
  }, [])

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const scan = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scan)
      return
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) {
      rafRef.current = requestAnimationFrame(scan)
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    })

    if (result && result.data && !scannedRef.current) {
      scannedRef.current = true
      stopCamera()
      if (navigator.vibrate) {
        navigator.vibrate(200)
      }
      onScan(result.data)
      return
    }

    rafRef.current = requestAnimationFrame(scan)
  }, [onScan, stopCamera])

  const startCamera = useCallback(async () => {
    scannedRef.current = false
    setStatusBoth("loading")
    setErrorType(null)

    // タイムアウト: 10秒以上 loading のままなら error に落とす
    const timeoutId = setTimeout(() => {
      if (statusRef.current === "loading") {
        setStatusBoth("error")
        setErrorType("unknown")
        stopCamera()
      }
    }, 10_000)

    try {
      // ISSUE-089: facingMode は exact 指定を避け ideal にする
      // "environment" の exact 指定は一部端末で OverconstrainedError を起こす
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      streamRef.current = stream

      const video = videoRef.current
      if (!video) {
        // ISSUE-089: video が null のときは error state に落とす（以前はサイレントリターン）
        stopCamera()
        setStatusBoth("error")
        setErrorType("unknown")
        return
      }

      video.srcObject = stream

      try {
        await video.play()
      } catch (playErr) {
        const e = playErr as DOMException
        // ISSUE-089: iOS Safari の autoplay ポリシーで AbortError が発生する場合がある
        // 短い待機の後に再試行する
        if (e.name === "AbortError") {
          await new Promise((r) => setTimeout(r, 150))
          await video.play()
        } else {
          throw e
        }
      }

      setStatusBoth("scanning")
      rafRef.current = requestAnimationFrame(scan)
    } catch (err) {
      const error = err as DOMException
      let type: QrError = "unknown"
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        type = "permission_denied"
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        type = "no_camera"
      }
      setErrorType(type)
      setStatusBoth("error")
      stopCamera()
      onError?.(type)
    } finally {
      clearTimeout(timeoutId)
    }
  }, [scan, stopCamera, onError, setStatusBoth])

  useEffect(() => {
    if (active) {
      startCamera()
    } else {
      stopCamera()
      setStatusBoth("idle")
    }

    return () => {
      stopCamera()
    }
  }, [active, startCamera, stopCamera, setStatusBoth])

  // ISSUE-089: <video> は常に DOM にマウントし、status に応じてオーバーレイを重ねる。
  // 以前は status ごとに別 UI を return していたため、loading/error 時に video 要素が
  // DOM から消えて videoRef.current = null になり、stream を設定できなかった。
  return (
    <div className="relative w-full aspect-square rounded-3xl overflow-hidden bg-black">
      {/* video は常にマウント — status が何であっても videoRef が有効 */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        autoPlay
        style={{ display: status === "scanning" ? "block" : "none" }}
      />
      {/* Hidden canvas for decoding */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ローディングオーバーレイ */}
      {(status === "loading" || status === "idle") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary rounded-3xl">
          {status === "loading" && (
            <>
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-3" />
              <p className="text-sm text-muted-foreground">カメラを起動中...</p>
            </>
          )}
        </div>
      )}

      {/* エラーオーバーレイ */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary rounded-3xl px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <Camera className="w-7 h-7 text-destructive" />
          </div>
          {errorType === "permission_denied" ? (
            <>
              <p className="text-sm font-medium text-foreground mb-2">
                カメラへのアクセスが許可されていません
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                設定アプリ &gt; Safari（またはChrome）&gt; カメラ から許可してください
              </p>
            </>
          ) : errorType === "no_camera" ? (
            <>
              <p className="text-sm font-medium text-foreground mb-2">
                カメラが見つかりません
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                コード入力タブからルームに参加できます
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground mb-2">
                カメラを起動できませんでした
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                もう一度お試しください
              </p>
            </>
          )}
          {errorType !== "permission_denied" && (
            <Button
              onClick={startCamera}
              variant="outline"
              size="sm"
              className="border-white/10 bg-white/5 text-foreground"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              再試行
            </Button>
          )}
        </div>
      )}

      {/* ビューファインダー（スキャン中のみ） */}
      {status === "scanning" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-52 h-52">
            <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
            <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
            <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
            <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/70 animate-scan-line" />
          </div>
        </div>
      )}
    </div>
  )
}
