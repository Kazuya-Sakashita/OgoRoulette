import type { Metadata } from "next"
import { ResultContent } from "./_result-content"

interface Props {
  searchParams: Promise<{
    winner?: string
    color?: string
    amount?: string
    treater?: string
    // ISSUE-189: participants はシェアURL から渡るカンマ区切り文字列
    participants?: string
  }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams
  const winner = params.winner || params.treater || ""
  const color = params.color || "#F97316"
  const amount = params.amount || ""
  // ISSUE-189: 参加者数を OGP 画像に渡す（2人以上の場合のみ）
  const participantCount = params.participants
    ? params.participants.split(",").filter(Boolean).length
    : 0

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ogo-roulette.vercel.app"
  const ogImageUrl =
    `${baseUrl}/api/og` +
    `?winner=${encodeURIComponent(winner)}` +
    `&color=${encodeURIComponent(color)}` +
    (amount ? `&amount=${encodeURIComponent(amount)}` : "") +
    (participantCount > 1 ? `&count=${participantCount}` : "")

  const title = winner
    ? `${winner}さんが今日の奢り神様！ - OgoRoulette`
    : "OgoRoulette - 支払い結果"

  const description = winner
    ? `🎰 OgoRouletteで${winner}さんが奢りに決定！`
    : "🎰 OgoRouletteでルーレットが決定しました！"

  return {
    title,
    description,
    openGraph: {
      title: winner ? `${winner}さんが今日の奢り神様！` : "OgoRoulette",
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: winner ? `${winner}さんが今日の奢り神様！` : "OgoRoulette",
      description,
      images: [ogImageUrl],
    },
  }
}

export default function ResultPage() {
  return <ResultContent />
}
