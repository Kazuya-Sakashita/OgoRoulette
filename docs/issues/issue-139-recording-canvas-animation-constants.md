# ISSUE-139: 録画キャンバスのアニメーション定数をlib/constantsに移動する

## 概要

`components/recording-canvas.tsx` にハードコードされていた
アニメーション秒数・スタガー値を `lib/constants.ts` に移動し、
play/page.tsx 側のアニメーション設定と一元管理できるようにする。

---

## 背景

- `recording-canvas.tsx` は `0.08`、`0.10`、`0.12`、`0.65` などのマジックナンバーを直書きしていた
- play/page.tsx 側でアニメーション秒数を変えた際、canvas 側の数値を更新し忘れると
  ライブ表示と録画の演出がずれる
- 定数化によって「ライブ = 録画」を保証する

---

## 修正内容

### `lib/constants.ts` — 定数追加

```ts
export const INTRO_STAGGER_START_S    = 0.08   // 最初のカードの登場遅延(秒)
export const INTRO_STAGGER_STEP_S     = 0.10   // カード間のスタガー間隔(秒)
export const INTRO_FADE_DURATION_S    = 0.12   // 名前フェードイン時間(秒)
export const REVEAL_EXPAND_DURATION_S = 0.65   // 結果拡大アニメーション時間(秒)
```

### `components/recording-canvas.tsx` — インポートして使用

```ts
import {
  SEGMENT_COLORS, SILENCE_BEFORE_REVEAL_MS,
  INTRO_STAGGER_START_S, INTRO_STAGGER_STEP_S,
  INTRO_FADE_DURATION_S, REVEAL_EXPAND_DURATION_S,
} from "@/lib/constants"

// Before
const startDelay = 0.08 + i * 0.10
const nameAlpha  = Math.min(nameElapsed / 0.12, 1)
const p          = Math.min(adjustedSec / 0.65, 1)

// After
const startDelay = INTRO_STAGGER_START_S + i * INTRO_STAGGER_STEP_S
const nameAlpha  = Math.min(nameElapsed / INTRO_FADE_DURATION_S, 1)
const p          = Math.min(adjustedSec / REVEAL_EXPAND_DURATION_S, 1)
```

---

## ステータス

✅ 完了（commit: 0830173）
