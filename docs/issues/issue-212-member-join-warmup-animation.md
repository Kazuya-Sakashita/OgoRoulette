# ISSUE-212: 感情スコア向上 — 参加者入場アニメーション + ルーム待機ウォームアップ演出

## ステータス
✅ 完了 — 2026-04-06

## 優先度
**High** — 感情スコアが 14/20（15未満）のため演出改善を機能追加より優先するルール適用中

## カテゴリ
UX / Emotion / Animation

## 対象スコア
感情: +1.5（14→15.5） / Kano魅力品質: +0.5 / HEART-Engagement: +1

---

## 背景

ISSUE-207（ルーレット停止演出）完了後、感情スコアは 11→14 に改善したが、
閾値の 15/20 に届いていない（CLAUDE.md ルール：感情スコア15未満は演出優先）。

現在のルーム待機フローは：
```
QRスキャン → 参加者リストに名前追加 → ホストが SPIN → 回転
```

「参加者が増えていく時間」は全員が眺めるだけで、何も起きない。
コインの表裏が決まる前の「誰が奢るんだ？！」という共有テンションが生まれていない。

---

## 問題

### ① 新しいメンバーの入場に演出がない

現在：参加者チップがフェードインで追加されるだけ。
「○○さんが参戦！」という感情的なイベントになっていない。

### ② ルーム待機中に「期待感」が高まらない

スピン前の待機中、ホストも参加者も「準備できたら押してね」状態。
カジノのテーブルで全員が着席していく緊張感がない。

### ③ 参加者人数が増えるほど盛り上がる演出がない

3人より5人の方が「誰が当たるかわからない感」が増す。
しかし現在は人数増加に対してビジュアルが変化しない。

---

## 改善内容

### Step 1: 新メンバー入場アニメーション

```tsx
// components/room/participant-chip.tsx 相当
// 新規参加者チップに入場エフェクトを追加
const NewMemberBadge = ({ name }: { name: string }) => (
  <motion.div
    initial={{ scale: 0, rotate: -10, opacity: 0 }}
    animate={{ scale: 1, rotate: 0, opacity: 1 }}
    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
    className="relative"
  >
    {/* 名前チップ */}
    <span className="participant-chip">{name}</span>
    {/* 入場時の星エフェクト（0.8秒後に消える） */}
    <motion.span
      className="absolute -top-2 -right-1 text-xs"
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 0, y: -10 }}
      transition={{ delay: 0.3, duration: 0.5 }}
    >
      ✨
    </motion.span>
  </motion.div>
)
```

### Step 2: 参加人数に応じた「熱量メーター」表示

```tsx
// 参加者が増えるほどメーターが上昇するUI
const HypeBar = ({ count, max = 10 }: { count: number; max?: number }) => {
  const hype = Math.min(count / max, 1)
  const label = count <= 2 ? '準備中...' : count <= 4 ? '盛り上がってきた！' : 'いつでもいける！🔥'
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{label}</span>
        <span>{count}人参加中</span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-orange-500 rounded-full"
          animate={{ width: `${hype * 100}%` }}
          transition={{ type: 'spring', stiffness: 300 }}
        />
      </div>
    </div>
  )
}
```

### Step 3: ホストへのスピンタイミング示唆

参加者数が3人以上になった時点で、ホスト画面に：
```tsx
// 参加者 ≥ 3 かつ phase = "waiting"
{canSpin && participants.length >= 3 && (
  <motion.div
    animate={{ opacity: [0.6, 1, 0.6] }}
    transition={{ repeat: Infinity, duration: 1.5 }}
    className="text-center text-sm text-primary font-bold mt-2"
  >
    🎯 全員揃ったらスピン！
  </motion.div>
)}
```

---

## 影響ファイル

- `app/room/[code]/play/page.tsx` — 参加者チップレンダリング箇所
- `components/room/participant-chip.tsx`（新規または既存改修）
- `components/room/hype-bar.tsx`（新規コンポーネント）

---

## 完了条件

- [ ] 新規参加者追加時にスプリングアニメーション + ✨ が表示される
- [ ] 参加人数が増えるほど熱量メーターが上昇する
- [ ] 参加者が3人以上になると「🎯 全員揃ったらスピン！」が点滅する
- [ ] アニメーションが 60fps を維持する（`will-change: transform` 確認）
- [ ] 5人参加でテストし「おー！集まってきた」リアクションが生まれる

## 期待スコア上昇

感情: +1.5（14→15.5） / Kano魅力品質: +0.5 / HEART-Engagement: +1
→ 総合: +2点（感情スコアが閾値 15 を超える）
