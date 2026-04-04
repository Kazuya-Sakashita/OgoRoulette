# 奢り回数・称号に応じた演出パーソナライズ

## 背景

感情評価「再挑戦したくなるか」5/10・「記憶に残る体験か」6/10 の主因。
現在、誰が当選しても・何回奢っていても演出は完全に同一。
「初めて奢りになった太郎さん」と「20回奢ってきた花子さん」が同じ演出というのは
蓄積データが完全に死んでいる状態。

OgoRoulette には既に `getTreatTitle()` による称号・`getTreatCount()` による回数が
localStorage に保存されているが、WinnerCard の演出に全く活用されていない。

## 問題

- `getTreatTitle()` が返す称号（「初奢り」「奢り王子」「伝説の奢り神様」）が
  WinnerCard 内の小さなテキストにしか表示されない
- 初奢りと 10 回奢り王が同じリアクション台詞・同じ演出
- 「あいつまた当たった！」という文脈が演出に反映されない
- グループ内で蓄積されてきたストーリーが体験に出てこない

## 目的

- 当選者の奢り回数・称号を Phase A 演出に組み込む
- 「また来た！」「初めてだ！」という文脈の違いを演出で表現する
- 感情スコア「再挑戦したくなるか」を 5 → 8 に改善する

## 対応内容

### リアクション台詞の称号別カスタマイズ

現在のリアクション台詞を奢り回数に応じて分岐させる。

```typescript
// lib/reaction-messages.ts（新規 または winner-card.tsx 内に追加）
export function getReactionMessages(treatCount: number): string[] {
  if (treatCount === 0) {
    // 初奢り（まだ recordTreat 前なので count=0）
    return [
      "🎊 記念すべき初奢り！",
      "✨ 初めての栄冠！",
      "🌟 輝かしいデビュー！",
    ]
  }
  if (treatCount === 1) {
    return [
      "👑 2度目の奢り！",
      "🎯 また来た！",
      "😅 またしても…",
    ]
  }
  if (treatCount <= 3) {
    return [
      "👑 奢り王子が来た！",
      "🏆 3回目のご登場！",
      "🎰 さすがの引きです！",
    ]
  }
  if (treatCount <= 9) {
    return [
      "🏆 奢り王、再び！",
      "💎 もはや伝説の域…",
      "🔥 また引き当てた！",
    ]
  }
  return [
    "🌟 伝説の奢り神様！！",
    "👑 王者の貫禄！",
    "🎰 もはや運命！",
  ]
}
```

### Phase A 称号バッジの追加

当選者名の下に称号バッジを表示（奢り回数 1 回以上の場合）。

```typescript
// components/winner-card.tsx — Phase A reveal 内
// winner + lastTreatCount が渡ってくるため、treatCount を props に追加

// 既存: treatCount は lastTreatCount として WinnerCard に渡っている
// 追加: treatCount > 0 の場合、Phase A に称号バッジを表示

{treatCount > 0 && (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: 0.9 }}
    style={{ /* ... */ }}
  >
    {getTreatTitle(treatCount)}
  </motion.div>
)}
```

### 連続当選（同一人物が直近 2 回連続で当選）の特別演出

```typescript
// WinnerCard props に lastWinner を追加
// lastWinner === winner の場合に追加メッセージ
{isConsecutiveWinner && (
  <motion.div ...>
    ⚡ 連続当選！
  </motion.div>
)}
```

### WinnerCard Props 追加

```typescript
interface WinnerCardProps {
  // ... 既存
  treatCount?: number    // 当選者の累積奢り回数
  lastWinner?: string   // 直前の当選者名（連続判定用）
}
```

### 呼び出し元（home/page.tsx）の変更

```typescript
// handleSpinComplete 内
const newCount = recordTreat(winnerName, amount)
// ...
<WinnerCard
  // ...
  treatCount={newCount - 1}  // 記録前のカウント（"何回目か"の表示用）
  lastWinner={previousWinner}  // 直前の当選者
/>
```

## 完了条件

- [x] 奢り回数 0/1/2〜3/4〜9/10 回以上でリアクション台詞が変わる
- [x] Phase A に称号バッジが表示される（奢り 1 回以上）
- [ ] 連続当選時に「連続当選！」メッセージが表示される（ISSUE-197 と統合予定）
- [x] `npm run build` でエラーなし

## 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `components/winner-card.tsx` | treatCount/lastWinner props 追加・称号バッジ追加・リアクション台詞分岐 |
| `app/home/page.tsx` | WinnerCard に treatCount/lastWinner を渡す |
| `lib/reaction-messages.ts`（新規） | 称号別リアクション台詞定義 |

## リスク

低。既存の `getTreatCount` / `getTreatTitle` を活用するだけ。
既存データなし（初回ユーザー）でも動作する（treatCount=0 の場合の分岐あり）。

## ステータス

**完了** — 2026-04-04

## 優先度

**Critical** — ゲーミフィケーション資産を演出に活用する。実装コスト小（〜3時間）でスコアインパクト大。

## 期待効果

- 感情スコア「再挑戦したくなるか」: 5 → 8 (+3)
- 感情スコア「記憶に残る体験か」: 6 → 8 (+2)
- HEART Engagement: 12 → 15 (+3)
- 総合スコア: 72 → 75

## 関連ISSUE

- issue-181（WinnerCard Phase B）
- issue-182（グループ lastSpinAt / lastWinner 記録）
- issue-190（Analytics イベント体系）
