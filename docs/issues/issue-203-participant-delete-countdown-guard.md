# ISSUE-203: カウントダウン中に参加者削除が可能（勝者インデックスズレ）

## ステータス
✅ 完了 — 2026-04-05

## 優先度
**Major**

## カテゴリ
Bug / UX / Data Integrity

## 概要
`app/home/page.tsx` の参加者削除ボタンは `participants.length > 2` のみをガードとしており、スピン中やカウントダウン中でも削除可能。カウントダウン完了後のスピンは `targetWinnerIndex` で勝者を決定するが、削除によって配列インデックスがズレると意図しない参加者が当選する。

## 問題のコード

```typescript
// app/home/page.tsx:452
const removeParticipant = (index: number) => {
  if (participants.length > 2) {
    setParticipants(participants.filter((_, i) => i !== index))
  }
}

// app/home/page.tsx:1106
<button
  onClick={() => removeParticipant(index)}  // countdown ガードなし
  ...
>
```

## 再現手順
1. 参加者3人以上でカウントダウン（3→2→1）を開始
2. カウントダウン中に誰かの名前の削除ボタンを押す
3. `participants` 配列が縮む
4. スピンが完了し、元のインデックスに対応する参加者が存在しなくなる（またはズレる）

## 影響
- 「Aさん」が当たったつもりが「Bさん」が表示される
- `targetWinnerIndex` が配列外参照になった場合、RouletteWheel のレンダリングエラーの可能性

## 修正方針

```typescript
// app/home/page.tsx:1104-1112
<button
  onClick={() => removeParticipant(index)}
  disabled={isSpinning || countdown !== null}  // ← 追加
  aria-label={`${name}を削除`}
  className="..."
>
```

また `removeParticipant` 関数内でも二重ガードを追加:

```typescript
const removeParticipant = (index: number) => {
  if (isSpinning || countdown !== null) return  // ← 追加
  if (participants.length > 2) {
    setParticipants(participants.filter((_, i) => i !== index))
  }
}
```

## 影響ファイル
- `app/home/page.tsx` — `removeParticipant` 関数と削除ボタンの `disabled` 属性

## 修正工数
約 30 分

## 参照
- ISSUE-200（第4回評価）で BUG-03 として特定
