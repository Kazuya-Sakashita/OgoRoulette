import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { SwRegister } from '@/components/sw-register'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://ogo-roulette.vercel.app'),
  title: 'OgoRoulette — おごりをルーレットで決めよう',
  description: '飲み会・合コン・社内ランチ。おごりを公平にルーレットで決める無料アプリ。QRコードでみんなで参加してワイワイ楽しもう。',
  keywords: ['おごり', 'ルーレット', '割り勘', '飲み会', '合コン', 'QRコード'],
  openGraph: {
    title: 'OgoRoulette — おごりをルーレットで決めよう',
    description: '飲み会・合コン・社内ランチ。おごりを公平にルーレットで決める無料アプリ。',
    url: 'https://ogo-roulette.vercel.app',
    siteName: 'OgoRoulette',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'OgoRoulette — おごりをルーレットで決めよう',
      },
    ],
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OgoRoulette — おごりをルーレットで決めよう',
    description: '飲み会・合コン・社内ランチ。おごりを公平にルーレットで決める無料アプリ。',
    images: ['/images/og-image.png'],
  },
  icons: {
    icon: [
      {
        url: '/images/logo-icon.png',
        type: 'image/png',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/images/logo-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0B1B2B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        {/* Google Fonts — 直接 CDN から読み込み（next/font/google の Turbopack ビルド問題を回避） */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
        <SwRegister />
      </body>
    </html>
  )
}
