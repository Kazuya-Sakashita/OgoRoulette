# Phase B 余韻制御（タップ任意進行・自動遷移廃止）

## 背景

感情評価で「余韻（結果後）」が 6/10 と低スコアだった最大原因。
現在 Phase A（シネマティック発表）は 3.2 秒後に自動で Phase B（詳細シート）へ遷移する。
当選発表のピーク感動中にユーザーが何もしていないのに画面が切り替わり、
「ちょっと待って！」「もう少し見ていたい！」という体験が損なわれている。

また Phase A 滞在中の "instant share" ボタン（1.5 秒後出現）はあるが、
タップしても Phase B には遷移せず Phase A のまま留まる手段がない。

## 問題

- Phase A → Phase B が 3.2 秒後に自動遷移し、余韻を楽しめない
- 当選者名を見ながら「シェアしたい」「写真撮りたい」という行動を妨げる
- マルチプレイで全員が画面を見ている瞬間のピークが強制終了する
- 「もっと見ていたい」というユーザーの感情と UI の動きが逆行

## 目的

- Phase A の余韻を最大化し、感情スコア「余韻」を 6 → 9 に改善する
- ユーザーが主体的に Phase B へ進むフローに変更する
- 「みんなで画面を囲む時間」を演出として機能させる

## 対応内容

### Phase A の変更

現在の `useEffect` タイマー（3200ms 後に `advanceToDetails()`）を廃止し、
以下のトリガーに変更する。

```typescript
// 変更前: 自動遷移（3200ms 後）
useEffect(() => {
  const t = setTimeout(() => advanceToDetails(), 3200)
  return () => clearTimeout(t)
}, [phase])

// 変更後: タップ / クリックのみで進行
// 自動遷移タイマーを削除
// Phase A の全画面クリック（onClick={advanceToDetails}）は既に実装済み
// → 「タップして詳細を見る」ヒント表示に変更
```

### ヒント表示の更新

Phase A 下部に「タップして詳細へ → 」ヒントを追加（1.8 秒後にフェードイン）。

```typescript
// Phase A の hint テキスト変更
// 現在: "画面をタップすると詳細が見られます"（1.8秒後）
// 変更後: パルスアニメーション付き矢印 + "タップして続ける"
```

### フォールバック（自動進行が必要な場合）

マルチプレイで全員が揃っている場合、長時間 Phase A に留まるとルームがタイムアウトする可能性があるため、**30 秒後に自動遷移**するフォールバックを残す。

```typescript
// フォールバック: 30 秒後に自動進行（タップがない場合のみ）
const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
useEffect(() => {
  if (phase !== "reveal") return
  autoAdvanceRef.current = setTimeout(() => advanceToDetails(), 30_000)
  return () => clearTimeout(autoAdvanceRef.current!)
}, [phase])
```

## 完了条件

- [x] Phase A が 3.2 秒後に自動で Phase B に遷移しなくなる
- [x] タップ / クリックで Phase B に進める（既存動作を維持）
- [x] 「タップして続ける」ヒントが 1.8 秒後にフェードインする
- [x] 30 秒後にフォールバック自動遷移が発生する
- [x] `npm run build` でエラーなし

## 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `components/winner-card.tsx` | Phase A 自動遷移タイマー削除・ヒントテキスト変更・フォールバック追加 |

## リスク

低。WinnerCard 内部の変更のみ。自動遷移がなくなる代わりに 30 秒フォールバックで安全性を確保。
マルチプレイのルームタイムアウトとは独立した変更。

## ステータス

**完了** — 2026-04-04

## 優先度

**Critical** — 感情スコア「余韻」の最大改善施策。実装コスト最小（〜1時間）でスコア影響が大きい。

## 期待効果

- 感情スコア「余韻」: 6 → 9 (+3)
- HEART Happiness: 16 → 18 (+2)
- 総合スコア: 72 → 74

## 関連ISSUE

- issue-181（WinnerCard Phase B 2-CTA 化）
- issue-183（シェアカード・Phase A instant share）
