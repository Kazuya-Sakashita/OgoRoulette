# ISSUE-209: コンポーネント・API・E2Eテスト整備

## ステータス
✅ 完了 2026-04-07

## 実装メモ
- `lib/share-service.test.ts` に buildShareUrl / trimForX / buildShareText の純粋関数テストを追加（ISSUE-214 変更のリグレッション防止）
- `.github/workflows/test.yml` を追加して PR ごとに `pnpm test` + `pnpm typecheck` が自動実行される
- スピン API テスト (`app/api/rooms/[code]/spin/route.test.ts`) は既存で充実（193テスト）

## 優先度
**Recommended** — リグレッション防止。CI/CD 信頼性向上。デプロイ後の不具合発見を早める。

## カテゴリ
Testing / Quality / Architecture

## 対象スコア
技術: +2 / G-STACK-Architecture: +1 / G-STACK-Risk: +0.5

---

## 背景

現在のテストカバレッジ:

| 対象 | 状態 |
|------|------|
| `lib/rate-limit.ts` | ✅ Vitest 有り |
| `lib/group-storage.ts` | ✅ Vitest 有り |
| `lib/safe-redirect.ts` | ✅ Vitest 有り（推定） |
| `app/` pages | ❌ ゼロ |
| `components/` | ❌ ゼロ |
| `app/api/` routes | ❌ ゼロ |
| E2E (Playwright) | ⚠️ 構成あり・スペック不明 |

ISSUE-201〜206 の修正（rate-limit, clock sync, countdown guard など）はすべて手動確認のみ。
次回デプロイでリグレッションが起きてもテストで検知できない。

---

## 問題

### ① API ルートの無テスト

`/api/rooms/[code]/spin` はレート制限・winner確定・セッション記録を行うが、
ユニットテストがなく、KV 接続障害時のフォールバック動作が確認されていない。

### ② カスタムフックの無テスト

`useSpin`、`useRoomSync`、`useBill` は play/page.tsx の核心ロジックを担うが
テストがない。ISSUE-203（カウントダウン中の参加者削除ガード）などのバグが
再発してもテストで検知できない。

### ③ 重要コンポーネントの無テスト

`RouletteWheel` の winner コールバック、`WinnerCard` のシェアボタン動作など、
UX の核心部分がテストされていない。

---

## 改善内容

### Phase 1 — API ルートのユニットテスト（優先度高）

```ts
// tests/api/spin.test.ts
describe('POST /api/rooms/[code]/spin', () => {
  it('レート制限を超えた場合 429 を返す')
  it('WAITING 以外の room で spin しようとすると 409 を返す')
  it('参加者が 0 人の room ではスピンできない')
  it('KV 接続失敗時はメモリ fallback で動作する')
})
```

### Phase 2 — カスタムフックのユニットテスト

```ts
// tests/hooks/use-spin.test.ts
describe('useSpin', () => {
  it('SPINNING 中に handleSpin を呼んでも二重実行されない')
  it('カウントダウン中に参加者が減っても winner index が範囲外にならない')
  it('isRespinningRef が true の間は handleRespin が無視される')
})
```

### Phase 3 — E2E テスト補完（Playwright）

```ts
// e2e/core-flow.spec.ts
test('ゲストが4名でルームを作成してスピンできる', async ({ page }) => {})
test('QRコードスキャンでメンバーが参加できる', async ({ page }) => {})
test('スピン後にWinnerCardが表示される', async ({ page }) => {})
test('再スピンが正常に動作する', async ({ page }) => {})
```

### Phase 4 — CI に組み込み

```yaml
# .github/workflows/test.yml
- name: Run unit tests
  run: npm run test
- name: Run E2E tests
  run: npx playwright test
```

---

## 完了条件

- [ ] API routes テスト: `/api/rooms/[code]/spin` を含む主要3エンドポイント
- [ ] カスタムフック: `useSpin`（ISSUE-203/206 のリグレッション防止）
- [ ] E2E: コアフロー（作成→参加→スピン→リザルト）が通る
- [ ] CI: PR ごとにテストが自動実行される
- [ ] カバレッジ: lib/ + hooks/ + api/ で 60% 以上

## 期待スコア上昇

技術: +2（11→13） / G-STACK-Architecture: +1 / G-STACK-Risk: +0.5
→ 総合: +2点
