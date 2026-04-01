"use client"

import { useEffect } from "react"

export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failure is non-critical — ignore
      })
    }
  }, [])

  return null
}
