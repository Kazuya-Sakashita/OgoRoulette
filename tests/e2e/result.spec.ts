import { test, expect } from "@playwright/test"

/**
 * 結果ページ（/result）の E2E テスト
 *
 * WHY: result ページはシェアフローの起点（ISSUE-181/183）。
 *      認証不要かつクエリパラメータだけで動作するため CI でも実行できる。
 *      シェアボタンの存在確認で Phase B CTA（ISSUE-181）のリグレッションを検出する。
 */

test.describe("結果ページ (/result)", () => {
  const RESULT_URL = "/result?winner=テスト太郎&participants=太郎,花子,鈴木&treater=テスト太郎"

  test("当選者名が表示される", async ({ page }) => {
    await page.goto(RESULT_URL)
    await expect(page.locator("text=テスト太郎")).toBeVisible()
  })

  test("シェアボタン（Phase B CTA）が表示される", async ({ page }) => {
    await page.goto(RESULT_URL)
    // 「シェアする」というテキストを含むボタンが存在する
    const shareBtn = page.locator("button", { hasText: /シェアする/i }).first()
    await expect(shareBtn).toBeVisible()
  })

  test("OGP title に当選者名が含まれる", async ({ page }) => {
    await page.goto(RESULT_URL)
    const title = await page.title()
    // generateMetadata で当選者名が title に入ること
    expect(title).toContain("テスト太郎")
  })
})
