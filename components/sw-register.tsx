"use client"

import { useEffect } from "react"

export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    // 旧 sw.js (v1) が HTML + _next/static/ を cache-first でキャッシュしていたため
    // デプロイ後に ChunkLoadError が発生していた（ISSUE-152）。
    // tombstone sw.js を登録することで既存ユーザーのキャッシュを activate 時に全削除する。
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW 登録失敗は非致命的 — 無視する
    })

    // 万一 SW が旧バージョンのまま残存した場合のフォールバック:
    // ogoroulette- プレフィックスのキャッシュをクライアントサイドでも削除する
    if ("caches" in window) {
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("ogoroulette-"))
            .map((key) => caches.delete(key))
        )
      ).catch(() => {})
    }
  }, [])

  return null
}
