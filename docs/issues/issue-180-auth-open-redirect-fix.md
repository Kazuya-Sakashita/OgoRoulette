# auth open redirectセキュリティ修正（issue-028の完全実装）

## 概要

`returnTo` クエリパラメータが未検証のまま `router.push()` に渡されており、任意の外部URLへのリダイレクトが可能な状態（オープンリダイレクト脆弱性）。issue-028で記録されているがコードレベルの修正が未完成。

## 背景

ウェルカムページ（`app/page.tsx`）とauth callbackでは `returnTo` パラメータを受け取り、ログイン後のリダイレクト先として使用している。現在の実装では `returnTo.startsWith("/") && !returnTo.startsWith("//")` の簡易チェックのみで、プロトコル相対URL（`//evil.com`）以外の攻撃パターン（JavaScriptスキーム、URLエンコード等）に対応できていない可能性がある。また auth/callback ルートでの検証状況が不明。

## 問題

- `app/page.tsx` の `safeReturn` 判定が `startsWith("/")` のみで不十分な可能性
- `app/auth/callback/route.ts` での `returnTo` 検証が実装されているか未確認
- フィッシング攻撃に悪用されると「OgoRouletteのログインページ経由で外部サイトへ誘導」が可能

## 目的

- `returnTo` パラメータを自サービスの既知パスのみに制限し、オープンリダイレクトを根絶する
- セキュリティ基準を満たし、G-STACK Risk スコアを回復する

## 対応内容

### Step 1: 検証ユーティリティ関数の作成

```typescript
// lib/safe-redirect.ts
const ALLOWED_PATHS = ["/home", "/room/", "/how-to-use", "/lp"]

export function validateReturnTo(returnTo: string | null): string {
  if (!returnTo) return "/home"
  // 相対パスのみ許可（絶対URLを拒否）
  if (!returnTo.startsWith("/")) return "/home"
  // プロトコル相対URL拒否
  if (returnTo.startsWith("//")) return "/home"
  // 許可パスプレフィックス確認
  const allowed = ALLOWED_PATHS.some(p => returnTo.startsWith(p))
  return allowed ? returnTo : "/home"
}
```

### Step 2: app/page.tsx の修正

`validateReturnTo()` を使用して `safeReturn` を計算する。

### Step 3: app/auth/callback/route.ts の確認・修正

callbackルートでも同じ `validateReturnTo()` を使用する。

### Step 4: 全ファイルの `returnTo` 利用箇所をgrepして一括確認

## 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `lib/safe-redirect.ts` | 新規作成（検証ユーティリティ） |
| `app/page.tsx` | `validateReturnTo()` 使用に変更 |
| `app/auth/callback/route.ts` | `validateReturnTo()` 使用に変更（要確認） |

## 完了条件

- [ ] `lib/safe-redirect.ts` が作成されユニットテストが通る
- [ ] `app/page.tsx` で `validateReturnTo()` を使用している
- [ ] `app/auth/callback/route.ts` で `validateReturnTo()` を使用している
- [ ] `//evil.com` / `https://evil.com` / `javascript:alert(1)` を returnTo に指定したとき `/home` にリダイレクトされる
- [ ] `npm run build` でエラーなし

## ステータス

**完了** — 2026-04-05

## 優先度

**Critical** — セキュリティ脆弱性。G-STACK Risk: 12 → 15 (+3) の回復見込み。

## 期待効果

- G-STACK Risk スコア: 12 → 15 (+3)
- 総合スコア: 65 → 66 (+1)

## 関連カテゴリ

Security / Engineering

## 関連ISSUE

- issue-028（初回報告）
- issue-053（auth login page missing return-to）
