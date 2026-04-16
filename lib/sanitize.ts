/**
 * sanitize.ts — ユーザー入力のサニタイズユーティリティ
 *
 * ISSUE-244: ゲスト名・メンバー名の制御文字・ゼロ幅文字を除去する。
 *
 * ■ 除去する文字
 *   - ASCII 制御文字 (U+0000–U+001F, U+007F)
 *   - ゼロ幅文字 (U+200B, U+200C, U+200D, U+200E, U+200F)
 *   - BOM / 書式制御 (U+FEFF, U+2060–U+2063)
 *
 * ■ 除去しない文字
 *   - HTML 特殊文字 (<, >, &, ", ') — React が JSX で自動エスケープするため不要
 *   - 絵文字・CJK・全角記号 — 飲み会シーンで名前として使われる
 *
 * @param input - 生の入力文字列
 * @returns 制御文字を除去してトリムした文字列
 */
export function sanitizeName(input: string): string {
  return input
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\uFEFF\u2060-\u2063]/g, "")
    .trim()
}
