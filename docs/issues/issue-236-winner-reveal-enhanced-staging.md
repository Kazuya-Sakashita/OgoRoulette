# ISSUE-236: 感情設計(P1) — 当選発表演出の3段階強化（ピーク体験設計）

## ステータス
🔲 TODO

## 優先度
**P1 / High**

## カテゴリ
感情設計 / Animation / Winner Reveal / UX

## 対象スコア
感情: +1.5 / Kano-魅力品質: +0.5 → 総合 +1.5点

---

## Summary

ルーレット停止から当選者名表示までの演出タイムラインを3段階に再設計し、会場の盛り上がりピークを最大化する。現状は停止→当選者名表示の2段階だが、「惜しかった演出（2番手ハイライト）」と「当選者名フルスクリーン強調」を追加することで感情スコアを17.5→19点相当に引き上げる。

---

## Background

gstackテスト（2026-04-15）でスピンカウントダウン（3→2→1）は確認済み。当選後の演出は技術的な制約でブラウザ自動テストでは取得できなかったが、CLAUDE.mdの感情スコア 17.5/20 はこの演出の改善余地を示している。

飲み会・合コンシーンで「会場全員が声に出して盛り上がれる演出」が感情スコア20点の基準。

---

## Current Timeline（推定）

```
0ms      ルーレット停止
+0ms     当選者名テキスト表示
+300ms   Confetti
+1500ms  シェアCTA表示
```

---

## Expected Timeline（改善後）

```
0ms      ルーレット停止（効果音）
+200ms   【NEW】2番手ハイライト点灯（0.4秒）→ フェードアウト
         「惜しい！」演出で会場のツッコミを誘発
+600ms   当選者名エリアにスポットライト演出（暗転 + 中央フォーカス）
+900ms   当選者名 scale 0→1.3→1.0 ズームイン（Framer Motion spring）
         + 効果音（ドラムロール的SE）
+1200ms  Confetti フルスクリーン + 当選者名フラッシュ
+1800ms  「🎉 {name}さんが奢ります！」テキスト出現（大きく）
+2500ms  シェアCTA出現（フェードイン）
```

---

## Scope

- `app/room/[code]/play/_components/winner-overlay.tsx`（または相当）
- `app/home/_components/winner-reveal.tsx`（ホーム版）
- `public/sounds/` — SEファイル追加（必要な場合）
- Framer Motion の `staggerChildren` / `spring` アニメーション活用

---

## Implementation Notes

### 2番手ハイライト演出

```tsx
// ルーレット停止直後、2番手（winnerの隣のセグメント）を一瞬ハイライト
const runnerUpSegment = getSegmentBeforeWinner(winner, members)
// 0.4秒だけ border-color: #fbbf24 + scale: 1.05
```

### 当選者名アニメーション

```tsx
<motion.div
  initial={{ scale: 0, opacity: 0 }}
  animate={{ scale: [0, 1.3, 1.0], opacity: 1 }}
  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
>
  {winnerName}
</motion.div>
```

---

## Acceptance Criteria

- [ ] ルーレット停止から当選者名表示まで3段階の演出がある
- [ ] 2番手ハイライトが0.4秒表示されてからフェードアウトする
- [ ] 当選者名が scale 0→1.3→1.0 のspring animationで出現する
- [ ] Confettiが当選者名表示後に発火する
- [ ] シェアCTAが最後（+2.5秒後）に出現する
- [ ] サウンドOFFユーザーには音声なしで演出のみ動作する
- [ ] モバイル375pxでレイアウト崩れなし

## Priority
**P1**

## Impact
感情 +1.5（17.5→19点相当）、Kano-魅力品質 +0.5 → 総合 +1.5点

## Risk / Notes
- 2番手ハイライトは参加者1人の場合は表示しない（winner == runner-up になるため）
- アニメーション時間の合計が長くなりすぎると「もういいから誰が奢るか早く教えて」になる。3秒以内に当選者が明確になることが必須
- 既存の `winner-card` の state management（ISSUE-219実装済み）との競合確認が必要
