# [ISSUE-018] グループ登録ができない不具合の修正

## 🧩 概要

ホーム画面の「いつものメンバー」セクションにある「新しいグループを登録」ボタンをタップしても何も起きない。グループ名入力フォームが表示されず、ユーザーはグループを事前登録できない状態になっていた。

## 🚨 背景 / なぜ問題か

ISSUE-017 の実装（グループ一覧の上部移動・`useGroups` フック分離）のリファクタリング時に、グループ名入力フォーム UI が `home/page.tsx` から削除されたまま復元されなかった。`showSaveInput` 状態は定義・更新されているが、それを使って UI を表示する JSX が欠落していた。

**影響範囲:**
- GroupList の「新しいグループを登録」ボタン → 完全に機能しない
- GroupList の「グループを登録すると1タップで始められます」ボタン → 完全に機能しない
- WinnerCard 経由の「このメンバーを登録」→ 正常動作（影響なし）

## 🔍 根本原因

### コード上の断裂（調査で特定）

**`app/home/page.tsx`（リファクタリング後）:**

```typescript
// L44: showSaveInput 状態は定義されている
const [showSaveInput, setShowSaveInput] = useState(false)

// L375: GroupList の onNew に setShowSaveInput(true) を渡している
onNew={() => setShowSaveInput(true)}

// ← しかし showSaveInput === true のときに表示する JSX が存在しない
// 状態は変わるが、ユーザーには何も見えない
```

**`components/group-list.tsx`:**

```tsx
// onNew は呼ばれる → setShowSaveInput(true) は実行される
<button onClick={onNew}>
  新しいグループを登録
</button>
```

### 副原因

`handleSaveGroup` のシグネチャが `() => void` から `(name: string) => Promise<void>` に変わった際、旧来のインライン入力フォーム（`groupName` state を使うもの）はすべて削除されたが、新しいモーダル UI が追加されなかった。

## 🛠 修正内容

### 最小修正（実施済み）

`home/page.tsx` に `showSaveInput === true` のときに表示するボトムシートモーダルを追加。

```tsx
{showSaveInput && (
  <>
    {/* Backdrop */}
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={closeSaveInput} />
    {/* Bottom sheet */}
    <div className="fixed inset-x-0 bottom-0 z-50 ... rounded-t-3xl bg-[#0F2236]">
      <h3>いつものメンバーを登録</h3>
      <p>{participants.join(" · ")}（{participants.length}人）</p>
      <input type="text" value={newGroupName} ... />
      <Button onClick={() => handleSaveGroup(newGroupName.trim())}>登録</Button>
    </div>
  </>
)}
```

追加した状態:
- `newGroupName: string` — グループ名入力値
- `closeSaveInput()` — モーダルを閉じて `newGroupName` をリセット

### 安全修正（含む）

- `newGroupName` を `closeSaveInput()` 内でリセット → 再度開いたとき前回の入力が残らない
- `disabled={!newGroupName.trim()}` → 空入力での登録を防止
- `Enter` キーで保存、`Escape` キーでキャンセル対応
- Backdrop タップでモーダルを閉じる

### 理想修正（将来対応）

- エラー時のトースト通知（`saveGroup` が失敗しても現在は silent fail）
- グループ数上限（20件）到達時のメッセージ表示
- 重複グループ名のインライン警告

## 📋 タスク

- [x] `newGroupName` state を追加
- [x] `closeSaveInput()` ヘルパーを追加
- [x] `showSaveInput` に対応するボトムシートモーダル JSX を追加
- [x] Enter/Escape キーハンドリング
- [x] Backdrop タップでモーダルを閉じる
- [x] TypeScript エラーがないことを確認（`tsc --noEmit` でクリーン）
- [ ] 動作確認: グループが 0 件のとき「グループを登録すると1タップで始められます」から登録できる
- [ ] 動作確認: グループが 1 件以上のとき「新しいグループを登録」から追加できる
- [ ] 動作確認: 登録後にグループ一覧に即時反映される
- [ ] 動作確認: WinnerCard 経由の登録も引き続き動作する（回帰確認）
- [ ] 動作確認: 空のグループ名では登録ボタンが disabled になる
- [ ] 動作確認: Backdrop タップ・Escape キーでモーダルが閉じる

## ✅ 受け入れ条件

- [ ] GroupList の「新しいグループを登録」ボタンからグループ名入力モーダルが開く
- [ ] グループ名を入力して「登録」を押すとグループ一覧に追加される
- [ ] 登録後にモーダルが閉じ、入力内容がリセットされる
- [ ] 空のグループ名では登録ボタンが押せない
- [ ] ログイン済みユーザーはクラウドにも同期される
- [ ] 未ログインユーザーも localStorage に保存される
- [ ] WinnerCard 経由の登録が引き続き動作する（回帰なし）

## ⚠️ 再発防止

`showSaveInput` のような「状態はあるが UI がない」パターンは、リファクタリング時に発生しやすい。今後は:

1. フォームを伴う状態変数（`show*`, `is*Open` 等）を削除・移動するときは、対応する JSX を同時に確認する
2. TypeScript の `unused variable` 警告を CI で強制する（`showSaveInput` は未使用として検出可能だった）

## 🏷 優先度

**Critical**（主要機能が使えない状態）

## 📅 発見日

2026-03-26

## 🔗 関連 Issue

- [ISSUE-017](./issue-017-improve-group-ux.md) — いつものメンバー UX 改善（本 Issue の原因となったリファクタリング）
