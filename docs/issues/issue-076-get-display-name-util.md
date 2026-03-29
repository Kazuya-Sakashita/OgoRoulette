# ISSUE-076: getDisplayName() ユーティリティ関数の実装

## ステータス
🔴 未対応

## 優先度
Critical

## カテゴリ
Frontend / Backend / Lib

## 概要
`display_name` / fallback のロジックを一元管理する
`lib/display-name.ts` を新規作成する。

## 実装内容

```typescript
// lib/display-name.ts

/**
 * ユーザーの公開表示名を返す。
 * display_name が設定されていない場合は fallback を使用。
 * Provider から取得した本名（profile.name）は外部公開しない。
 */
export function getDisplayName(profile: {
  displayName?: string | null
  id: string
}): string {
  if (profile.displayName?.trim()) return profile.displayName.trim()
  return "ユーザー" + profile.id.slice(-4)
}

/**
 * display_name の確認が必要かどうかを返す。
 * 初回シェア前に公開名確認ボトムシートを表示するかの判定に使う。
 */
export function needsDisplayNameConfirmation(profile: {
  displayNameConfirmedAt?: Date | null
}): boolean {
  return !profile.displayNameConfirmedAt
}
```

## 受け入れ条件
- [ ] `lib/display-name.ts` を新規作成
- [ ] `getDisplayName()` が display_name → fallback の順で返す
- [ ] fallback が `"ユーザー" + id末尾4文字` であること
- [ ] provider_name（`profile.name`）を返さないこと
