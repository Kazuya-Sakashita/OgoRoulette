"use client"

import { useState, useEffect } from "react"

const SOUND_KEY = "ogoroulette_sound_enabled"

export function useSoundSetting() {
  const [soundEnabled, setSoundEnabled] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(SOUND_KEY)
    if (stored !== null) setSoundEnabled(stored === "true")
  }, [])

  const toggle = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    localStorage.setItem(SOUND_KEY, String(next))
  }

  return { soundEnabled, toggle }
}
