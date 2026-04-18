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
          // IE9 UA → Google returns WOFF (satori edge runtime does not support WOFF2 decompression)
          "User-Agent": "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)",
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

// Satori は 8 桁 hex (#RRGGBBAA) 非対応のため rgba() に変換するヘルパー
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "")
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// GET /api/og?winner=田中&color=%23F97316&amount=15000&count=5
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const winner = searchParams.get("winner") || "???"
  // ISSUE-274: hex カラーのみ許可（CSS Injection 防止）
  const rawColor = searchParams.get("color") || "#F97316"
  const color = /^#[0-9a-fA-F]{3,6}$/.test(rawColor) ? rawColor : "#F97316"
  const amount = searchParams.get("amount")

  // ISSUE-189: 参加人数（シェアURL の participants からカウントして渡す）
  const countStr = searchParams.get("count")
  const count = countStr ? parseInt(countStr, 10) : null
  const validCount = count && !isNaN(count) && count > 1 ? count : null

  const amountNum = amount ? Number(amount) : null
  const formattedAmount =
    amountNum !== null && !isNaN(amountNum)
      ? `¥${amountNum.toLocaleString("ja-JP")}`
      : null

  // Build the complete text for font subsetting — only include unique chars
  const allText = `今日の奢り神様さん奢りOgoRoulette人の中から選ばれました${winner}${formattedAmount ?? ""}${validCount ? String(validCount) : ""}`
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

  try {
  // arrayBuffer() でレンダリングを完結させてからレスポンス送信する。
  // ImageResponse はストリームなので try-catch だけでは rendering エラーを捕まえられない。
  const imgRes = new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          // ISSUE-097: Use winner color for a more dramatic, brand-consistent gradient
          background: `linear-gradient(150deg, ${hexToRgba(color, 0.2)} 0%, #080F1C 40%, #080F1C 60%, ${hexToRgba(color, 0.15)} 100%)`,
          position: "relative",
          overflow: "hidden",
          fontFamily,
        }}
      >
        {/* Background radial glow */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            background: `radial-gradient(ellipse at 50% 55%, ${hexToRgba(color, 0.33)} 0%, ${hexToRgba(color, 0.16)} 42%, rgba(0,0,0,0) 68%)`,
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
              ...(dot.top !== undefined ? { top: dot.top } : {}),
              ...(dot.bottom !== undefined ? { bottom: dot.bottom } : {}),
              ...(dot.left !== undefined ? { left: dot.left } : {}),
              ...(dot.right !== undefined ? { right: dot.right } : {}),
            }}
          />
        ))}

        {/* Crown — 絵文字はSatoriでクラッシュするためCSS円で代替 */}
        <div
          style={{
            display: "flex",
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: hexToRgba(color, 0.2),
            border: `3px solid ${hexToRgba(color, 0.53)}`,
            marginBottom: "12px",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: color,
            }}
          />
        </div>

        {/* Avatar circle */}
        <div
          style={{
            width: "136px",
            height: "136px",
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${color}, ${hexToRgba(color, 0.53)})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "60px",
            fontWeight: 900,
            color: "#0B1B2B",
            marginBottom: "24px",
            border: "5px solid rgba(255,255,255,0.28)",
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

        {/* ISSUE-189: 参加人数バッジ（2人以上の場合のみ表示） */}
        {validCount && (
          <div
            style={{
              fontSize: "22px",
              color: "rgba(255,255,255,0.50)",
              marginBottom: "8px",
              letterSpacing: "0.03em",
              fontFamily,
              display: "flex",
            }}
          >
            {validCount}人の中から選ばれました
          </div>
        )}

        {/* Winner name */}
        <div
          style={{
            fontSize: "84px",
            fontWeight: 900,
            color: "white",
            lineHeight: 1.1,
            fontFamily,
          }}
        >
          {`${winner}さん`}
        </div>

        {/* Amount badge */}
        {formattedAmount && (
          <div
            style={{
              marginTop: "20px",
              padding: "10px 28px",
              borderRadius: "32px",
              background: hexToRgba(color, 0.19),
              border: `2px solid ${hexToRgba(color, 0.38)}`,
              fontSize: "36px",
              fontWeight: 700,
              color: color,
              fontFamily,
            }}
          >
            {`${formattedAmount} 奢り`}
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
          OgoRoulette
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts }
  )
  const buf = await imgRes.arrayBuffer()
  return new Response(buf, {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=3600, immutable" },
  })
  } catch (err) {
    console.error("[og] ImageResponse failed:", err)
    return new Response("OG image generation failed", { status: 500 })
  }
}
