# [ISSUE-022] グループ活用 UX の再設計 — 1タップでスピン開始

## 🧩 概要

グループ登録はできるが「登録したグループを使う」導線が不明確で、ユーザーが活用できない状態になっていた。
GroupList の各グループカードに「▶ 回す」ボタンを追加し、1タップでそのメンバーをセットしてスピンを開始できるようにした。

---

## 🚨 背景 / なぜ問題か

**修正前の操作フロー（3ステップ）:**
1. グループをタップ → 参加者リストが下部で更新される（見えない）
2. 画面をスクロールして SPIN ボタンを見つける
3. SPIN を押す

この流れは「グループを選んだら何が起きるのか」が不明確で、多くのユーザーが「保存したのに使えない」と感じる原因となっていた。

**修正後の操作フロー（1タップ）:**
- グループカード右端の「▶（Play）ボタン」をタップ → 即座にそのメンバーでスピン開始

---

## 🔍 根本原因

| 問題 | 詳細 |
|------|------|
| UX の分断 | GroupList（上部）とルーレット SPIN（下部）の間に視覚的つながりがなかった |
| 操作の非直感性 | タップ = 参加者更新 だが、その事実がユーザーに伝わっていなかった |
| 即時アクション不足 | 選択後の「次の行動」が明示されていなかった |
| スピン関数の設計 | `handleSpin()` が `participants` state に依存していたため、state 更新前に呼ぶと不具合が起きていた |

---

## 🛠 修正内容

### 1. `components/group-list.tsx` — `onSpin` prop + Play ボタン追加

```typescript
interface GroupListProps {
  // ...
  onSpin?: (id: string) => void  // 追加: 即時スピン用コールバック
}
```

各グループカードの右端に Play ボタンを追加:

```tsx
{onSpin && (
  <button
    onClick={(e) => { e.stopPropagation(); onSpin(group.id) }}
    className="shrink-0 w-8 h-8 rounded-xl bg-primary/20 hover:bg-primary/40 ..."
    title={`${group.name}ですぐ回す`}
  >
    <Play className="w-3.5 h-3.5 fill-primary" />
  </button>
)}
```

カード構造も変更:
- `<button>` 全体 → `<div>` + 内部に `<button>`（左半分: 選択）+ `<button>`（右端: スピン）
- これにより「選択」と「スピン」が独立した操作になる

### 2. `app/home/page.tsx` — `startSpin` 抽出 + `handleSpinWithGroup` 追加

```typescript
// スピン開始の共通ロジック — participantCount を引数にすることで state に依存しない
const startSpin = (participantCount: number) => {
  if (isSpinning || participantCount < 2 || countdown !== null) return
  setWinner(null)
  resetRecording()
  setRecordingPhase("countdown")
  setCountdown(3)
  countdownTimersRef.current = [
    setTimeout(() => setCountdown(2), 1000),
    setTimeout(() => setCountdown(1), 2000),
    setTimeout(() => { setCountdown(null); setIsSpinning(true); startRecording() }, 3000),
  ]
}

const handleSpin = () => startSpin(participants.length)

// 1タップでグループメンバーをセット → 即スピン
const handleSpinWithGroup = (id: string) => {
  const members = selectGroup(id)  // participants 更新 + 返り値で即時利用可
  setParticipants(members)
  startSpin(members.length)  // state 更新を待たず members.length を直接渡す
}
```

**設計のポイント:** `startSpin(count)` に参加者数を渡す設計にすることで、`setParticipants` の非同期な state 更新を待たずに正しいカウントでスピンを開始できる。

---

## 📐 影響範囲

| ファイル | 変更内容 |
|----------|---------|
| `components/group-list.tsx` | `onSpin` prop 追加、Play ボタン追加、カード構造を `div + 2 button` に変更 |
| `app/home/page.tsx` | `handleSpin` を `startSpin` + `handleSpin` + `handleSpinWithGroup` に分割、`onSpin` prop 追加 |

---

## 📋 タスク

- [x] `GroupList`: `onSpin?: (id: string) => void` prop を追加
- [x] `GroupList`: 各グループカードに Play ボタンを追加
- [x] `GroupList`: カード構造を div + 選択ボタン + スピンボタンの形に変更
- [x] `home/page.tsx`: `startSpin(count)` を抽出
- [x] `home/page.tsx`: `handleSpinWithGroup` を実装
- [x] `home/page.tsx`: `onSpin={handleSpinWithGroup}` を GroupList に渡す
- [x] `npx tsc --noEmit` でエラーなしを確認
- [x] `npx vitest run` で 97/97 pass を確認
- [ ] ブラウザ実機確認: グループカードの「▶」ボタンでスピンが開始されること
- [ ] 選択（タップ）と即時スピン（▶）の両操作が独立して動作すること
- [ ] ロングプレスメニュー（編集・削除）が引き続き正常に動作すること

---

## ✅ 受け入れ条件

- [ ] グループカードの「▶」ボタンをタップすると、そのメンバーでカウントダウンが始まる
- [ ] グループカードの名前部分タップ → 参加者リストが更新されるだけ（スピンしない）
- [ ] ロングプレスで編集・削除メニューが開く
- [ ] 既存のすべての機能（登録・編集・削除・選択）が引き続き動作する
- [ ] `onSpin` を渡さない場合（play ページなど）は Play ボタンが表示されない

---

## 🔗 関連 Issue

- [ISSUE-017](./issue-017-improve-group-ux.md) — いつものメンバー UX 改善（本 Issue の前提）
- [ISSUE-018](./issue-018-fix-group-create-bug.md) — グループ登録バグ修正
- [ISSUE-021](./issue-021-fix-room-play-participants-init-error.md) — participants 初期化前参照エラー

## 🏷 優先度

**High**（グループ機能の価値提供に直結）

## 📅 作成日

2026-03-26
