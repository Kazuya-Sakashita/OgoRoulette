import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'OgoRoulette の使い方 — 3ステップでおごりをルーレット決定',
  description: 'ルームを作ってQRコードを共有。全員が揃ったらルーレットを回すだけ。ログイン不要・無料・スマホだけで使えるおごり決めアプリの使い方ガイド。',
  keywords: ['おごり ルーレット 使い方', 'おごり決め アプリ 使い方', '飲み会 割り勘 ルーレット やり方', 'QRコード ルーレット 使い方', 'OgoRoulette 使い方'],
  openGraph: {
    title: 'OgoRoulette の使い方 — 3ステップでおごりをルーレット決定',
    description: 'ログイン不要・無料。スマホだけで飲み会のおごりをルーレットで公平に決められます。',
    url: 'https://ogo-roulette.vercel.app/how-to-use',
    siteName: 'OgoRoulette',
    locale: 'ja_JP',
    type: 'website',
  },
  alternates: {
    canonical: 'https://ogo-roulette.vercel.app/how-to-use',
  },
}

const howToSchema = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'OgoRoulette の使い方 — 3ステップでおごりを決める',
  description: '飲み会・合コン・社内ランチで誰がおごるかをルーレットで公平に決める方法',
  step: [
    {
      '@type': 'HowToStep',
      position: 1,
      name: 'メンバーを集める',
      text: 'ルームを作って招待コードか QR コードを共有するだけ。みんなが揃ったら準備完了。',
    },
    {
      '@type': 'HowToStep',
      position: 2,
      name: '運命を回す',
      text: 'オーナーが「運命を回す」ボタンを押す。全員が同じ画面を見ながらドキドキして待つ。',
    },
    {
      '@type': 'HowToStep',
      position: 3,
      name: '結果が決まる',
      text: '針が止まった瞬間、全員の画面に同時に結果が表示される。',
    },
  ],
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'ログインは必要ですか？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'ログイン不要でそのままご利用いただけます。名前を入力するだけでルームに参加できます。',
      },
    },
    {
      '@type': 'Question',
      name: '無料で使えますか？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '完全無料でご利用いただけます。アプリのインストールも不要で、ブラウザだけで動作します。',
      },
    },
    {
      '@type': 'Question',
      name: 'スマホだけで使えますか？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'スマートフォンのブラウザだけで利用できます。iOS・Android の両方に対応しています。',
      },
    },
    {
      '@type': 'Question',
      name: '何人まで参加できますか？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '2人以上であれば何人でも参加できます。QRコードを共有するだけで全員がすぐに参加できます。',
      },
    },
    {
      '@type': 'Question',
      name: 'おごり以外の用途にも使えますか？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '順番決め・担当決め・罰ゲームの割り当て・プレゼント幹事の発表など、公平にランダム選出が必要な場面で広く活用できます。',
      },
    },
  ],
}

export default function HowToUseLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {children}
    </>
  )
}
