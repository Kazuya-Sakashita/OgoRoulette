import { createHmac, timingSafeEqual } from "crypto"

// WHAT: ルーレット結果URLの署名・検証
// WHY:  /result?treater=xxx... は URL パラメータのみで構成されるため、
//       誰でも偽の結果ページを作成して共有できる。
//       HMAC-SHA256 で sessionId + winnerName に署名し、
//       正規の抽選結果であることをクライアントが検証できるようにする。
// HOW:  HMAC-SHA256(RESULT_TOKEN_SECRET, sessionId + ":" + winnerName)
//       の hex digest をトークンとし、result URL に token= として埋め込む。
//       /api/result-verify がサーバー側で再計算して一致を確認する。

const SECRET = process.env.RESULT_TOKEN_SECRET

export function signResultToken(sessionId: string, winnerName: string): string {
  if (!SECRET) throw new Error("RESULT_TOKEN_SECRET is not configured")
  return createHmac("sha256", SECRET)
    .update(`${sessionId}:${winnerName}`)
    .digest("hex")
}

export function verifyResultToken(token: string, sessionId: string, winnerName: string): boolean {
  if (!SECRET) return false
  if (typeof token !== "string" || token.length !== 64) return false
  try {
    const expected = createHmac("sha256", SECRET)
      .update(`${sessionId}:${winnerName}`)
      .digest("hex")
    const tokenBuf = Buffer.from(token, "hex")
    const expectedBuf = Buffer.from(expected, "hex")
    if (tokenBuf.length !== expectedBuf.length) return false
    return timingSafeEqual(tokenBuf, expectedBuf)
  } catch {
    return false
  }
}
