# issue-091: ルーレット動画の録画タイミングを修正し、感情アークを作る

**ステータス:** ✅ 実装済み（commit: b681e6d）

## 優先度
High

## デプロイブロッカー
No

---

## 概要

現状、ルーレット動画は「ホイールが回り始めてから」録画が始まる。
最も期待感・緊張感を生む 3→2→1 カウントダウンが録画されていない。
また、当選発表（リビール）の録画が 2.5秒で強制終了し、
WinnerCard の主要アニメーション（クラウン落下・名前ズーム・リアクション）が途中で切れる。

この2点を修正することで、動画が「期待感 → 決定 → 祝福」の感情アークを持つようになる。

---

## 背景

```
現状の録画範囲:
                     ここから録画開始    ここで録画終了
                           ↓               ↓
[3][2][1] → [ホイール回転4.5秒] → [バウンス] → [リビール2.5秒] → (WinnerCard Phase A継続...)
 ↑ここが映らない                                                    ↑ここが映らない

あるべき録画範囲:
↓ここから録画開始                                                          ↓ここで録画終了
[3][2][1] → [ホイール回転4.5秒] → [バウンス] → [リビール4.5秒(クラウン〜金額表示)]
```

---

## 問題点

### 問題1: カウントダウンが録画されない

```typescript
// lib/use-video-recorder.ts — 現状
// phase が "spinning" になったとき startRecording() を呼んでいる
// → カウントダウン (phase="countdown") は RecordingCanvas に描画されているが MediaRecorder が動いていない
```

`RecordingCanvas` はすでに `phase="countdown"` 時の描画実装を持っている:
- 大きなカウントダウン数字（サイズ160px）
- "運命のカウントダウン" ラベル
- パルスリング演出

これを録画するには `startRecording()` の呼び出しタイミングを変えるだけでよい。

### 問題2: リビール録画が途中で切れる

```typescript
// lib/use-video-recorder.ts — 現状
const REVEAL_RECORDING_MS = 2500

// stopRecordingAfterReveal 内
setTimeout(() => {
  setRecordingPhase("done")  // 2500ms で録画停止
}, REVEAL_RECORDING_MS)
```

`WinnerCard` Phase A の各アニメーションタイミング:
- t=300ms: クラウン落下
- t=650ms: 名前ズーム（最も重要な瞬間）
- t=1150ms: リアクションテキスト
- t=1900ms: 金額バッジ
- t=4000ms: Phase A 完了

2500ms で停止すると、金額バッジが出る前に録画が終わる。
4500ms に延長すれば Phase A の全アニメーションが収録される。

---

## 修正方針

### 修正1: 録画開始タイミングを "countdown" フェーズに変更

```typescript
// lib/use-video-recorder.ts
// useEffect で phase の変化を監視している箇所
// "spinning" → "countdown" に変更
```

### 修正2: リビール録画時間を 2500ms → 4500ms に延長

```typescript
// lib/constants.ts または lib/use-video-recorder.ts
const REVEAL_RECORDING_MS = 4500  // 2500 → 4500
```

### 修正3（ISSUE-091 オプション）: 当選確定フラッシュ演出

ホイールがバウンスして止まった瞬間、キャンバス全体に白フラッシュを追加。

```typescript
// components/recording-canvas.tsx
// reveal フェーズ開始時 (t=0〜200ms)
// ctx.fillStyle = `rgba(255,255,255,${flashOpacity})`
// ctx.fillRect(0, 0, canvasWidth, canvasHeight)
```

revealProgress が 0 → 0.04 の間、白い overlay を描く。
0.04 以降はフェードアウト。「決定の瞬間」の視覚的インパクトが出る。

---

## タスク

- [ ] `use-video-recorder.ts` の録画開始タイミングを "countdown" フェーズに変更
- [ ] `REVEAL_RECORDING_MS` を 4500ms に変更
- [ ] 当選確定フラッシュ演出を `recording-canvas.tsx` に追加
- [ ] 動画長が正しいことを確認（約12秒: カウントダウン3秒 + 回転4.5秒 + リビール4.5秒）
- [ ] モバイルで録画が安定していることを確認
- [ ] iOS Safari で MP4 録画が正常に動作することを確認

---

## 受け入れ条件

- 動画に 3→2→1 カウントダウンが含まれている
- 動画に WinnerCard Phase A の全アニメーション（クラウン・名前・リアクション・金額）が含まれている
- 当選確定の瞬間に白フラッシュが入る
- モバイルで録画が安定して完了する
- 動画総尺が約 11〜13 秒であること

---

## 実装メモ

RecordingCanvas の各フェーズ描画は既に実装済み:
- `phase="countdown"` → カウントダウンオーバーレイ（数字 + ラベル）
- `phase="spinning"` → 回転ホイール + フローティングネーム
- `phase="reveal"` → クラウン + 名前 + リアクション + ハッシュタグ

録画開始タイミングを変えるだけで "countdown" フェーズの映像が自動的に収録される。
