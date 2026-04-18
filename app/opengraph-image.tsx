import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "OgoRoulette — おごりをルーレットで決めよう"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image() {
  // Noto Sans JP を Google Fonts CDN から取得（Satori で日本語を描画するために必要）
  let fontData: ArrayBuffer | undefined
  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&display=swap",
      {
        headers: {
          // IE9 UA → Google returns WOFF (satori edge runtime does not support WOFF2 decompression)
          "User-Agent": "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)",
        },
      }
    ).then((r) => r.text())

    const fontUrl = css.match(/src: url\(([^)]+)\) format/)?.[1]
    if (fontUrl) {
      fontData = await fetch(fontUrl).then((r) => r.arrayBuffer())
    }
  } catch {
    // フォント取得失敗時はシステムフォントで描画（日本語が豆腐になる可能性あり）
  }

  try {
  const imgRes = new ImageResponse(
    (
      <div
        style={{
          background: "#0B1B2B",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        {/* 背景グロー — 左 */}
        <div
          style={{
            position: "absolute",
            top: "5%",
            left: "-8%",
            width: 620,
            height: 620,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(249,115,22,0.20) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* 背景グロー — 右 */}
        <div
          style={{
            position: "absolute",
            bottom: "5%",
            right: "-8%",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(236,72,153,0.14) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* ルーレット円 */}
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: "50%",
            border: "5px solid rgba(249,115,22,0.55)",
            background:
              "linear-gradient(135deg, rgba(249,115,22,0.18) 0%, rgba(236,72,153,0.12) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* 絵文字はSatoriでクラッシュするためCSSルーレット記号で代替 */}
          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 900,
              color: "#F97316",
            }}
          >
            &#9679;
          </div>
        </div>

        {/* アプリ名 */}
        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 900,
            letterSpacing: "-2px",
            lineHeight: 1,
            marginBottom: 12,
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", color: "#ffffff" }}>Ogo</div>
          <div style={{ display: "flex", color: "#F97316" }}>Roulette</div>
        </div>

        {/* キャッチコピー（日本語） */}
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "rgba(255,255,255,0.80)",
            marginBottom: 10,
            position: "relative",
            zIndex: 1,
            display: "flex",
            letterSpacing: "0.02em",
          }}
        >
          おごりをルーレットで決めよう
        </div>

        {/* サブコピー */}
        <div
          style={{
            fontSize: 22,
            color: "rgba(255,255,255,0.45)",
            marginBottom: 36,
            position: "relative",
            zIndex: 1,
            display: "flex",
            letterSpacing: "0.04em",
          }}
        >
          飲み会・ランチ・社内イベントで大活躍
        </div>

        {/* 特徴タグ */}
        <div
          style={{
            display: "flex",
            gap: 14,
            position: "relative",
            zIndex: 1,
          }}
        >
          {[
            "全員の画面が同期",
            "公平に決まる",
            "割り勘も計算",
          ].map((label) => (
            <div
              key={label}
              style={{
                padding: "10px 22px",
                borderRadius: 24,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "rgba(255,255,255,0.75)",
                fontSize: 21,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                letterSpacing: "0.02em",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* URL ウォーターマーク */}
        <div
          style={{
            position: "absolute",
            bottom: 28,
            right: 40,
            fontSize: 18,
            color: "rgba(255,255,255,0.28)",
            display: "flex",
          }}
        >
          ogo-roulette.vercel.app
        </div>
      </div>
    ),
    {
      ...size,
      ...(fontData
        ? {
            fonts: [
              {
                name: "Noto Sans JP",
                data: fontData,
                style: "normal",
                weight: 700,
              },
            ],
          }
        : {}),
    }
  )
  const buf = await imgRes.arrayBuffer()
  return new Response(buf, {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=86400, immutable" },
  })
  } catch (err) {
    console.error("[opengraph-image] ImageResponse failed:", err)
    return new Response("OG image generation failed", { status: 500 })
  }
}
