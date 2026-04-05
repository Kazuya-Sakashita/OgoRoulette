# シェアカードの映え化（SNS で印象に残る結果画像の生成）

## ステータス
✅ 完了 — 2026-04-05

## 概要

現在のシェアはテキスト + URL が中心だが、視覚的に映えるシェアカード（当選者名・グループ・ルーレット演出が入った画像）を canvas で生成し、SNS での拡散力を高める。

## 背景

OgoRoulette の動画録画機能（RecordingCanvas）はルーレット回転→当選者まで録画できる優れた機能だが、実際には:
- 録画に時間がかかる
- ブラウザ間の対応差が大きい（iOS Safari での WebM 非対応等）
- ユーザーが機能を認知していない可能性

一方、**静止画シェアカード**は:
- 即座に生成できる
- ブラウザ間の互換性が高い（Canvas → PNG）
- SNS タイムラインで映えやすい（1:1 または 1.91:1 の画像）

## 現状の問題

1. シェア画像が生成されない（テキストとリンクのみ）
2. 動画録画は高機能だが失敗率が高い（iOS Safari の codec 非対応等）
3. 「スクリーンショットを撮って送る」というユーザー行動が自然発生しているが、そのスクリーンショットに OgoRoulette のブランドが入っていない
4. SNS タイムラインで「なにこれ？」という反応を引き起こす視覚的要素がない

## 目的

- SNS でシェアされたときに「なにこれ？使いたい」という反応を引き出す
- OgoRoulette のブランドが入ったシェアカードを自動生成する
- 動画録画の代替として高信頼な画像シェアを提供する

## 対応内容

### シェアカードの仕様

サイズ: **1080 × 1080px**（Instagram / X の正方形サイズ）
または: **1200 × 630px**（og-image と同様の横長サイズ）

コンテンツ:
```
┌─────────────────────────────┐
│  🎰 OgoRoulette             │
│                             │
│  👑  たろうさんが奢り！      │
│                             │
│  [ルーレットのスナップショット] │
│   (参加者セグメント付き)     │
│                             │
│  4人で食事 → 割り勘 ¥2,500  │
│                             │
│  ogo-roulette.vercel.app    │
└─────────────────────────────┘
```

ブランドカラー（#0B1B2B 背景 + #F97316 アクセント）を使用。

### 技術実装

**Canvas 生成アプローチ** (`lib/share-card-generator.ts`):

```typescript
async function generateShareCard(params: {
  winnerName: string
  participantCount: number
  splitAmount: number | null
  winnerColor: string
  participants: string[]
}): Promise<Blob>
```

1. `new OffscreenCanvas(1080, 1080)` で canvas を作成
2. 背景を #0B1B2B で塗りつぶす
3. OgoRoulette テキスト（フォント: Inter）
4. 当選者名を大きく描画（Noto Sans JP のカスタムフォントは `FontFace` API で load）
5. ルーレットのセグメントを `ctx.arc` + 扇形で描画
6. 金額情報
7. `canvas.convertToBlob({ type: "image/png" })` で Blob 化
8. `navigator.share({ files: [new File([blob], "result.png")] })` でシェア

**フォールバック**:
- `navigator.share` 非対応の場合: `a` タグでダウンロード
- canvas 非対応（極めてまれ）: テキストシェアにフォールバック

### WinnerCard との統合

Phase A の「インスタントシェア」ボタン（1.5s 時点）のタップで:
1. canvas 生成（非同期、0.1〜0.3s 程度）
2. `navigator.share({ files: [png], text: "...", url: "..." })` でシェア

Phase B のシェアボタンも同様に画像生成。

## 完了条件

- [ ] `lib/share-card-generator.ts` が実装されている
- [ ] WinnerCard の「シェア」ボタンで PNG 画像が生成される
- [ ] 生成画像に当選者名・参加人数・OgoRoulette ロゴが含まれている
- [ ] `navigator.share` 非対応環境でもダウンロードフォールバックが機能する
- [ ] iOS Safari（17 以降）で動作確認済み
- [ ] 生成時間が 0.5s 以内であること

## 優先度

**Nice-to-have** — 動画録画が既にある。ただし静止画は信頼性が高く SNS 拡散力が高いため、動画の補完・代替として有効。

## 期待効果

- Growth スコア: 64（Phase 2 後）→ 69（+5）
- Visual スコア: 76（Phase 1 後）→ 79（+3）
- SNS タイムラインでの「なにこれ？」反応が増える

## 関連カテゴリ

Growth / Visual / Engineering

## 備考

- 関連 issue: issue-070-share-service-core.md、issue-071-share-winner-card-integration.md、issue-072-share-video-ios-mp4.md、issue-092-improve-roulette-video-visual-effects.md
- `OffscreenCanvas` は Safari 16.4 以降で対応。古い Safari は通常の `HTMLCanvasElement` にフォールバック
- 日本語フォント（Noto Sans JP）を canvas に描画するには `FontFace` API で事前に load が必要
- ルーレットのセグメント描画は `roulette-wheel.tsx` の描画ロジックを参考に実装（ただし canvas 上で独立して実装する）
- 動画録画（RecordingCanvas）との使い分け: 動画 → 感情的インパクト、静止画 → 気軽なシェア・SNS 拡散
