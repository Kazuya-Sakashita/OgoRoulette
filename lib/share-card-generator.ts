/**
 * share-card-generator.ts — ISSUE-183
 *
 * Canvas で 400×400px のブランド入り静止画シェアカードを生成する。
 * Server-side では動作しない（Canvas API は Browser のみ）。
 */

export async function generateShareCard(winner: string, color: string): Promise<Blob | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null

  const W = 400
  const H = 400
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  // ── 背景グラデーション ─────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, W, H)
  bgGrad.addColorStop(0, "#0F2236")
  bgGrad.addColorStop(1, "#0B1B2B")
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, W, H)

  // ── 勝者カラーのラジアルグロー ────────────────────────────
  const glowGrad = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, 200)
  glowGrad.addColorStop(0, color + "44")
  glowGrad.addColorStop(1, "transparent")
  ctx.fillStyle = glowGrad
  ctx.fillRect(0, 0, W, H)

  const FONT = "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif"

  // ── ブランド名 (上部) ─────────────────────────────────────
  ctx.fillStyle = "rgba(255,255,255,0.45)"
  ctx.font = `500 15px ${FONT}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("🎰 OgoRoulette", W / 2, 40)

  // ── アバター円 ────────────────────────────────────────────
  const cx = W / 2
  const cy = 155
  const r = 56
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  const avatarGrad = ctx.createRadialGradient(cx - 14, cy - 14, 4, cx, cy, r)
  avatarGrad.addColorStop(0, color)
  avatarGrad.addColorStop(1, color + "AA")
  ctx.fillStyle = avatarGrad
  ctx.fill()

  // アバター外縁グロー
  ctx.beginPath()
  ctx.arc(cx, cy, r + 5, 0, Math.PI * 2)
  ctx.strokeStyle = color + "55"
  ctx.lineWidth = 9
  ctx.stroke()

  // アバターイニシャル
  ctx.fillStyle = "#0B1B2B"
  ctx.font = `bold 46px ${FONT}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(winner.charAt(0).toUpperCase(), cx, cy + 2)

  // ── 勝者名 ────────────────────────────────────────────────
  ctx.fillStyle = "#FFFFFF"
  ctx.font = `bold 34px ${FONT}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const displayName = winner + "さん"
  ctx.fillText(displayName, W / 2, 248)

  // ── 奢り確定コピー ────────────────────────────────────────
  ctx.fillStyle = color
  ctx.font = `bold 24px ${FONT}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("奢り確定！🎉", W / 2, 291)

  // ── 区切り線 ─────────────────────────────────────────────
  ctx.beginPath()
  ctx.moveTo(70, 325)
  ctx.lineTo(330, 325)
  ctx.strokeStyle = "rgba(255,255,255,0.12)"
  ctx.lineWidth = 1
  ctx.stroke()

  // ── サブコピー ────────────────────────────────────────────
  ctx.fillStyle = "rgba(255,255,255,0.45)"
  ctx.font = `13px ${FONT}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("飲み会・ランチの奢り決めは OgoRoulette で", W / 2, 350)

  // ── URL ──────────────────────────────────────────────────
  ctx.fillStyle = "rgba(255,255,255,0.28)"
  ctx.font = `12px ${FONT}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("ogo-roulette.vercel.app", W / 2, 376)

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png")
  })
}
