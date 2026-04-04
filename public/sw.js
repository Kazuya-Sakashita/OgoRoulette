// OgoRoulette Service Worker — Tombstone (ISSUE-152)
//
// 旧 sw.js (v1) は HTML ページ（/ /home）と _next/static/ チャンクを
// cache-first でキャッシュしていた。デプロイ毎にチャンクハッシュが変わるため、
// 旧 HTML が古いチャンク URL を参照 → CDN から 404 → ChunkLoadError の根本原因。
//
// この tombstone SW はすべての旧キャッシュを削除し、
// 以降の fetch を一切キャッシュしない（ネットワーク直通）。

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

// fetch ハンドラなし — すべてのリクエストはネットワークに直通する
