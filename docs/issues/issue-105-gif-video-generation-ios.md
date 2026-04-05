# issue-105: iOS でも動画（GIF / サーバー生成）でシェアできるようにする

## ステータス
⏸️ 保留 — 2026-04-06

## 保留理由

- 過去に一度実装を試みたが失敗した経緯がある（gif.js / サーバーサイド MP4 の両案で詰まり）
- WebCodecs API（VideoEncoder + mp4-muxer）が技術的に最有力だが、`recording-canvas.tsx` にフレーム収集コールバックを追加する必要があり、既存の録画パイプラインの複雑化リスクが高い
- ISSUE-095 の PNG fallback がすでに機能しており、iOS でも「シェアできない」状態は解消済み
- 実装コストに対してスコア上昇への貢献が小さく、ISSUE-210/211 等の感情設計系の方が優先度が高い
- iOS 側で `canvas.captureStream()` が将来サポートされた場合、既存の `canRecord()` 検出により追加コード変更なしで自動的に動画録画が有効になる

**再検討タイミング**: iOS Safari が `canvas.captureStream()` をサポートした時点、または感情スコアが 18/20 を超えた後。

## 優先度
High（バズ観点での最大インパクト）

## デプロイブロッカー
No

---

## 概要

iOS Safari では `canvas.captureStream()` が非対応のため、
クライアントサイドでの動画録画が原理的に不可能。

しかしバズ観点では「動画 > 静止画」は明らか。
代替手段として以下を検討・実装する。

---

## 選択肢比較

### Option A: GIF 生成（クライアントサイド）

**ライブラリ**: `gif.js` または `gifshot`

- recording-canvas の `requestAnimationFrame` ループ中にフレームを収集
- スピン〜当選まで 30fps × 5秒 = 150フレームを `canvas.toDataURL()` で取得
- `gif.js` で GIF Blob を生成
- iOS の Web Share API で PNG/GIF が共有可能

**メリット**: サーバー不要、全ブラウザ対応、Blob として扱える

**デメリット**:
- gif.js は Web Worker を使用（iOS Safari はサポートしているが要確認）
- GIF は 256色制限 → ルーレットのグラデーションが荒れる可能性
- ファイルサイズが大きくなりやすい（10-30MB）
- 生成に数秒かかる

**実現可能性**: Medium

---

### Option B: サーバーサイド MP4 生成

**技術**: Next.js API Route (Node.js) + `@ffmpeg/ffmpeg` または `canvas` + ffmpeg

- ルーレット結果（winner, participants, color, amount）を POST
- サーバーで Canvas API + node-canvas で各フレームを描画
- ffmpeg で MP4 エンコード
- MP4 URL を返す → iOS が MP4 をダウンロード・シェア

**メリット**: 最高品質、ファイルサイズ最適、iOS で MP4 として保存可能

**デメリット**:
- Vercel の Edge Function は FFmpeg 非対応
- Node.js 関数 (maxDuration 60s) が必要
- `node-canvas` のビルドが複雑（バイナリ依存）
- Vercel 無料プランでは実行時間制限が厳しい

**実現可能性**: Low（Vercel での実装が困難）

---

### Option C: Canvas + MediaRecorder (iOS 18+ 要検証)

Apple は iOS 18 で一部の Web API を強化している。
`canvas.captureStream()` のサポート状況を定期的に確認し、
サポートされた時点で即座に有効化できるコードを準備する。

現時点では `canRecord()` のチェックで自動的に有効化される（既存コード）。

**実現可能性**: High（コード変更不要、ブラウザ更新待ち）

---

### Option D: MotionPhoto 風スチール写真 + OGP 強化（短期的代替）

動画の代わりに「アニメーション感のある静止画」でシェア価値を最大化:
- PNG に winner カラーで派手なグラデーション枠を追加
- 当選者名を大きく描画
- `#OgoRoulette` ハッシュタグを埋め込む

→ SNS での見た目は動画には劣るが、現状の「黒い動画プレビュー」よりはるかに良い

**実現可能性**: High（現時点での最適解）

---

## 推奨実装順序

1. **ISSUE-103** (Critical): PNG fallback バグ修正 → まず壊れているものを直す
2. **ISSUE-104** (High): iOS UX の明確化
3. **本 Issue Option D** (Medium): 静止画のシェア価値を最大化
4. **本 Issue Option A** (Future): GIF 生成の実現可能性検証・実装

---

## Option D の具体的実装

`recording-canvas.tsx` の PNG フォールバックで生成される静止画を強化:

```typescript
// drawReveal() の改良版 for iOS
// - 当選者名を画面中央に大きく配置
// - winner カラーのグラデーション背景
// - 🎰 OgoRoulette ブランディングを目立たせる
// - #奢り #OgoRoulette ハッシュタグを追加
```

→ iOS では録画しないが、`stopRecordingAfterReveal` のタイミングで
高品質な静止画（PNG）を生成し、シェアシートに表示する。

---

## タスク

- [ ] gif.js の iOS Safari 対応状況を確認・PoC
- [ ] Option D: recording-canvas の reveal フレームを iOS 向けに強化
- [ ] OGP 画像（/api/og）との整合性確認
- [ ] 将来の canvas.captureStream() iOS 対応に向けた `canRecord()` の自動検出が動作するか確認

---

## 受け入れ条件（Option D の場合）

- iPhone でシェアされた PNG が「ルーレットの結果を一目で伝える」デザインになっている
- SNS でシェアしたとき OGP カードと同等の視覚的訴求力がある
- ファイルサイズが 2MB 以下に収まる（Web Share API の制限考慮）
