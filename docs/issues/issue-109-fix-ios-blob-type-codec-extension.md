# ISSUE-109: iOS blobタイプからcodec情報を除去して正しい拡張子を生成する

## 概要

iOS Safari で録画した動画/画像を共有・ダウンロードする際、MIMEタイプに含まれるcodec情報（例: `video/mp4;codecs=h264`）がそのまま拡張子に使われ、`mp4;codecs=h264` という壊れたファイル名になるバグを修正する。

---

## 背景

- `MediaRecorder` が返す `blob.type` は `"video/mp4;codecs=h264"` のような形式になることがある
- `blob.type.split("/")[1]` で取得すると `"mp4;codecs=h264"` になり、ファイル拡張子が壊れる
- iOS PNG fallback でも同様の問題が発生（`"image/png;base64"` など）
- ダウンロードファイル名が `oguroulette-result.mp4;codecs=h264` になってしまう

---

## 修正内容

### `lib/share-service.ts`

- `shareWithFile`（line 148）: `blobType.split("/")[1]` → `blobType.split("/")[1]?.split(";")[0] ?? "png"`
- `downloadVideo`（line 182）: `blob.type.split("/")[1]` → `blob.type.split("/")[1]?.split(";")[0] ?? "png"`

セミコロン以降のcodec情報を除去し、正しい拡張子（`mp4`, `png`, `webm`）のみを使用する。

---

## 影響範囲

- iOS Safari でのシェア/ダウンロード
- Android Chrome でのシェア/ダウンロード
- ファイル名の拡張子が正しく生成されるため、受信側での開封も正常化

---

## ステータス

✅ 完了（commit: 7c739c2）
