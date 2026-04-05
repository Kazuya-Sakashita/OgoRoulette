# issue-103: iPhone PNG fallback の MIME/拡張子バグを修正する

## 優先度
Critical

## デプロイブロッカー
Yes

---

## 概要

iOS Safari では `canvas.captureStream()` が非対応のため動画録画ができない。
ISSUE-095 で `canvas.toBlob()` による PNG フォールバックを実装したが、
後続処理が「動画前提」のまま残っており、以下の問題が発生している。

---

## 根本原因

`canvas.captureStream()` は iOS Safari の全バージョンで非サポート。
`canRecord()` が false を返すため録画が開始されず、4.5秒後の fallback で
PNG blob（type: `image/png`）が `recordedBlob` にセットされる。

しかし後続コードが全て動画前提で動いているため不整合が起きる。

---

## 具体的バグ箇所

### 1. `lib/share-service.ts:shareWithFile()` — 拡張子判定バグ

```typescript
// 現状（バグ）
const ext = payload.videoBlob.type.includes("mp4") ? "mp4" : "webm"
// → PNG blob (type="image/png") → includes("mp4") false → ext = "webm"
// → ファイル名: ogoroulette_winner.webm (中身は PNG) → iOS が拒否

// 修正後
const isImage = payload.videoBlob.type.startsWith("image/")
const ext = isImage
  ? payload.videoBlob.type.split("/")[1] ?? "png"
  : payload.videoBlob.type.includes("mp4") ? "mp4" : "webm"
```

### 2. `lib/share-service.ts:downloadVideo()` — 同上

```typescript
// 現状（バグ）
const ext = blob.type.includes("mp4") ? "mp4" : "webm"

// 修正後
const ext = blob.type.startsWith("image/")
  ? (blob.type.split("/")[1] ?? "png")
  : blob.type.includes("mp4") ? "mp4" : "webm"
```

### 3. `components/share-sheet.tsx` — PNG を video タグで表示しようとする

```tsx
// 現状（バグ）
<video src={videoUrl} autoPlay muted loop playsInline>

// 修正後: blob.type で切り替え
{blob.type.startsWith("image/") ? (
  <img src={videoUrl} className="w-full h-full object-cover" alt="シェア画像" />
) : (
  <video src={videoUrl} autoPlay muted loop playsInline className="w-full h-full object-cover" />
)}
```

### 4. `app/room/[code]/play/page.tsx` — 録画していないのに `● REC` 表示

```tsx
// 現状（バグ）: recordingPhase だけで判断
{(recordingPhase === "countdown" || recordingPhase === "spinning" || recordingPhase === "reveal") && (
  <div>● REC</div>
)}
```

録画が実際に開始されたかどうかを `VideoRecorder.isActive` で確認し、
録画されていない場合は REC インジケーターを非表示にする。

---

## 修正ファイル

- `lib/share-service.ts` — `shareWithFile()` と `downloadVideo()` の拡張子判定
- `components/share-sheet.tsx` — blob.type に応じた video/img 切り替え
- `app/room/[code]/play/page.tsx` — REC インジケーターを実際の録画状態に連動
- `app/home/page.tsx` — 同上
- `lib/use-video-recorder.ts` — `isRecording` 状態を公開

---

## タスク

- [ ] `shareWithFile()` / `downloadVideo()` の拡張子判定を修正
- [ ] `ShareSheet` で image/* を `<img>` 表示に切り替え
- [ ] ShareSheet のタイトルを blob type に応じて変更（「動画を保存」→「画像をシェア」）
- [ ] REC インジケーターを実際の録画状態に連動
- [ ] `useVideoRecorder` から `isRecording` を公開
- [ ] iPhone 実機で PNG シェアが正常動作することを確認
- [ ] Android Chrome / PC Chrome で回帰がないことを確認

---

## 受け入れ条件

- iPhone で「今すぐシェア 📸」をタップすると PNG が正しくシェアできる
- iPhone で ShareSheet を開いたとき `<img>` でプレビューが表示される
- iPhone でダウンロードすると `.png` ファイルとしてダウンロードされる
- iPhone で `● REC` が表示されない
- Android / PC で動画シェアが従来どおり動作する（回帰なし）

---

## バズへの影響

iPhoneユーザー（スマホユーザーの大多数）がシェアできない状態は、
OgoRoulette のバズ導線を半分以上失わせている。
本 Issue はデプロイブロッカー（Critical）として扱う。

## ステータス
✅ 完了 — 2026-04-06（share-sheet.tsx の isImageBlob 判定 + share-service.ts の MIME/拡張子修正）
