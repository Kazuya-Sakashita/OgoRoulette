import { test, expect } from "@playwright/test"

/**
 * LP（ランディングページ）の E2E テスト
 *
 * WHY: LP は認証不要でアクセス可能なため、CI でも確実に実行できる。
 *      OGP / SEO の観点からも正しくレンダリングされることを保証する。
 */

test.describe("LP (/lp)", () => {
  test("LP ページが表示される", async ({ page }) => {
    await page.goto("/lp")
    // タイトルに OgoRoulette が含まれる
    await expect(page).toHaveTitle(/OgoRoulette/i)
  })

  test("CTA ボタンが存在する", async ({ page }) => {
    await page.goto("/lp")
    // 「無料で始める」または「今すぐ始める」などのCTAが1つ以上ある
    const cta = page.locator("a[href='/home'], a[href='/login']").first()
    await expect(cta).toBeVisible()
  })

  test("OGP メタタグが設定されている", async ({ page }) => {
    await page.goto("/lp")
    const ogTitle = page.locator("meta[property='og:title']")
    await expect(ogTitle).toHaveCount(1)
  })
})
