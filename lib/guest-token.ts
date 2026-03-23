import { createHmac, timingSafeEqual } from "crypto"

// WHAT: ゲストホストトークンの署名・検証
// WHY:  X-Guest-Host-Token に RoomMember.id（UUID）をそのまま使うと、
//       GET /api/rooms/[code] でメンバー ID を取得した攻撃者がホストになりすませる。
//       HMAC-SHA256 で署名することで、シークレットなしにトークンを偽造できなくする。
// HOW:  HMAC-SHA256(GUEST_HOST_SECRET, memberId + ":" + roomCode) の hex digest をトークンとする。

const SECRET = process.env.GUEST_HOST_SECRET

/**
 * ゲストホストトークンを生成する。
 * @param memberId - RoomMember.id（UUID）
 * @param roomCode - 招待コード（大文字）
 */
export function signGuestToken(memberId: string, roomCode: string): string {
  if (!SECRET) throw new Error("GUEST_HOST_SECRET is not configured")
  return createHmac("sha256", SECRET)
    .update(`${memberId}:${roomCode}`)
    .digest("hex")
}

/**
 * ゲストホストトークンを検証する。
 * @returns true if valid, false otherwise (including when SECRET is missing)
 */
export function verifyGuestToken(token: string, memberId: string, roomCode: string): boolean {
  if (!SECRET) return false
  try {
    const expected = createHmac("sha256", SECRET)
      .update(`${memberId}:${roomCode}`)
      .digest("hex")
    const tokenBuf = Buffer.from(token.padEnd(64, "0"), "hex")
    const expectedBuf = Buffer.from(expected, "hex")
    if (tokenBuf.length !== expectedBuf.length) return false
    return timingSafeEqual(tokenBuf, expectedBuf)
  } catch {
    return false
  }
}
