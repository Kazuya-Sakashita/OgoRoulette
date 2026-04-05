# issue-104: iOS 向けシェア UX の明確化

## ステータス
✅ 完了 — 2026-04-06

## 優先度
High

## デプロイブロッカー
No（ISSUE-103 の後に対応）

---

## 概要

ISSUE-103 で PNG fallback の技術バグを修正した後、
iOS ユーザーに「動画ではなく静止画がシェアされる」ことを自然に伝える UX を整備する。

iOS では動画が生成されないことは技術的制約であり、
これをユーザーが混乱なく受け入れられるよう体験を設計する。

---

## 改善内容

### 1. `useVideoRecorder` に `isRecording` / `canRecordVideo` を追加

```typescript
// lib/use-video-recorder.ts
export function useVideoRecorder() {
  const [isRecordingActive, setIsRecordingActive] = useState(false)
  // canRecord の結果を state として保持（初回 mount 後に確定）
  const [canRecordVideo, setCanRecordVideo] = useState(false)
  ...
  return { ..., isRecordingActive, canRecordVideo }
}
```

呼び出し側で `canRecordVideo` を使い:
- REC インジケーターの制御
- WinnerCard のシェアボタンテキスト変更（「動画でシェア 🎬」→「画像でシェア 📸」）
- ShareSheet のタイトル変更

### 2. WinnerCard — iOS では静止画シェアに特化したボタン

```tsx
// 動画あり: "動画でシェア 🎬"
// 動画なし（iOS): "今すぐシェア 📸" (静止画)
// シェア済み: "シェア済み ✓"
```

### 3. ShareSheet — タイトルと説明を blob type に応じて変更

```tsx
// 動画の場合
<p>動画を保存・シェア</p>

// 静止画の場合（iOS）
<p>結果画像をシェア</p>
```

### 4. `● REC` インジケーターの条件修正

iOS では録画していないのに `● REC` が表示される問題を修正。
`isRecordingActive` が true の場合のみ表示。

---

## 修正ファイル

- `lib/use-video-recorder.ts` — `canRecordVideo`, `isRecordingActive` を公開
- `components/winner-card.tsx` — シェアボタンテキストを動的に変更
- `components/share-sheet.tsx` — タイトル・ヘッダーを blob type に応じて変更
- `app/room/[code]/play/page.tsx` — REC インジケーター条件修正
- `app/home/page.tsx` — 同上

---

## 受け入れ条件

- iPhone で WinnerCard のシェアボタンが「今すぐシェア 📸」のまま（動画を期待させない）
- ShareSheet タイトルが「結果画像をシェア」に変わる（iOS の場合）
- `● REC` が iPhone で表示されない
- Android / PC では全て従来どおり動画体験になる
