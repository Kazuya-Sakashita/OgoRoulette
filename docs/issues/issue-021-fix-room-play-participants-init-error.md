# [ISSUE-021] RoomPlayPage の `participants` 初期化前参照エラー修正

## 🧩 概要

`RoomPlayPage` で `Cannot access 'participants' before initialization` ランタイムエラーが発生していた。
`useGroups` の後処理として追加した `isCurrentGroupSaved` / `handleSaveGroup` が、後続の `useMemo` で定義される `participants` を先行参照していたことが原因。

---

## 🚨 背景 / なぜ問題か

グループ作成 → メンバー参加 → ルーレット画面遷移時に画面がクラッシュし、ルーレットが回せない状態になっていた。

```
ReferenceError: Cannot access 'participants' before initialization
```

JavaScript の `const` / `let` はブロックスコープ内で巻き上げ（hoist）されるが、
宣言行に到達するまで **Temporal Dead Zone（TDZ）** に入る。
TDZ 期間中に参照すると `ReferenceError` がスローされる。

---

## 🔍 根本原因

**分類：B — 派生変数の定義順ミス**

### コード上の断裂（`app/room/[code]/play/page.tsx`）

```typescript
// ❌ 修正前（行 137〜145 付近）— participants より前にある

const { groups: savedGroups, saveGroup } = useGroups(currentUser)
const isCurrentGroupSaved = savedGroups.some(
  (g) =>
    g.participants.length === participants.length &&  // ← TDZ 参照
    [...g.participants].sort().join() === [...participants].sort().join()  // ← TDZ 参照
)
const handleSaveGroup = async (name: string) => {
  await saveGroup(name, participants)  // ← TDZ 参照
}

// ... 他の state 定義 ...

// --- Derived --- （行 159 付近）— participants の実際の定義
const participants = useMemo(
  () => (membersKey ? membersKey.split("\0") : []),
  [membersKey]
)
```

ISSUE-007 の WinnerCard グループ保存機能を `play/page.tsx` に追加した際（R7 対応）、
`useGroups` の後続コードとして `isCurrentGroupSaved` / `handleSaveGroup` を書いたが、
これらが依存する `participants` の `useMemo` 定義が 20 行以上後にあることを見落とした。

---

## 🛠 修正内容

### 方針

- `useGroups(currentUser)` 呼び出しは元の位置のまま維持する（React Hook の呼び出し順を安定させるため）
- `participants` に依存する `isCurrentGroupSaved` / `handleSaveGroup` を `participants` の定義後に移動する

### 変更後の定義順

```typescript
// ✅ 修正後

// --- Hook 呼び出し（state セクション） ---
const { groups: savedGroups, saveGroup } = useGroups(currentUser)
// ← isCurrentGroupSaved / handleSaveGroup はここには置かない

// --- Derived ---
const membersKey = room?.members.map(getMemberName).join("\0") ?? ""
const participants = useMemo(...)  // ← 先に定義

const isOwner = ...
const { splitAmount, isActive: hasBillInput } = calculateBillSplit(...)
const quickAmounts = [...]

// participants 依存の派生値 — participants の useMemo より後に定義
const isCurrentGroupSaved = savedGroups.some(...)  // ← 後に移動 ✅
const handleSaveGroup = async (name: string) => {  // ← 後に移動 ✅
  await saveGroup(name, participants)
}
```

---

## 📐 影響範囲

| 対象 | 内容 |
|------|------|
| `app/room/[code]/play/page.tsx` | `isCurrentGroupSaved` / `handleSaveGroup` の位置を修正 |
| `WinnerCard` の onSaveGroup | 影響なし（呼び出し箇所は変更なし） |
| ホームページのルーレット | 影響なし（別ファイル） |
| 既存テスト | 96/96 pass 維持 |

---

## 🔍 横断確認（同系統パターン）

コンポーネント内の他の `participants` 参照を確認：

| 行 | 参照箇所 | 定義後か |
|----|----------|---------|
| `calculateBillSplit(totalBill, treatAmount, participants.length)` | Derived セクション内 | ✅ `participants` 定義後 |
| `session.participants?.find(...)` | `roomRanking` useMemo 内 | ✅ Room 型のフィールド（別変数）|
| `handleSpin` / `handleRespin` | Effects/Callbacks 内 | ✅ 実行時評価（定義後）|
| `handleSaveGroup` | WinnerCard の onSaveGroup | ✅ 修正後に定義後 |

他の派生変数（`isOwner`, `isCompleted`, `expiresAtMs`, `isExpired`, `hasBillInput`）はいずれも
それぞれの依存変数より後に定義されており問題なし。

---

## 🔁 再発防止

### ルール
- `useMemo` / `useCallback` で作る派生変数は、それを参照するすべての変数より **前に** 定義する
- `useGroups` など hook の呼び出しと、その返り値を使う派生値は **セクションを分ける**
  - Section 1: Hook 呼び出し（state・effect のみ）
  - Section 2: `--- Derived ---`（派生値、依存順に並べる）
- コードレビュー時に「この変数は何行目で定義されているか」を確認する

### コメントで警告を明示（修正済み）
```typescript
// participants 依存の派生値 — participants の useMemo より後に定義する必要がある
// ※ 定義順を participants より前に置くと TDZ エラー（Cannot access 'participants' before initialization）
const isCurrentGroupSaved = ...
```

---

## 📋 タスク

- [x] `isCurrentGroupSaved` の定義を `participants` 定義後に移動
- [x] `handleSaveGroup` の定義を `participants` 定義後に移動
- [x] `useGroups(currentUser)` 呼び出し位置は維持（Hook 呼び出し順の安定性）
- [x] `npx tsc --noEmit` でエラーなしを確認
- [x] `npx vitest run` で 96/96 pass を確認
- [x] 同系統の TDZ パターンが他にないことを横断確認
- [ ] ブラウザ実機確認: グループ作成 → メンバー参加 → ルーレット画面でクラッシュしないこと

---

## ✅ 受け入れ条件

- [ ] `Cannot access 'participants' before initialization` が発生しない
- [ ] ルーレット画面が正常に表示される
- [ ] グループ作成 → 参加 → ルーレット実行 → WinnerCard 表示まで動作する
- [ ] WinnerCard の「このメンバーを次回も使う」ボタンが正しく動作する
- [ ] 既存テスト 96/96 pass を維持

---

## 🏷 優先度

**Critical**（ルーレット画面クラッシュ）

## 📅 発見日

2026-03-26

## 🔗 関連 Issue

- [ISSUE-017](./issue-017-improve-group-ux.md) — いつものメンバー UX 改善（useGroups 導入元）
- [ISSUE-020](./issue-020-spin-route-guest-host-bug.md) — spin/route.ts ゲストホスト検証の不整合
