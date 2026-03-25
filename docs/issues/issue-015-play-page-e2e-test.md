# [ISSUE-015] プレイページのステートマシン全体に自動テストがなく、リグレッションを検出できない

## 🧩 概要

`app/room/[code]/play/page.tsx` は OgoRoulette の中核コンポーネントだが、`phase` ステートマシン（waiting → preparing → spinning → result → waiting）のフロー全体に自動テストが存在しない。ビジネスロジック（`bill-calculator`・`room-spin` 等）はテストされているが、最もバグが起きやすい UI ステート管理はテストされていない。

## 🚨 背景 / なぜ問題か

**現在テストされていないもの:**
- `handleSpin` の正常フロー
- `handleSpin` の API エラー時の phase リセット
- `isOwner` フリッカーによる phase 誤遷移（ISSUE-001 の再発防止）
- `spinScheduledRef` の競合（ISSUE-002 の再発防止）
- phase タイムアウト（ISSUE-003 の動作確認）
- `handleRespin` 後の状態遷移
- `handleSpinComplete` の呼び出しによる phase = "result" 遷移

**リスク:**
- ISSUE-001〜004 を修正しても、将来の変更で同じバグが再発するリスクがある
- 手動テストに依存しているため、変更のたびに全フローを人力で確認する必要がある

## 🎯 目的

`play/page.tsx` の `phase` ステートマシンの主要な状態遷移について、Vitest + React Testing Library を使った自動テストを追加する。リグレッションを検出できる安全網を作る。

## 🔍 影響範囲

- **対象ファイル:** `app/room/[code]/play/page.tsx`（テスト対象）
- **新規作成:** `app/room/[code]/play/page.test.tsx`

## 🛠 修正方針

**テストファイルの追加:**

```tsx
// app/room/[code]/play/page.test.tsx
import { render, act, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"

// fetch・Supabase・useVideoRecorder をモック
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }))
vi.mock("@/hooks/useVideoRecorder", () => ({ useVideoRecorder: () => ({ ... }) }))

describe("play/page SPIN state machine", () => {
  it("handles normal spin flow: waiting → preparing → spinning → result", async () => {
    // fetch モックで spin API 成功を返す
    // → phase が preparing になる
    // → setTimeout 後に spinning になる
    // → handleSpinComplete 呼び出しで result になる
  })

  it("resets phase to waiting when spin API returns error", async () => {
    // fetch モックで 409 を返す
    // → phase が waiting に戻る
    // → spinError が設定される
  })

  it("does not trigger member effect when isOwner=true", async () => {
    // isOwner=true の状態でメンバーエフェクトが phase を変更しないことを確認
  })

  it("resets phase after spinning timeout", async () => {
    // vi.useFakeTimers() で 7.5 秒経過をシミュレート
    // → phase が waiting に戻る
  })

  it("handles handleRespin: result → waiting", async () => {
    // phase=result の状態から handleRespin を呼ぶ
    // → phase が waiting になる
    // → reset API が呼ばれる
  })
})
```

## ⚠️ リスク / 副作用

- `play/page.tsx` は多くの外部依存（Supabase・fetch・Framer Motion・localStorage）を持つため、モックの設定が複雑
- Framer Motion の `animate()` は JSDOM 環境で動作しないためモックが必要
- テストの実行時間が増加する（Vitest は高速なため許容範囲）

## ✅ 確認項目

- [ ] 正常なスピンフロー（waiting → preparing → spinning → result）がテストされる
- [ ] API エラー時の phase リセットがテストされる
- [ ] ISSUE-001 の再発防止テスト（isOwner フリッカーシミュレーション）がある
- [ ] ISSUE-003 のタイムアウトがテストされる（`vi.useFakeTimers`）

## 🧪 テスト観点

テストケース一覧:
1. 正常スピンフロー
2. スピン API 500 エラー → phase reset
3. スピン API 409 エラー（既にスピン中）→ phase reset
4. clock skew シミュレーション（delay > MAX_DELAY）→ MAX_DELAY で spinning へ
5. spinning フェーズのタイムアウト → phase reset
6. preparing フェーズのタイムアウト → phase reset
7. handleRespin の正常フロー
8. handleRespin + reset API 失敗

## 📌 受け入れ条件（Acceptance Criteria）

- [ ] `bun test` で新しいテストが自動実行される
- [ ] `phase` ステートマシンの主要な 8 ケースがテストされる
- [ ] テストが CI でパスする

## 🏷 優先度

**Medium**（バグ修正後の安全網として重要）

## 📅 実装順序

**15番目**（ISSUE-001〜004 の修正後に追加）

## 🔗 関連Issue

- [ISSUE-001] isOwner フリッカー
- [ISSUE-002] spinScheduledRef 競合
- [ISSUE-003] phase タイムアウト
- [ISSUE-004] clock skew delay
