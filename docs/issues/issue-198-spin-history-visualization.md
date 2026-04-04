# スピン履歴の可視化（グループ内エピソード蓄積）

## 背景

感情評価「記憶に残る体験か」6/10 の根本原因。
「あの飲み会で田中さんが 3 回連続で当たったね」というエピソードを
後から振り返る手段がない。

現在、奢り回数・称号は localStorage に保存されているが：
- いつ・どのグループで・誰が当たったかの「エピソード」は残っていない
- グループ画面に表示されるのは「前回の奢り: ○○」というテキストのみ
- 「2週間前のあの日」に戻れる UI がない

OgoRoulette を「奢り決定ツール」から「グループの思い出帳」に昇格させることで、
Retention と記憶定着度を同時に改善できる。

## 問題

- グループ単位のスピン履歴が「前回1件」しか保存されていない（`lastSpinAt` / `lastWinner` の 1 レコードのみ）
- 「先週は誰が奢ったっけ？」が確認できない
- 履歴が視覚的に楽しくない（文字情報のみ）
- 「このグループで 10 回スピンした」という達成感を演出できていない

## 目的

- グループ単位で過去スピン履歴（直近 10 件）を保存・表示する
- 「記憶に残る体験」を時系列に振り返れるようにする
- 感情スコア「記憶に残る体験か」を 6 → 8 に改善する

## 対応内容

### データ構造の拡張

```typescript
// lib/group-storage.ts
export interface SpinRecord {
  winner: string
  spinAt: number      // timestamp
  participants: string[]
}

export interface SavedGroup {
  // ... 既存フィールド
  spinHistory?: SpinRecord[]  // 追加: 直近 10 件
}
```

### 履歴記録関数の拡張

```typescript
// lib/group-storage.ts
export function updateGroupLastSpin(
  id: string,
  winner: string,
  participants: string[]  // 追加
): void {
  const groups = loadGroups()
  const target = groups.find((g) => g.id === id)
  if (!target) return

  target.lastSpinAt = Date.now()
  target.lastWinner = winner

  // ISSUE-198: 履歴を追加（最大 10 件保持）
  const record: SpinRecord = { winner, spinAt: Date.now(), participants }
  target.spinHistory = [record, ...(target.spinHistory ?? [])].slice(0, 10)

  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups))
}
```

### GroupList / GroupCard での履歴表示

グループカードを展開すると履歴が見えるアコーディオンを追加。

```tsx
// components/group-list.tsx または新規 GroupHistorySheet
{group.spinHistory && group.spinHistory.length > 1 && (
  <button onClick={() => setShowHistory(id)}>
    📜 履歴を見る ({group.spinHistory.length}回)
  </button>
)}

// 履歴リスト
{showHistory === group.id && group.spinHistory?.map((record, i) => (
  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
    <span className="font-bold text-foreground">{record.winner}</span>
    <span>{relativeTime(record.spinAt)}</span>
    <span className="opacity-50">({record.participants.length}人)</span>
  </div>
))}
```

### グループ回数バッジ

グループカードに総スピン回数バッジを表示。

```tsx
{group.spinHistory && group.spinHistory.length > 0 && (
  <span className="text-xs text-muted-foreground/60">
    通算 {group.spinHistory.length} 回
  </span>
)}
```

## 完了条件

- [x] グループスピン時に `spinHistory` に記録が追加される
- [x] グループカードに「履歴を見る（N回）」ボタンが表示される
- [x] 履歴一覧（当選者名・相対日時・参加人数）が表示される
- [x] 最大 10 件まで保存され、古いものは自動削除される
- [x] 既存の `lastSpinAt` / `lastWinner` との互換性が維持される
- [x] `npm run build` でエラーなし

## 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `lib/group-storage.ts` | `SpinRecord` 型・`spinHistory` フィールド追加・`updateGroupLastSpin` 拡張 |
| `hooks/use-groups.ts` | `recordGroupSpin` に participants を渡す |
| `app/home/page.tsx` | `recordGroupSpin` 呼び出しに participants を追加 |
| `components/group-list.tsx` | 履歴表示 UI 追加 |

## リスク

低。localStorage のスキーマ追加は後方互換（`spinHistory` が undefined でも既存動作）。
`updateGroupLastSpin` のシグネチャ変更が必要なため、呼び出し元の修正を漏らさないこと。

## ステータス

**完了** — 2026-04-05

## 優先度

**Recommended** — Retention と「記憶に残る体験」の同時改善。

## 期待効果

- 感情スコア「記憶に残る体験か」: 6 → 8 (+2)
- HEART Retention: 12 → 14 (+2)
- HEART Engagement: 12 → 14 (+2)
- 総合スコア: 72 → 74

## 関連ISSUE

- issue-182（グループ lastSpinAt / lastWinner 記録）
- issue-194（称号・回数に応じた演出差別化）
- issue-191（テストスイート — group-storage テスト拡張が必要）
