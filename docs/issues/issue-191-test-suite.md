# テストスイート構築（Vitest + Playwright）

## 背景

ISSUE-184 でカスタムフック化（`useRoomSync` / `useSpin` / `useBill`）を実施したが、これらのロジックに対するユニットテストが存在しない。また `lib/` 配下の純粋関数（`share-card-generator.ts` / `group-storage.ts` / `share-service.ts` など）もテスト未実施。バグ発生時の原因特定が困難で、リファクタリング時の安全網がない。

## 問題

- ユニットテストが 0 件（テストフレームワーク未導入）
- E2E テストが 0 件（Playwright 未導入）
- 主要ロジック（スピン・グループ管理・シェア）のリグレッション検知ができない
- ISSUE-190 で追加する analytics イベントが正しく発火するかを確認する手段がない

## 目的

- コアロジックの信頼性を担保するユニットテストを整備する
- 主要ユーザーフロー（ホーム → スピン → 結果 → シェア）を E2E で保護する
- リファクタリング・機能追加の安全網を構築する

## 対応内容

### Step 1: Vitest 導入（ユニットテスト）

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
})
```

### Step 2: ユニットテスト対象

| テストファイル | テスト対象 | 主要ケース |
|-------------|---------|---------|
| `tests/unit/group-storage.test.ts` | `lib/group-storage.ts` | グループ保存・読込・更新・削除・lastSpinAt |
| `tests/unit/share-service.test.ts` | `lib/share-service.ts` | `buildShareUrl` のルームコード有無 |
| `tests/unit/analytics.test.ts` | `lib/analytics.ts` | `trackEvent` が `window.va` を呼ぶか |
| `tests/unit/safe-redirect.test.ts` | `lib/safe-redirect.ts` | 外部URLリダイレクト防御 |

```typescript
// tests/unit/group-storage.test.ts（例）
import { saveGroup, loadGroups, updateGroupLastSpin } from "@/lib/group-storage"

describe("group-storage", () => {
  beforeEach(() => localStorage.clear())

  it("saves and loads a group", () => {
    saveGroup("チームA", ["太郎", "花子"])
    const groups = loadGroups()
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe("チームA")
  })

  it("records lastSpinAt and lastWinner", () => {
    saveGroup("チームA", ["太郎"])
    const id = loadGroups()[0].id
    updateGroupLastSpin(id, "太郎")
    const updated = loadGroups()[0]
    expect(updated.lastWinner).toBe("太郎")
    expect(updated.lastSpinAt).toBeGreaterThan(0)
  })
})
```

### Step 3: Playwright 導入（E2E テスト）

```bash
npm install -D @playwright/test
npx playwright install chromium
```

```typescript
// playwright.config.ts
import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
})
```

### Step 4: E2E テスト対象

```typescript
// tests/e2e/home.spec.ts
test("ホーム画面が表示され、メンバー入力でスピンできる", async ({ page }) => {
  await page.goto("/home")
  await expect(page.locator("h1")).toContainText("OgoRoulette")
  // メンバー入力 → スピン → 結果確認
})

// tests/e2e/share.spec.ts
test("結果画面でシェアボタンが表示される", async ({ page }) => {
  // 結果画面への直接アクセス
  await page.goto("/result?winner=テスト&participants=A,B,C")
  await expect(page.locator("text=シェアする")).toBeVisible()
})
```

### Step 5: package.json スクリプト追加

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:all": "vitest run && playwright test"
  }
}
```

## 完了条件

- [ ] `npm test` でユニットテストが実行される
- [ ] `group-storage` / `share-service` / `safe-redirect` のユニットテストが全パス
- [ ] `npm run test:e2e` でホーム画面 E2E テストがパス
- [ ] CI（GitHub Actions）でプルリク時にテストが自動実行される
- [ ] `npm run build` でエラーなし

## 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `vitest.config.ts` | 新規作成 |
| `playwright.config.ts` | 新規作成 |
| `tests/setup.ts` | テスト共通セットアップ |
| `tests/unit/*.test.ts` | ユニットテスト群（新規） |
| `tests/e2e/*.spec.ts` | E2E テスト群（新規） |
| `package.json` | test スクリプト追加・devDependencies 追加 |

## リスク

低〜中。
- テストコード自体はプロダクションに影響しない
- E2E はローカル環境依存（ポート競合に注意）
- Playwright のブラウザダウンロードに時間がかかる（CI での初回セットアップ）

## ステータス

**完了** — 2026-04-05

## 優先度

**Nice-to-have** — 機能追加フェーズが一段落してから着手。ISSUE-190（Analytics）実装後のリグレッション防止に有効。

## 期待効果

- バグ発生時の原因特定コスト削減
- リファクタリング時の安全網
- チーム開発への移行時の品質担保基盤

## 関連ISSUE

- issue-184（play/page.tsx フック分割）
- issue-190（Analytics イベント体系）
