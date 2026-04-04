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
}

export default nextConfig
