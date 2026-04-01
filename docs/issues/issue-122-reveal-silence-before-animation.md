# ISSUE-122: reveal前に0.5秒の溜めを追加してドキドキ感を演出する

## 概要

動画の当選者発表アニメーションで、ホイールが止まった直後にすぐ名前が表示されてしまう問題を改善する。
0.5秒の無音の溜めを挿入し、「誰が当たった？」という期待感を高める。

---

## 背景

- 現状はホイール停止直後に当選者名がフェードインする
- 「発表の間（ま）」がなく、ゲームとしての盛り上がりが薄い
- TV番組の抽選演出でよく使われる「溜め → 発表」パターンを採用

---

## 修正内容

### `components/recording-canvas.tsx`

```ts
import { SILENCE_BEFORE_REVEAL_MS } from "@/lib/constants"

// drawReveal 関数内
const SILENCE_S = SILENCE_BEFORE_REVEAL_MS / 1000  // 0.5
const adjustedSec = Math.max(0, revealSec - SILENCE_S)

// 以降の全 revealSec 参照を adjustedSec に置き換え
```

- `revealSec` の開始から `SILENCE_S`（0.5秒）の間は `adjustedSec = 0` のまま
- 0.5秒後から通常のrevealアニメーションが開始される
- `Math.max(0, ...)` でネガティブ値を防止

---

## 影響範囲

- `components/recording-canvas.tsx`
- 動画録画の当選者発表タイミング
- `SILENCE_BEFORE_REVEAL_MS` 定数で調整可能（ISSUE-111）

---

## ステータス

✅ 完了（commit: 07abe5c）
