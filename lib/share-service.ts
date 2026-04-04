/**
 * share-service.ts
 *
 * Unified share layer for OgoRoulette.
 * Abstracts SNS platform differences and provides message templates.
 *
 * Platform constraints:
 *   X (Twitter) : text + URL only, 280 chars total (URL = 23 chars), no video via intent
 *   LINE        : text + URL only, no video via intent
 *   Web Share API: can share video files (iOS 15+ / Android Chrome); MP4 on iOS
 */

export interface SharePayload {
  winner: string
  winnerColor?: string
  participants?: string[]
  totalBill?: number
  treatAmount?: number
  roomName?: string
  videoBlob?: Blob | null
  // ISSUE-094: room code so /result page can offer "join this group" CTA
  roomCode?: string
}

export interface ShareTemplate {
  id: string
  label: string
  build: (payload: SharePayload) => string
}

/** URL counts as 23 chars on X regardless of actual length */
const X_URL_COST = 23
const X_CHAR_LIMIT = 280

export const SHARE_TEMPLATES: ShareTemplate[] = [
  {
    id: "classic",
    label: "定番",
    build: ({ winner }) =>
      `🎰 OgoRouletteで${winner}さんが奢りに決定！ #OgoRoulette`,
  },
  {
    id: "dramatic",
    label: "ドラマチック",
    build: ({ winner }) =>
      `運命のルーレットが回った… 止まった先には ${winner} さんの名前が！🎡✨ 今日は ${winner} さんのおかげで最高のランチ確定！ #OgoRoulette #おごり`,
  },
  {
    id: "roast",
    label: "いじり",
    build: ({ winner }) =>
      `${winner} さん、ついに来ましたね😏🎰 神のお告げです。本日の奢り担当は ${winner} さんに決定しました。ご清算をお願いします🙏 #OgoRoulette`,
  },
  {
    id: "bill",
    label: "金額付き",
    build: ({ winner, totalBill, treatAmount }) => {
      const fmt = (n: number) =>
        new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(n)
      if (typeof totalBill === "number" && totalBill > 0) {
        const treat = treatAmount ?? totalBill
        return `🎰 ${winner}さんが奢り担当に！ ${fmt(treat)}をご負担いただきます🙏 ごちそうさまです！ #OgoRoulette`
      }
      return `🎰 OgoRouletteで${winner}さんが奢りに決定！ #OgoRoulette`
    },
  },
  {
    id: "group",
    label: "グループ",
    build: ({ winner, participants }) => {
      const count = (participants?.length ?? 0)
      const suffix = count > 1 ? `${count}人の中から` : ""
      return `🎰 ${suffix}${winner}さんが今日のスポンサーに選ばれました！ 太っ腹な${winner}さん、ごちそうさまです🎉 #OgoRoulette`
    },
  },
]

export function buildShareUrl(payload: SharePayload): string {
  if (typeof window === "undefined") return ""

  // ISSUE-183: ルームコードがある場合はウイルスループURL（/join?room=...&ref=share）を使用。
  // タップした人がそのままルームに参加できる導線になる。
  if (payload.roomCode) {
    const params = new URLSearchParams()
    params.set("room", payload.roomCode)
    params.set("ref", "share")
    params.set("winner", payload.winner)
    return `${window.location.origin}/join?${params.toString()}`
  }

  const params = new URLSearchParams()
  // result/_result-content.tsx reads "treater"; OGP metadata reads "winner" || "treater"
  params.set("treater", payload.winner)
  params.set("winner", payload.winner)
  if (payload.winnerColor) params.set("color", payload.winnerColor)
  if (payload.participants?.length) params.set("participants", payload.participants.join(","))
  if (payload.totalBill) params.set("total", String(payload.totalBill))
  if (payload.treatAmount) params.set("treat", String(payload.treatAmount))
  return `${window.location.origin}/result?${params.toString()}`
}

export function buildShareText(template: ShareTemplate, payload: SharePayload): string {
  return template.build(payload)
}

/** X は CJK・絵文字を 2 weight としてカウントする（Unicode拡張ブロック以上を2とする） */
function xCharWeight(char: string): number {
  const cp = char.codePointAt(0) ?? 0
  // Basic Latin + Latin supplement は 1、それ以外（CJK・絵文字等）は 2
  return cp > 0x007E ? 2 : 1
}

/** Trim text so text + URL fits within X's 280-char limit */
export function trimForX(text: string): string {
  // +1 for the space between text and URL
  const budget = X_CHAR_LIMIT - X_URL_COST - 1
  let weight = 0
  let result = ""
  for (const char of [...text]) {
    const w = xCharWeight(char)
    if (weight + w > budget) return result + "…"
    weight += w
    result += char
  }
  return result
}

/**
 * Share to X (Twitter).
 *
 * ISSUE-097: If a blob is provided, auto-download it first so the user can
 * manually attach the video/image to the tweet. X's web intent doesn't support
 * file uploads, so this is the best UX we can offer on desktop/Android.
 */
export function shareToX(text: string, url: string, blob?: Blob | null, winner?: string): void {
  const trimmed = trimForX(text)
  // ISSUE-097: Auto-download the recording so the user can attach it to the tweet
  if (blob && blob.size > 0) {
    downloadVideo(blob, winner ?? "share")
  }
  // ISSUE-083: window.open(_blank) はモバイル Chrome で about:blank タブを残す。
  // location.href で同一タブ遷移にすることでユーザーが「戻る」で元ページへ戻れる。
  window.location.href =
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(trimmed)}&url=${encodeURIComponent(url)}`
}

export function shareToLine(text: string, url: string): void {
  // ISSUE-083: 同上
  window.location.href =
    `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
}

export type ShareWithFileResult = "success" | "fallback_url" | "fallback_clipboard" | "cancelled"

/**
 * Share content using Web Share API with priority:
 *  1. Share video file (iOS 15+ / Android Chrome)
 *  2. Share URL + text
 *  3. Copy to clipboard
 */
export async function shareWithFile(
  payload: SharePayload,
  text: string,
  url: string
): Promise<ShareWithFileResult> {
  const title = `${payload.winner}さんが今日の奢り担当！`

  if (payload.videoBlob) {
    // ISSUE-103: PNG fallback on iOS has type="image/png" — handle image/* separately
    const blobType = payload.videoBlob.type
    const ext = blobType.startsWith("image/")
      ? (blobType.split("/")[1]?.split(";")[0] ?? "png")
      : blobType.includes("mp4") ? "mp4" : "webm"
    const file = new File([payload.videoBlob], `ogoroulette_${payload.winner}.${ext}`, {
      type: payload.videoBlob.type,
    })

    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title, text })
        return "success"
      } catch (e) {
        if ((e as Error).name === "AbortError") return "cancelled"
        // fall through to URL share
      }
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return "fallback_url"
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled"
    }
  }

  await navigator.clipboard.writeText(`${text}\n${url}`).catch(() => {})
  return "fallback_clipboard"
}

export function downloadVideo(blob: Blob, winner: string): void {
  // ISSUE-103: PNG fallback on iOS has type="image/png"
  const ext = blob.type.startsWith("image/")
    ? (blob.type.split("/")[1]?.split(";")[0] ?? "png")
    : blob.type.includes("mp4") ? "mp4" : "webm"
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `ogoroulette_${winner}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}
