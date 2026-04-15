# ISSUE-239: EEM(P2) — 2番手ハイライト時に「惜しかった！」テキスト追加

## ステータス
🔲 TODO

## 優先度
**P2 / Medium**

## カテゴリ
感情設計 / Animation / Winner Reveal / UX

## 対象スコア
EEM: +5 / 感情: +0.5 → 総合 +0.5点

---

## Summary

ISSUE-236 で2番手ハイライト（gold border + 0.4秒表示）は実装済み。  
しかし視覚的なハイライトのみで「惜しかった！」という感情のトリガーが弱い。  
2番手名前の上に「惜しかった！」テキストを一瞬フラッシュさせることで、  
会場全員がツッコミを入れるきっかけを作り、盛り上がりを加速する。

---

## Background

2026-04-16 EEM 評価：
- 2番手ハイライトフェーズの感情強度: 7/10
- テキスト演出を加えることで 8〜9/10 に引き上げられると想定
- gold border は実装済み（`roulette-wheel.tsx` の `isNearMiss` state）

---

## Current Behavior

ルーレット停止直後：
1. 2番手セグメントが 400ms 間 gold border + scale 1.05 でハイライト
2. テキスト表示なし
3. フェードアウトして当選者が表示される

---

## Expected Behavior

```
[2番手ハイライト 0〜400ms]
  ルーレット上部に「惜しかった！」テキストが
  フェードイン（+100ms）→ フェードアウト（+350ms）
```

### 実装イメージ

```tsx
// roulette-wheel.tsx の JSX 部分
{nearMissIndex !== null && (
  <motion.div
    className="absolute top-[-32px] left-1/2 -translate-x-1/2
               px-3 py-1 rounded-full bg-amber-400/90 text-black
               text-sm font-black whitespace-nowrap pointer-events-none"
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -4 }}
    transition={{ duration: 0.15 }}
  >
    惜しかった！
  </motion.div>
)}
```

`AnimatePresence` で `nearMissIndex` の有無に応じて表示/非表示を制御する。

---

## Scope

- `components/roulette-wheel.tsx` — nearMissIndex 状態に応じたテキストオーバーレイ追加

---

## Acceptance Criteria

- [ ] 2番手ハイライト中（0〜400ms）に「惜しかった！」テキストがルーレット上部に表示される
- [ ] テキストは 400ms 後に gold border と同時にフェードアウトする
- [ ] 参加者が1人の場合は表示されない（nearMissIndex === null）
- [ ] モバイル 375px でルーレットのレイアウトが崩れない
- [ ] ブラウザで目視確認してからコミット

## Priority
**P2**

## Impact
EEM 2番手フェーズ: 7/10 → 8〜9/10 / 感情スコア +0.5 → 総合 +0.5点

## Risk / Notes
- テキストの位置はルーレットの上部に配置（ルーレット内は回転するので不可）
- 「惜しかった！」は固定テキスト。将来的にランダム化（「あと少し！」「惜しい！」など）も可
