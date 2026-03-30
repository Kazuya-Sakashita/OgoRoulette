"use client"

/**
 * use-pwa-install.ts — ISSUE-101
 *
 * Captures the `beforeinstallprompt` event so the app can show a custom
 * "Add to home screen" prompt at the right moment instead of the browser's
 * unsolicited banner.
 *
 * Usage:
 *   const { canInstall, promptInstall } = usePWAInstall()
 *   if (canInstall) <button onClick={promptInstall}>ホーム画面に追加</button>
 *
 * Platform notes:
 *   - Chrome Android / Chrome Desktop: fires beforeinstallprompt ✅
 *   - Safari iOS: does NOT fire this event (Add to Home Screen is manual) ❌
 *   - Firefox: fires in some versions ✅
 */

import { useEffect, useState, useCallback } from "react"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [canInstall, setCanInstall] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Already running as a PWA — don't show the prompt
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setCanInstall(true)
    }

    window.addEventListener("beforeinstallprompt", handler)
    window.addEventListener("appinstalled", () => {
      setInstalled(true)
      setCanInstall(false)
      setDeferredPrompt(null)
    })

    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setInstalled(true)
      setCanInstall(false)
    }
    setDeferredPrompt(null)
  }, [deferredPrompt])

  return { canInstall, promptInstall, installed }
}
