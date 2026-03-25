# [ISSUE-007] 録画動画（WebM）が iOS Safari で再生・シェアできない

## 🧩 概要

`useVideoRecorder` は `MediaRecorder` で WebM 形式の動画を生成する。しかし iOS Safari（15 以下）は WebM の再生をサポートしておらず、動画プレビューが表示されない・シェアしても相手側で再生できない問題がある。iOS デバイスは OgoRoulette の主要ターゲットであり、この問題はバイラル機能の根幹を壊す。

## 🚨 背景 / なぜ問題か

**`MediaRecorder` のコーデックサポート状況（2025年現在）:**

| ブラウザ | WebM (VP8/VP9) | MP4 (H.264) |
|---------|---------------|------------|
| Chrome Android | ✅ | ✅ |
| Safari iOS 15- | ❌ | ✅ |
| Safari iOS 16+ | ⚠️（制限あり）| ✅ |
| Firefox | ✅ | ⚠️ |

**iOS での症状:**
- `ShareSheet` の動画プレビューが黒画面になる
- Web Share API で動画を渡しても iOS がファイルを認識しない（WebM 非対応）
- LINE/X への動画シェアができない

**影響:**
- iOS ユーザーが「動画でシェア」を試みても失敗
- バイラル係数が大幅に低下
- ユーザーは「バグ」と認識して離脱

## 🎯 目的

iOS Safari を含む全主要ブラウザで録画動画のプレビュー・シェアが機能するようにする。

## 🔍 影響範囲

- **対象機能:** 動画録画 / シェア機能
- **対象画面:** `/room/[code]/play`（ShareSheet・WinnerCard）
- **対象コンポーネント:**
  - `hooks/useVideoRecorder.ts`（または同等のファイル）
  - `components/share-sheet.tsx`
  - `components/winner-card.tsx`

## 🛠 修正方針

**段階的アプローチ:**

**Step 1: コーデック選択の最適化（即時対応）**

`MediaRecorder` 初期化時に端末がサポートするコーデックを優先的に選択する:

```tsx
const getSupportedMimeType = () => {
  const types = [
    "video/mp4;codecs=h264",
    "video/webm;codecs=h264",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ]
  return types.find(type => MediaRecorder.isTypeSupported(type)) ?? "video/webm"
}

const mimeType = getSupportedMimeType()
const mediaRecorder = new MediaRecorder(stream, { mimeType })
```

**Step 2: ffmpeg.wasm によるブラウザ内 MP4 変換（中期対応）**

iOS Safari 向けに WebM → MP4 変換を `ffmpeg.wasm` でブラウザ内実行:

```tsx
import { FFmpeg } from "@ffmpeg/ffmpeg"
import { toBlobURL } from "@ffmpeg/util"

const convertToMp4 = async (webmBlob: Blob): Promise<Blob> => {
  const ffmpeg = new FFmpeg()
  await ffmpeg.load({
    coreURL: await toBlobURL("/ffmpeg-core.js", "text/javascript"),
    wasmURL: await toBlobURL("/ffmpeg-core.wasm", "application/wasm"),
  })
  const data = new Uint8Array(await webmBlob.arrayBuffer())
  await ffmpeg.writeFile("input.webm", data)
  await ffmpeg.exec(["-i", "input.webm", "-c:v", "libx264", "-preset", "fast", "output.mp4"])
  const output = await ffmpeg.readFile("output.mp4")
  return new Blob([output], { type: "video/mp4" })
}
```

**Step 3: サーバーサイド変換（代替案）**

`/api/convert-video` エンドポイントを設け、Vercel Functions で FFmpeg による変換を実行。ffmpeg.wasm よりも安定するが、動画ファイルのアップロードが必要。

**推奨:** Step 1 を即時対応し、Step 2 または 3 を中期的に実装。

## ⚠️ リスク / 副作用

- `ffmpeg.wasm` は 32MB+ のバイナリをロードするため、初回変換時にローディングが発生
- `ffmpeg.wasm` は WebAssembly のため、SharedArrayBuffer が必要（COOP/COEP ヘッダーが必要）→ Vercel の設定変更が必要
- MP4 のコーデック（H.264）はブラウザによっては特許料の問題があるが、主要ブラウザでは問題ない

## ✅ 確認項目

- [ ] iOS Safari 16+ で動画プレビューが表示される
- [ ] iOS Safari で Web Share API 経由で動画をシェアできる
- [ ] Android Chrome で既存の動作（WebM）が維持される
- [ ] 変換処理中に適切なローディング表示がある

## 🧪 テスト観点

**手動確認:**
1. iPhone + Safari でスピン → 動画録画 → プレビュー表示 → シェア
2. Android Chrome で同じフローを確認（既存動作の退行確認）
3. LINE・X への動画シェアが受信側で再生できることを確認

## 📌 受け入れ条件（Acceptance Criteria）

- [ ] iOS Safari（16+）で録画した動画がプレビュー画面で再生される
- [ ] iOS Safari から Web Share API 経由で動画ファイルをシェアできる
- [ ] Android Chrome での既存動作に退行がない
- [ ] サポート外ブラウザでは動画なしでテキスト/URL シェアにフォールバックする

## 🏷 優先度

**High**（バイラル機能の核。iOS ユーザーが多い日本市場で致命的）

## 📅 実装順序

**7番目**（Step 1 は即時対応可能。Step 2/3 は別 Issue として分割も可）

## 🔗 関連Issue

なし
