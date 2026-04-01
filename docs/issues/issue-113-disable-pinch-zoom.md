# ISSUE-113: pinch zoomを無効化してゲーム体験を保護する

## 概要

モバイルでルーレットを操作中に誤ってピンチズームが発動し、ゲームUIが崩れる問題を防ぐため、
viewport設定でユーザースケーリングを無効化する。

---

## 背景

- スマートフォンでルーレットホイールを操作する際、2本指タッチで意図せずズームが起動する
- ズーム状態でゲームを続けるとUIレイアウトが崩れ、体験が損なわれる
- ゲームアプリとしてピンチズームは不要な機能

---

## 修正内容

### `app/layout.tsx`

```ts
// Before
export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
}

// After
export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}
```

---

## 影響範囲

- iOS Safari / Android Chrome でのピンチズーム無効化
- アクセシビリティへの影響: ゲームアプリとして意図的な制限
- テキスト読み取りなどのユースケースには影響しない（ゲーム専用画面）

---

## ステータス

✅ 完了（commit: 36c2416）
