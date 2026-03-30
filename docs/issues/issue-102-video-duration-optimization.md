# issue-102: 動画尺の最適化 — 録画時間定数の管理

## 優先度
Medium

## デプロイブロッカー
No

---

## 概要

録画停止タイムアウト `4500` がコード内にハードコードされていた。
`REVEAL_RECORD_DURATION_MS` として `lib/constants.ts` に抽出し、
変更・調整を一か所で管理できるようにする。

---

## 現状の録画尺

| フェーズ | 時間 |
|---------|------|
| カウントダウン (3→2→1) | 約 3s |
| スピンアニメーション | 約 4.5s |
| リビールバッファ | 4.5s (`REVEAL_RECORD_DURATION_MS`) |
| **合計** | **約 12s** |

12秒は X/LINE（上限15s）の範囲内で適切。
現時点では機能的な変更なし。

---

## 実装

```typescript
// lib/constants.ts
export const REVEAL_RECORD_DURATION_MS = 4500

// lib/use-video-recorder.ts
import { REVEAL_RECORD_DURATION_MS } from "@/lib/constants"
// ...
}, REVEAL_RECORD_DURATION_MS)
```

---

## 受け入れ条件

- `REVEAL_RECORD_DURATION_MS` を変更するだけで録画尺を調整できる
- 機能的な動作変化なし（4500ms のまま）
