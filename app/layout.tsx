import type { Metadata, Viewport } from 'next'
import { Inter, Noto_Sans_JP } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SwRegister } from '@/components/sw-register'
import './globals.css'

// ISSUE-208: next/font/google に移行（CDN フェッチ排除・FOUT 防止・self-host）
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-inter',
  display: 'swap',
})

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--font-noto-sans-jp',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://ogo-roulette.vercel.app'),
  title: 'OgoRoulette — おごりをルーレットで決めよう',
  description: '飲み会・合コン・社内ランチ。おごりを公平にルーレットで決める無料アプリ。QRコードでみんなで参加してワイワイ楽しもう。',
  keywords: ['おごり ルーレット', 'おごり決め アプリ', '飲み会 誰が払う アプリ', '割り勘 ルーレット', 'じゃんけん アプリ 無料', '順番決め ルーレット', '幹事 ツール 無料', 'QRコード ルーレット 飲み会', '合コン ゲーム アプリ', '割り勘 アプリ 無料', 'おごり 決め方 飲み会'],
  openGraph: {
    title: 'OgoRoulette — おごりをルーレットで決めよう',
    description: '飲み会・合コン・社内ランチ。おごりを公平にルーレットで決める無料アプリ。',
    url: 'https://ogo-roulette.vercel.app',
    siteName: 'OgoRoulette',
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OgoRoulette — おごりをルーレットで決めよう',
    description: '飲み会・合コン・社内ランチ。おごりを公平にルーレットで決める無料アプリ。',
    images: ['/opengraph-image'],
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
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className={`${inter.variable} ${notoSansJP.variable}`} suppressHydrationWarning>
      <head>
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
