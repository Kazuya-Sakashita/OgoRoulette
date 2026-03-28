# ISSUE-072: ShareSheet 動画拡張子を blob.type から自動判定（MP4 / WebM）

## ステータス
✅ 完了（share-service 実装に含む）

## 優先度
**Medium**

## カテゴリ
Engineering / Share / iOS

## 概要
ISSUE-007（iOS WebM 非対応）の対応として `MediaRecorder` が MP4 を生成できる場合は MP4 を使う。
`downloadVideo()` と動画ファイル名の拡張子を `blob.type` から自動判定するよう修正する。

## 問題の詳細（改善前）

`share-sheet.tsx` の `getVideoFile()` と `handleDownload()` は拡張子を `.webm` にハードコードしていた:
```typescript
const getVideoFile = () =>
  new File([blob], `ogoroulette_${winner}.webm`, { type: blob.type })

a.download = `ogoroulette_${winner}.webm`
```

iOS で MP4 が生成されるようになっても、ファイル名が `.webm` のままになる問題があった。

## 実装した修正

`lib/share-service.ts` の `shareWithFile()` と `downloadVideo()` 内で blob.type から拡張子を判定:

```typescript
const ext = payload.videoBlob.type.includes("mp4") ? "mp4" : "webm"
const file = new File([payload.videoBlob], `ogoroulette_${payload.winner}.${ext}`, {
  type: payload.videoBlob.type,
})
```

```typescript
// downloadVideo
const ext = blob.type.includes("mp4") ? "mp4" : "webm"
a.download = `ogoroulette_${winner}.${ext}`
```

## 効果
- iOS Safari で MP4 が生成された場合、ファイル名も `.mp4` になる
- Web Share API でのファイル共有時に正しい MIME type とファイル名が使われる
- Android（WebM）では従来通り `.webm`

## 影響範囲
- `lib/share-service.ts` — `shareWithFile()`, `downloadVideo()`
- `components/share-sheet.tsx` — 独自実装を削除し share-service に委譲

## 関連
- ISSUE-007: iOS WebM 非対応（Step 1 対応済み — MediaRecorder で MP4 を優先）
