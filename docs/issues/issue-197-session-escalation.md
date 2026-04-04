# セッション内スピン回数エスカレーション演出

## 背景

感情評価「ワクワク感」7/10・「盛り上がり（複数人）」8/10 に天井がある理由。
同じメンバーで複数回スピンしても毎回演出が同一。
飲み会で「1回目」「2回目」「3回目」と回数が増えるほど盛り上がるはずなのに、
アプリ側の演出はフラットなまま。

特に「同じ人が 2 回連続で当たった！」「もう 3 回目の鈴木さん！」のような
文脈依存のドラマを演出できていない。

## 問題

- セッション内スピン回数が増えても演出変化がゼロ
- 「今日 3 回目の田中さん！」という盛り上がりが演出に反映されない
- 連続当選（同一人物が続けて当選）の特別演出がない
- スピン回数カウンターは実装済みだが（`sessionSpinCount`）演出に未活用

## 目的

- セッション内回数・連続当選をドラマとして演出する
- 感情スコア「ワクワク感」を 7 → 9 に改善する
- 「もう一回やろう！」の動機付けを強化する

## 対応内容

### セッション内演出エスカレーション

`sessionSpinCount` 既存 state と連携して Phase A の演出を変化させる。

```typescript
// components/winner-card.tsx の props に追加
interface WinnerCardProps {
  // ... 既存
  sessionSpinCount?: number  // 今日のセッション内スピン回数
}
```

#### 回数別演出変化

| sessionSpinCount | 演出変化 |
|----------|---------|
| 1 | 通常演出（現状維持） |
| 2 | Confetti の数を 1.5 倍・サブコピー「2回目！」 |
| 3 | Confetti intense=true・PrismBurst を 2 回・「3回戦！」バッジ |
| 4+ | intense Confetti + 金色フラッシュ背景 + 「もはや宴！」 |

```typescript
// WinnerCard 内
const isIntense = (sessionSpinCount ?? 1) >= 3
const spinLabel = sessionSpinCount && sessionSpinCount >= 2
  ? `${sessionSpinCount}回戦！`
  : null

// Confetti に intense を渡す（既存 props）
<Confetti
  active={showConfetti}
  intense={isIntense}
  winnerColor={color}
/>
```

### 連続当選演出

前回当選者と同じ人が再度当選した場合の特別演出。

```typescript
// WinnerCard props に追加
interface WinnerCardProps {
  lastWinner?: string  // 直前の当選者名（ISSUE-194 と共通化）
}

// Phase A — winner と lastWinner が一致する場合
const isConsecutiveWinner = lastWinner === winner

// 連続当選時の追加テキスト（1.2 秒後にフェードイン）
{isConsecutiveWinner && (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 1.2 }}
    className="text-yellow-400 font-bold text-xl"
  >
    ⚡ 連続当選！
  </motion.div>
)}
```

### ホーム側の変更

```typescript
// app/home/page.tsx
// WinnerCard に sessionSpinCount と前回当選者を渡す
const [previousWinner, setPreviousWinner] = useState<string | null>(null)

// handleSpinComplete 内
setPreviousWinner(winnerName)

<WinnerCard
  // ...
  sessionSpinCount={sessionSpinCount}
  lastWinner={previousWinner ?? undefined}
/>
```

## 完了条件

- [x] 2 回目以降のスピンで Confetti が増加する
- [x] 3 回目以降で PrismBurst が 2 連続になる
- [x] 連続当選時に「連続当選！」テキストが表示される
- [x] セッション回数バッジ（「3回戦！」等）が Phase A に表示される
- [x] `npm run build` でエラーなし

## 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `components/winner-card.tsx` | sessionSpinCount / lastWinner props 追加・エスカレーション演出 |
| `app/home/page.tsx` | previousWinner state 追加・WinnerCard へ渡す |

## リスク

低〜中。既存の `sessionSpinCount` state を活用するため新規 state は最小限。
`intense` Confetti は既存 props なので API 変更なし。

## ステータス

**完了** — 2026-04-05

## 優先度

**Recommended** — 感情スコア「ワクワク感」「盛り上がり」の改善。

## 期待効果

- 感情スコア「ワクワク感」: 7 → 9 (+2)
- 感情スコア「盛り上がり」: 8 → 9 (+1)
- HEART Engagement: 12 → 14 (+2)
- 総合スコア: 72 → 74

## 関連ISSUE

- issue-194（称号・回数に応じた演出差別化）
- issue-193（Phase B 余韻制御）
- issue-196（再スピン ワンタップフロー）
