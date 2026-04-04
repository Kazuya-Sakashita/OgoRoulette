/**
 * ISSUE-180: open redirect 脆弱性の根絶
 *
 * returnTo / next パラメータを自サービスの相対パスのみに制限する。
 * 以下の攻撃パターンを防ぐ:
 *   - プロトコル相対URL: //evil.com
 *   - URL エンコード:    %2F%2Fevil.com
 *   - バックスラッシュ:  /\evil.com
 *   - 外部URLそのまま:  https://evil.com
 */

const APP_HOSTNAME = "ogo-roulette.vercel.app"
const DEFAULT_PATH = "/home"

export function validateReturnTo(value: string | null | undefined): string {
  if (!value || typeof value !== "string") return DEFAULT_PATH
  try {
    // URL デコードして隠れた攻撃を展開
    const decoded = decodeURIComponent(value)
    // 相対パスでなければ拒否
    if (!decoded.startsWith("/")) return DEFAULT_PATH
    // プロトコル相対URL を拒否
    if (decoded.startsWith("//")) return DEFAULT_PATH
    // バックスラッシュによるパス偽装を拒否
    if (decoded.startsWith("/\\")) return DEFAULT_PATH
    // ダミーベースで URL パースしてホストが自サービス以外に変わる場合は拒否
    const url = new URL(decoded, `https://${APP_HOSTNAME}`)
    if (url.hostname !== APP_HOSTNAME) return DEFAULT_PATH
    // 異常に長いパスはサニティチェックで拒否
    if (decoded.length > 300) return DEFAULT_PATH
    return decoded
  } catch {
    return DEFAULT_PATH
  }
}
