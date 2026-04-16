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
  // CSP は Next.js の動的スクリプト（runtime / Framer Motion）と競合するため別途対応
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
        ],
      },
    ]
  },
}

export default nextConfig
