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

export function QrScanner({ onScan, onError, active = true }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const scannedRef = useRef(false)

  const [status, setStatus] = useState<"idle" | "loading" | "scanning" | "error">("idle")
  const [errorType, setErrorType] = useState<QrError | null>(null)

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
    setStatus("loading")
    setErrorType(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      })
      streamRef.current = stream

      const video = videoRef.current
      if (!video) {
        stopCamera()
        return
      }

      video.srcObject = stream
      video.setAttribute("playsinline", "true")
      await video.play()

      setStatus("scanning")
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
      setStatus("error")
      onError?.(type)
    }
  }, [scan, stopCamera, onError])

  useEffect(() => {
    if (active) {
      startCamera()
    } else {
      stopCamera()
      setStatus("idle")
    }

    return () => {
      stopCamera()
    }
  }, [active, startCamera, stopCamera])

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center w-full aspect-square rounded-3xl bg-secondary border border-white/10">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-3" />
        <p className="text-sm text-muted-foreground">カメラを起動中...</p>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center w-full aspect-square rounded-3xl bg-secondary border border-white/10 px-6 text-center">
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
    )
  }

  return (
    <div className="relative w-full aspect-square rounded-3xl overflow-hidden bg-black">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />
      {/* Hidden canvas for decoding */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Viewfinder overlay */}
      {status === "scanning" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-52 h-52">
            {/* Corner brackets */}
            <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
            <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
            <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
            <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
            {/* Scan line animation */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/70 animate-scan-line" />
          </div>
        </div>
      )}
    </div>
  )
}
