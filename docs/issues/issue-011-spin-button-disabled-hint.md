# [ISSUE-011] SPIN ボタンが押せない理由がユーザーに伝わらない

## 🧩 概要

SPIN ボタンは `disabled={phase !== "waiting" || participants.length < 2}` で無効化されるが、`disabled:opacity-50 disabled:cursor-not-allowed` のスタイルのみで理由が表示されない。参加者が 1 人の場合や、フェーズが "preparing"/"spinning" の場合、ユーザーには「なぜ押せないのか」が分からない。

## 🚨 背景 / なぜ問題か

**disabled になるケース:**
1. `participants.length < 2`（参加者が 1 人）→ 「2人以上必要」の説明がない
2. `phase === "preparing"`（API 呼び出し中〜カウントダウン）→ 「準備中...」とは表示されるが一時的なものか分からない
3. `phase === "spinning"`（回転中）→ 同上
4. `phase === "result"`（結果表示中）→ WinnerCard が表示されているが、理由が分かりにくい

**UX 上の問題:**
- 初見ユーザーが「何をすれば押せるようになるのか」分からない
- 参加者追加の UI が折りたたまれていて見つけにくい場合がある
- エラー状態と「正常な待機状態」の区別がない

## 🎯 目的

SPIN ボタンが無効な状態に応じた適切なヒントをボタン付近に表示し、ユーザーが何をすれば次に進めるかを理解できるようにする。

## 🔍 影響範囲

- **対象機能:** SPIN ボタン / UX 改善
- **対象画面:** `/room/[code]/play`、`/home`
- **対象コンポーネント:** `app/room/[code]/play/page.tsx`

## 🛠 修正方針

SPIN ボタン直下に条件別ヒントテキストを追加する:

```tsx
// SPIN ボタン直下に追加
const spinHint = (() => {
  if (phase === "result") return "結果カードを閉じると再スピンできます"
  if (phase === "preparing" || phase === "spinning") return null // ボタン自体に表示済み
  if (participants.length < 2) return "参加者を2人以上追加してください"
  return null
})()

{spinHint && (
  <p className="text-xs text-muted-foreground text-center mt-2">
    {spinHint}
  </p>
)}
```

**ホーム画面（`/home`）でも同様の修正を適用。**

## ⚠️ リスク / 副作用

- 低リスク。テキスト追加のみで既存ロジックへの変更なし

## ✅ 確認項目

- [ ] 参加者が 1 人のとき「2人以上追加してください」が表示される
- [ ] `phase === "result"` のとき「結果カードを閉じると再スピンできます」が表示される
- [ ] SPIN が有効なとき（`phase === "waiting"` && `participants.length >= 2`）ヒントが表示されない

## 🧪 テスト観点

**手動確認:**
1. 参加者 1 人でプレイページを開く → ヒントテキスト確認
2. スピン完了後の `phase = "result"` → ヒントテキスト確認
3. SPIN 有効時にヒントが表示されないことを確認

## 📌 受け入れ条件（Acceptance Criteria）

- [ ] `participants.length < 2` のとき SPIN ボタン下にヒントが表示される
- [ ] `phase === "result"` のとき SPIN ボタン下にヒントが表示される

## 🏷 優先度

**Medium**

## 📅 実装順序

**11番目**

## 🔗 関連Issue

- [ISSUE-008] WinnerCard の再スピン UX 改善
