/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Google OAuth アバター
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // LINE OAuth アバター
      { protocol: "https", hostname: "profile.line-sc.com" },
      { protocol: "https", hostname: "obs.line-apps.com" },
      { protocol: "https", hostname: "**.line-scdn.net" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/lp.html",
        destination: "/lp",
        permanent: true,
      },
    ]
  },
  // ISSUE-257: セキュリティヘッダを全レスポンスに付与
  // ISSUE-263: CSP を追加（Next.js runtime / Framer Motion の要件に合わせたディレクティブ）
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Clickjacking 防止: iframe への埋め込みを完全禁止
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // MIME スニッフィング防止: Content-Type を厳密に遵守させる
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Referrer 漏洩防止: ?ref=share&winner= 等が外部ログに残るのを抑制
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // ブラウザ機能制限: マイク・位置情報を無効化
          // ※ camera は QR スキャン（/scan ページ）で navigator.mediaDevices.getUserMedia を使用するため除外
          {
            key: "Permissions-Policy",
            value: "microphone=(), geolocation=()",
          },
          // XSS 最終防衛ライン
          // script-src: Next.js hydration が unsafe-inline / unsafe-eval を必要とする
          //             Vercel Analytics スクリプト（va.vercel-scripts.com）を許可
          // style-src: Framer Motion がインライン style を生成するため unsafe-inline が必要
          // font-src: next/font/google はビルド時にセルフホスト（/_next/static/media/）
          //           Noto_Sans_JP 等の CJK フォントは unicode-range ごとに複数ファイルに分割されており
          //           Next.js が fonts.gstatic.com から追加サブセットを読み込む場合があるため許可
          //           data: は Next.js がフォントを data: URI として埋め込む場合のため追加
          // img-src: Next.js Image が data: URI を使用。OAuth アバター（Google/LINE）の外部ドメイン
          // connect-src: Supabase REST API + Realtime WebSocket
          //              Vercel Analytics データ送信先（vitals.vercel-insights.com）
          // media-src: MediaRecorder 録画動画の blob: playback
          // worker-src: blob: は Web Worker 用の保険
          // frame-ancestors: X-Frame-Options DENY と冗長防御
          // object-src: Flash / object タグを完全禁止
          // base-uri: <base> タグによる相対URL書き換えを防止
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://lh3.googleusercontent.com https://profile.line-sc.com https://obs.line-apps.com https://*.line-scdn.net",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default nextConfig
