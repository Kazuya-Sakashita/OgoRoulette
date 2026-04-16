# ISSUE-243: Kano(P2) — ゲーミフィケーション強化：グループランキング・称号・連続記録

## ステータス
🔲 TODO

## 優先度
**P2 / Medium**

## カテゴリ
Kano-魅力品質 / Gamification / Retention / UX

## 対象スコア
Kano: +0.5 / HEART-Happiness: +0.3 → 総合 +0.5点

---

## Summary

奢り回数カウントと称号（「奢り王」等）は ISSUE-194 で実装済みだが、
グループ内ランキング・連続記録・比較機能が不足しており Kano の魅力品質 9.5/10 の残り 0.5 点に相当する。
「誰が一番多く奢っているか」をグループ全体で見える化することで、
継続利用のモチベーションと「次回も使いたい」感情を強化する。

---

## Background

2026-04-16 統合評価（Kano 9.5/10）で残存ギャップとして検出。
既存実装:
- 個人の奢り回数カウント（`recordTreat`）: ✅ ISSUE-194
- 個人称号（「奢り王」「レジェンド」等）: ✅ ISSUE-194
- グループ内ランキング表示（WinnerCard Phase B）: △ 表示はあるが浅い

---

## Expected Behavior

### 1. WinnerCard Phase B ランキング強化

```
┌────────────────────────────┐
│ 🏆 グループランキング       │
│                            │
│ 1位 さくら  👑 奢り王  5回  │
│ 2位 たろう              3回 │
│ 3位 はな                2回 │
│                            │
│ 📈 さくら: 3連続！         │
│ （今回で3回目の奢り）       │
└────────────────────────────┘
```

### 2. 連続記録バッジ

同じ人が連続で当選した場合、特別バッジを表示：
- 2連続: 「2連続！」
- 3連続以上: 「🔥 {n}連続！呪われてる？」

### 3. グループ累計統計（ホーム画面）

保存グループ選択時に、過去のスピン統計を一言で表示：
- 「このグループ: 計12回スピン、最多はさくら（5回）」

---

## Scope

- `components/winner-card.tsx` — Phase B ランキング表示を強化
- `lib/group-storage.ts` — 連続記録の追跡ロジック追加
- `app/home/page.tsx` — グループ選択時の統計サマリー表示
- `components/group-list.tsx` — グループカードに累計回数を表示

---

## 実装方針

### 連続記録の追跡

```typescript
// lib/group-storage.ts に追加
interface GroupData {
  // 既存フィールド
  participants: string[]
  lastSpinAt?: number
  lastWinner?: string

  // 新規フィールド
  consecutiveWinner?: string   // 現在連続当選中のメンバー
  consecutiveCount?: number    // 連続回数
  totalSpins?: number          // グループ累計スピン数
}

// recordTreat 相当の関数でグループの連続記録を更新
export function recordGroupResult(groupId: string, winner: string): { consecutive: number } {
  const group = getGroup(groupId)
  const isConsecutive = group.lastWinner === winner
  const consecutive = isConsecutive ? (group.consecutiveCount ?? 1) + 1 : 1
  updateGroup(groupId, {
    lastWinner: winner,
    consecutiveCount: consecutive,
    consecutiveWinner: winner,
    totalSpins: (group.totalSpins ?? 0) + 1,
  })
  return { consecutive }
}
```

---

## Acceptance Criteria

- [ ] WinnerCard Phase B のランキングに連続記録バッジが表示される
- [ ] 2連続以上で「🔥 {n}連続！」バッジが出る
- [ ] グループリストの各グループカードに累計スピン数が表示される
- [ ] グループ選択時に「最多は{name}（{n}回）」の統計が一言で見える
- [ ] ゲスト（グループ未保存）には連続記録バッジのみ表示（グループ統計は非表示）
- [ ] モバイル 375px でレイアウト崩れなし
- [ ] ブラウザで目視確認してからコミット

## Priority
**P2**

## Impact
Kano-魅力品質 9.5 → 10.0 / HEART-Happiness +0.3 → 総合 +0.5点

## Risk / Notes
- `lib/group-storage.ts` のデータ構造変更は後方互換性を保つ（既存フィールドを壊さない）
- ゲストの連続記録は `lib/treat-stats.ts` の既存カウンターで代用可
- グループ統計はローカルストレージのみ（サーバー集計は将来対応）
