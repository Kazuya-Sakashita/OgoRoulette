# ISSUE-147: viewport の maximum-scale=1 を削除（A11y Critical）

## 概要
`app/layout.tsx` の viewport meta に `maximum-scale=1` が含まれており、弱視ユーザーのブラウザズームを強制的に無効化している。Lighthouse Accessibility で Critical 扱い。

## 症状
- Lighthouse Accessibility: 86/100（maximum-scale=1 が主因の1つ）
- 弱視ユーザーがテキストをズームできない
- WCAG 2.1 Success Criterion 1.4.4 (Resize text) 違反

## 根本原因
`app/layout.tsx` の metadata に以下の記述がある：
```typescript
viewport: "width=device-width, initial-scale=1, maximum-scale=1"
```
`maximum-scale=1` はモバイルでのダブルタップズーム防止を意図したものだが、アクセシビリティ上は禁止されている。

## 修正方針
`maximum-scale=1` を削除する。

```typescript
// 変更前
viewport: "width=device-width, initial-scale=1, maximum-scale=1"

// 変更後
viewport: "width=device-width, initial-scale=1"
```

## 影響範囲
- `app/layout.tsx` のみ
- モバイルのダブルタップズームが復活するが、UIへの実害はほぼない

## 実施した修正

`app/layout.tsx` の `Viewport` export から `maximumScale: 1` と `userScalable: false` を削除。

```typescript
// 修正前
export const viewport: Viewport = {
  themeColor: '#0B1B2B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

// 修正後
export const viewport: Viewport = {
  themeColor: '#0B1B2B',
  width: 'device-width',
  initialScale: 1,
}
```

## 結果

- Lighthouse Accessibility: 86 → **92**（+6pt）
- `meta-viewport` 違反が Lighthouse A11y から消去
- ピンチズーム・テキストズームが弱視ユーザーで利用可能に

## ステータス
✅ 修正済み — commit `49fba17`
**優先度:** P1
