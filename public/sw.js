// OgoRoulette Service Worker — ISSUE-164
// Strategy: cache-first for static assets, network-only for API

const CACHE_VERSION = 'v1'
const CACHE_NAME = `ogoroulette-${CACHE_VERSION}`

const PRECACHE_URLS = [
  '/',
  '/home',
  '/manifest.json',
  '/images/logo-icon.png',
  '/images/icon-192.png',
  '/images/icon-512.png',
]

// Install: precache key assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {
        // Some precache URLs may fail in some environments — ignore gracefully
      })
    )
  )
  self.skipWaiting()
})

// Activate: remove old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('ogoroulette-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// Fetch: network-only for API/auth, cache-first for everything else
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Always use network for API, auth, analytics
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.hostname.includes('vercel-insights') ||
    url.hostname.includes('supabase')
  ) {
    return
  }

  // Cache-first with network fallback for static assets
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          // Cache successful responses for static assets
          if (
            response.ok &&
            (url.pathname.startsWith('/_next/static/') ||
              url.pathname.startsWith('/images/'))
          ) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        }).catch(() => {
          // Offline fallback: return cached home page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/home') || caches.match('/')
          }
        })
      })
    )
  }
})
