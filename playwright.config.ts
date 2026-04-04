import { defineConfig, devices } from "@playwright/test"

/**
 * ISSUE-191: E2E テスト設定
 *
 * 実行方法:
 *   pnpm test:e2e          — すべての E2E テストを実行
 *   pnpm test:e2e --ui     — Playwright UI で対話的に実行
 *
 * CI では webServer が自動起動するため、事前に `pnpm dev` を起動する必要はない。
 * ローカルでは既存の dev server があれば再利用される（reuseExistingServer: true）。
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
