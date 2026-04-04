# 再スピン ワンタップフロー（WinnerCard 内「もう一回！」）

## 背景

感情評価「再挑戦したくなるか」5/10 の最大要因。
現在、WinnerCard を表示した後に「もう一回！」するためには：

1. Phase B の「もう一度 / ホームへ」テキストリンクをタップ
2. WinnerCard が閉じる
3. ホーム画面に戻る
4. スピンボタンをタップ

という **4 アクション** が必要。
飲み会中の盛り上がった瞬間に「もう一回！」の勢いが 4 手で冷めてしまう。

特にマルチプレイでは結果確認後すぐに「次の人！」という空気が生まれるが、
その勢いに UI が追いついていない。

## 問題

- WinnerCard を閉じてからでないと再スピンできない
- 「もう一回」へのアクション数が多く盛り上がりが冷める
- Phase B の「もう一度」リンクが小さく目立たない
- グループが保存されているのに次のスピンへの誘導がない

## 目的

- 「もう一回！」をワンタップで実行できるようにする
- 感情スコア「再挑戦したくなるか」を 5 → 8 に改善する
- スピン連続体験のリズムを崩さない

## 対応内容

### WinnerCard に `onRespin` コールバックを追加

Phase B の目立つ位置に「🔄 もう一回！」ボタンを配置する。

```typescript
// components/winner-card.tsx
interface WinnerCardProps {
  // ... 既存
  onRespin?: () => void  // 追加: 再スピンコールバック
}
```

### Phase B ボタン配置の変更

現在 Phase B の「もう一度」は小さなテキストリンク。
これを視認性の高いボタンに昇格させる。

```tsx
{/* Phase B — アクションボタン群（ISSUE-196: もう一回を目立つ位置に）*/}

{/* Primary: シェアする（既存維持） */}
<button onClick={handlePrimaryShare} className="...gradient-accent...">
  シェアする 🎉
</button>

{/* Secondary row */}
<div className="flex gap-3">
  {/* もう一回（新規追加 or 昇格） */}
  {onRespin && (
    <button
      onClick={() => { onRespin(); onClose() }}
      className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/80 text-sm font-semibold hover:bg-white/10 transition-colors"
    >
      🔄 もう一回！
    </button>
  )}

  {/* ホームへ */}
  <button onClick={onClose} className="flex-1 py-2.5 ... text-white/40 text-sm">
    ホームへ
  </button>
</div>
```

### 呼び出し元（home/page.tsx）の変更

`handleSpinWithSameMembers` 関数を追加：
現在のメンバーでそのまま再スピンする。

```typescript
// app/home/page.tsx
const handleRespin = () => {
  setWinner(null)       // WinnerCard を閉じる
  startSpin(participants.length)  // 同じメンバーで即スピン
}

<WinnerCard
  // ...
  onRespin={handleRespin}
/>
```

### アニメーション考慮

`onRespin()` 実行時は WinnerCard を即 close せず、
100ms の fade-out 後にスピン開始することで遷移が自然に見える。

## 完了条件

- [x] Phase B に「もう一回！」ボタンが表示される
- [x] タップ 1 回で WinnerCard が閉じ・同メンバーでスピンが即開始する
- [x] ボタンが視認しやすいサイズ・位置にある（シェアボタンの次）
- [x] `npm run build` でエラーなし

## 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `components/winner-card.tsx` | `onRespin` props 追加・Phase B ボタン昇格 |
| `app/home/page.tsx` | `handleRespin` 追加・WinnerCard に渡す |

## リスク

低。コールバック追加のみ。`onRespin` が undefined の場合はボタン非表示で既存動作を維持。

## ステータス

**完了** — 2026-04-04

## 優先度

**Critical** — 感情スコア「再挑戦」の最大改善施策。実装コスト小（〜2時間）でスコア影響大。

## 期待効果

- 感情スコア「再挑戦したくなるか」: 5 → 8 (+3)
- HEART Engagement: 12 → 14 (+2)
- 総合スコア: 72 → 74

## 関連ISSUE

- issue-181（WinnerCard Phase B 2-CTA 化）
- issue-193（Phase B 余韻制御）
