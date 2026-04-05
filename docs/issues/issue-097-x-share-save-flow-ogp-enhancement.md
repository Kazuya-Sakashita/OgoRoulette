# issue-097: X シェア「保存→貼り付け」フロー改善 + OGP 画像強化

## ステータス
✅ 完了 — 2026-04-06

## 優先度
High

## デプロイブロッカー
No

---

## 概要

### X シェアの問題

X の Web Intent は動画/画像の直接添付をサポートしていない。
現状、録画済みの動画を持っていても X にシェアするとテキスト+URLのみになり、
シェアの視覚的インパクトが失われる。

### OGP の問題

OGP 画像の背景が固定の暗色 (`#0B1B2B`) で、当選者のカラーが活かされていない。
SNS でシェアされたときの視覚的訴求力が低い。

---

## 修正内容

### 1. X シェア — 動画自動ダウンロード

X Intent を開く前に動画/画像を自動ダウンロードする。
ユーザーはダウンロードされたファイルを X のツイート投稿画面で手動添付できる。

```typescript
// 修正前
export function shareToX(text: string, url: string): void {
  ...
}

// 修正後（ISSUE-097）
export function shareToX(text: string, url: string, blob?: Blob | null, winner?: string): void {
  if (blob && blob.size > 0) {
    downloadVideo(blob, winner ?? "share")  // 先にダウンロード
  }
  window.location.href = `https://twitter.com/intent/tweet?...`
}
```

呼び出し側（`share-sheet.tsx`）で blob と winner を渡すよう更新。

### 2. OGP 画像の背景グラデーション強化

```tsx
// 修正前
background: "#0B1B2B"

// 修正後（ISSUE-097）
background: `linear-gradient(150deg, ${color}33 0%, #080F1C 40%, #080F1C 60%, ${color}26 100%)`
```

加えて、中央の放射グラデーションも強化:

```tsx
// 修正前
radial-gradient(ellipse at center, ${color}44 0%, ${color}18 38%, transparent 65%)

// 修正後
radial-gradient(ellipse at 50% 55%, ${color}55 0%, ${color}28 42%, transparent 68%)
```

---

## 実装箇所

- `lib/share-service.ts` — `shareToX()` のシグネチャ変更 + blob ダウンロードロジック
- `components/share-sheet.tsx` — `handleShareToX` で blob/winner を渡すよう変更
- `app/api/og/route.tsx` — 背景グラデーションを winner カラー使用に変更

---

## 受け入れ条件

- 録画済みの blob がある状態で「Xで共有」をタップすると動画が自動ダウンロードされる
- その後 X Intent が開き、ユーザーが動画を添付できる
- blob がない場合は従来どおりテキスト+URL のみ（ダウンロードなし）
- OGP 画像が winner のカラーを背景グラデーションに反映する
