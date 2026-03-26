# [ISSUE-019] Hydrationエラー（GroupList）の修正

## 🧩 概要

GroupList において、SSR とCSR の初回描画内容が不一致になり React の Hydration エラーが発生していた。`useGroups` フックの `useState` lazy initializer が `localStorage` を直接読み取る実装になっており、サーバー側では `[]`、クライアント側では保存済みグループデータを返すため DOM が一致しなかった。

## 🚨 背景 / なぜ問題か

Next.js App Router では `"use client"` コンポーネントも SSR で描画される。`useState` の lazy initializer はサーバーとクライアント両方で実行されるが、`localStorage` はブラウザ専用 API であるため両者の結果が異なり、React の Hydration 検証で不一致が検出されエラーが発生する。

**影響範囲:**

- ホーム画面初回ロード時に `console.error` Hydration warning が発生
- グループ保存済みユーザーでは、SSR（空状態）→ CSR（グループ一覧）へのチラつきが発生
- Next.js は不一致 DOM を CSR 側で上書きするためアプリは機能するが、パフォーマンスとデバッグ体験が損なわれる

## 🔍 根本原因

### コード上の断裂（調査で特定）

**`hooks/use-groups.ts:18`（修正前）:**

```typescript
// ❌ lazy initializer が SSR/CSR 両方で実行される
const [groups, setGroups] = useState<SavedGroup[]>(() => loadGroups())
```

**`lib/group-storage.ts:36-43`（変更なし）:**

```typescript
export function loadGroups(): SavedGroup[] {
  if (typeof window === "undefined") return []  // SSR → 常に []
  return JSON.parse(localStorage.getItem(GROUPS_KEY) || "[]")  // CSR → 保存データ
}
```

**SSR/CSR での描画差分:**

| フェーズ | `useState(() => loadGroups())` | GroupList 描画 |
|----------|-------------------------------|----------------|
| SSR | `window === undefined` → `[]` | 空状態 UI |
| CSR hydration | `localStorage` → `[...groups]` | グループ一覧 |
| **差分** | | **Hydration error** |

### 副原因

`components/group-list.tsx:18` の `relativeTime(Date.now())` も SSR/CSR で値が異なるが、primary fix の `loading` ガードで GroupList が SSR 時に `null` を返すことにより自動的に解消する。

## 🛠 修正内容

### 修正方針

1. `useState` の初期値を `[]`（SSR-safe）に固定し、`localStorage` 読み込みを `useEffect` 内に移動
2. `isLoaded` フラグを追加して「未読み込み」と「空」を明確に区別
3. `GroupList` に `loading` prop を追加し、`isLoaded=false` の間は `null` を返す

### 変更ファイル

#### `hooks/use-groups.ts`

```typescript
// ✅ 修正後
const [groups, setGroups] = useState<SavedGroup[]>([])  // SSR-safe な初期値
const [isLoaded, setIsLoaded] = useState(false)

// hydration-safe localStorage load — クライアントのみ、hydration 後に実行
useEffect(() => {
  setGroups(loadGroups())
  setIsLoaded(true)
}, [])

// ...
return { groups, isLoaded, selectedGroupId, ... }
```

#### `components/group-list.tsx`

```typescript
interface GroupListProps {
  groups: SavedGroup[]
  loading?: boolean  // 追加
  // ...
}

export function GroupList({ groups, loading = false, ... }) {
  // SSR/CSR 初回描画は null で一致させる
  if (loading) return null

  if (groups.length === 0) { ... }  // 空状態
  return ( ... )  // データあり
}
```

#### `app/home/page.tsx`

```typescript
const { groups: savedGroups, isLoaded: groupsLoaded, ... } = useGroups(user)

<GroupList
  groups={savedGroups}
  loading={!groupsLoaded}  // 追加
  ...
/>
```

### 状態遷移（修正後）

```
SSR              → groups=[], loading=true → GroupList: null
CSR hydration    → groups=[], loading=true → GroupList: null  ← SSR と一致 ✅
useEffect 実行    → groups=[...], loading=false
CSR re-render    → グループ一覧 or 空状態を正しく描画
```

## 📋 タスク

- [x] `useGroups`: `useState` lazy initializer を `[]` に変更
- [x] `useGroups`: `useEffect` で hydration 後に `loadGroups()` を呼ぶ
- [x] `useGroups`: `isLoaded` フラグを追加・return に含める
- [x] `GroupList`: `loading` prop を追加
- [x] `GroupList`: `loading=true` 時に `null` を返す
- [x] `home/page.tsx`: `isLoaded: groupsLoaded` を受け取り `loading={!groupsLoaded}` を渡す
- [x] `npx tsc --noEmit` でエラーなしを確認
- [x] `npx vitest run` で 96/96 pass を確認
- [ ] ブラウザ実機確認: Console に Hydration warning が出ないこと
- [ ] グループあり/なし両方で初回表示が正しいこと

## ✅ 受け入れ条件

- [ ] ブラウザ Console に `Hydration` 関連エラーが表示されない
- [ ] グループ保存済みユーザーで、ページロード後にグループ一覧が表示される
- [ ] グループ未保存ユーザーで、空状態ガイダンスが表示される
- [ ] ページロード直後の一瞬に「空状態」が見えないこと（`loading` ガードにより非表示）
- [ ] 既存テスト 96/96 pass を維持

## ⚠️ 再発防止

`"use client"` コンポーネントであっても Next.js では SSR が実行される。`localStorage` / `sessionStorage` / `typeof window !== 'undefined'` に依存するコードを `useState` lazy initializer に置かないこと。

**ルール:**
- ブラウザ専用 API (localStorage, sessionStorage, window, document) は必ず `useEffect` 内で使う
- `useState` の初期値は SSR/CSR 両方で同じ値になる定数 or `null` / `[]` / `""` を使う
- ロード前と空を区別する必要がある場合は `isLoaded: boolean` パターンを採用する

## 🏷 優先度

**High**（初回レンダリング品質・React 仕様違反）

## 📅 発見日

2026-03-26

## 🔗 関連 Issue

- [ISSUE-017](./issue-017-improve-group-ux.md) — いつものメンバー UX 改善（本 Issue の原因となった useGroups 導入）
- [ISSUE-018](./issue-018-fix-group-create-bug.md) — グループ登録バグ修正
