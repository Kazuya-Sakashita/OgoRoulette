import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"

export const runtime = "edge"

// Load Noto Sans JP subset from Google Fonts CSS API.
// The `text` param tells Google to return only the glyphs we actually need,
// keeping the response tiny (~5-15 KB vs several MB for the full font).
async function loadFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const cssRes = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${encodeURIComponent(text)}`,
      {
        headers: {
          // Modern Chrome UA → Google returns WOFF2 (supported by satori 0.10+)
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      }
    )
    const css = await cssRes.text()
    // Extract the first src URL from the CSS response
    const urlMatch = css.match(/src:\s*url\(([^)]+)\)/)
    if (!urlMatch) return null
    const fontRes = await fetch(urlMatch[1])
    return fontRes.arrayBuffer()
  } catch {
    // Font load failure: fall back to default sans-serif (Latin glyphs only)
    return null
  }
}

// GET /api/og?winner=田中&color=%23F97316&amount=15000
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const winner = searchParams.get("winner") || "???"
  const color = searchParams.get("color") || "#F97316"
  const amount = searchParams.get("amount")

  const amountNum = amount ? Number(amount) : null
  const formattedAmount =
    amountNum !== null && !isNaN(amountNum)
      ? `¥${amountNum.toLocaleString("ja-JP")}`
      : null

  // Build the complete text for font subsetting — only include unique chars
  const allText = `今日の奢り神様さん奢りOgoRoulette${winner}${formattedAmount ?? ""}`
  const fontData = await loadFont(allText)

  const fonts = fontData
    ? [
        {
          name: "Noto Sans JP",
          data: fontData,
          weight: 700 as const,
          style: "normal" as const,
        },
      ]
    : []

  const fontFamily = fonts.length > 0 ? '"Noto Sans JP", sans-serif' : "sans-serif"

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B1B2B",
          position: "relative",
          overflow: "hidden",
          fontFamily,
        }}
      >
        {/* Background radial glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse at center, ${color}44 0%, ${color}18 38%, transparent 65%)`,
          }}
        />

        {/* Decorative corner particles */}
        {(
          [
            { top: "48px", left: "72px", size: 14, opacity: 0.55 },
            { top: "88px", left: "44px", size: 9, opacity: 0.35 },
            { top: "60px", right: "80px", size: 12, opacity: 0.45 },
            { bottom: "72px", left: "64px", size: 10, opacity: 0.4 },
          ] as Array<{
            top?: string
            bottom?: string
            left?: string
            right?: string
            size: number
            opacity: number
          }>
        ).map((dot, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: dot.size,
              height: dot.size,
              borderRadius: "50%",
              background: color,
              opacity: dot.opacity,
              top: dot.top,
              bottom: dot.bottom,
              left: dot.left,
              right: dot.right,
            }}
          />
        ))}

        {/* Crown */}
        <div
          style={{
            fontSize: "88px",
            lineHeight: 1,
            marginBottom: "12px",
          }}
        >
          👑
        </div>

        {/* Avatar circle */}
        <div
          style={{
            width: "136px",
            height: "136px",
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${color}, ${color}88)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "60px",
            fontWeight: 900,
            color: "#0B1B2B",
            marginBottom: "24px",
            border: "5px solid rgba(255,255,255,0.28)",
            boxShadow: `0 0 80px ${color}55`,
            fontFamily,
          }}
        >
          {winner.charAt(0)}
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "26px",
            color: "rgba(255,255,255,0.45)",
            marginBottom: "10px",
            letterSpacing: "0.04em",
            fontFamily,
          }}
        >
          今日の奢り神様
        </div>

        {/* Winner name */}
        <div
          style={{
            fontSize: "84px",
            fontWeight: 900,
            color: "white",
            lineHeight: 1.1,
            textShadow: `0 0 60px ${color}`,
            fontFamily,
          }}
        >
          {winner}さん
        </div>

        {/* Amount badge */}
        {formattedAmount && (
          <div
            style={{
              marginTop: "20px",
              padding: "10px 28px",
              borderRadius: "32px",
              background: `${color}30`,
              border: `2px solid ${color}60`,
              fontSize: "36px",
              fontWeight: 700,
              color: color,
              fontFamily,
            }}
          >
            {formattedAmount} 奢り
          </div>
        )}

        {/* Bottom branding */}
        <div
          style={{
            position: "absolute",
            bottom: "32px",
            right: "44px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "22px",
            color: "rgba(255,255,255,0.35)",
            fontWeight: 600,
            fontFamily,
          }}
        >
          🎰 OgoRoulette
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts }
  )
}
