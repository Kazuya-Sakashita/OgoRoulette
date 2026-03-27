# ISSUE-051: ログアウト後もグループ情報が表示される不具合の修正

## ステータス
✅ 完了

## 概要
ログアウト後も localStorage に残ったグループ情報が、未ログイン状態の次回訪問者に表示される問題を修正した。

## 背景
ログイン中にグループを保存・使用すると、グループデータが `ogoroulette_groups` キーで localStorage に書き込まれる。
ログアウト時に `supabase.auth.signOut()` しか実行されず、localStorage のクリーンアップが一切行われていなかった。
その結果、ログアウト後も前ユーザーのグループが残り、次に /home を開いた人（ゲスト・別ユーザー問わず）に表示されていた。

## 再現手順
1. ログインする
2. グループを保存する（クラウド同期される = `cloudId` がつく）
3. ログアウトする
4. `/home` を開く（または別ユーザーが開く）
5. **前ユーザーのグループが表示される** ← 不具合

## 原因分類

| 分類 | 内容 |
|------|------|
| A. localStorage 削除漏れ | `handleLogout` が `supabase.auth.signOut()` + `router.push('/')` のみ。`ogoroulette_groups` / `ogoroulette_treat_stats` を削除しない |
| D. 認証状態ガード不足 | `useGroups(user)` は `user` 依存で localStorage を読み込むが、`user=null` 時も同じキーから読み込む（ゲスト利用と区別しない） |
| E. ユーザー切替時 state reset 不足 | `user` が null になっても React state の `groups` がリセットされない |

## 根本原因

**主原因**: `handleLogout` が localStorage を一切クリアしない（`app/home/page.tsx:126-130`）

**副原因**: `useGroups` が `user=null` 時に groups state をリセットしない（`hooks/use-groups.ts:27-30`）

**設計上の問題**: グループデータはローカルファースト設計（ゲストでも使える）だが、ユーザー単位のスコープがない。ログアウト後も同じキーを読むため、前ユーザーのデータが混入する。

## 修正内容

### `lib/group-storage.ts` — `clearUserGroupData()` 追加
```typescript
export function clearUserGroupData(): void {
  if (typeof window === "undefined") return
  // cloudId のないローカルのみグループは残す（ゲスト利用データは保護）
  const localOnly = loadGroups().filter((g) => !g.cloudId)
  if (localOnly.length > 0) {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(localOnly))
  } else {
    localStorage.removeItem(GROUPS_KEY)
  }
  // treat stats はユーザー依存なので全削除
  localStorage.removeItem(STATS_KEY)
}
```

**設計の選択**: `cloudId` 付きグループ（クラウド同期済み = ログイン時に紐付いたデータ）のみ削除。`cloudId` なしのグループ（デバイスローカルのゲストデータ）は保持する。これにより「ゲストとして使っていたグループ」が誤削除されない。

### `app/home/page.tsx` — `handleLogout` 修正
```typescript
const handleLogout = async () => {
  const supabase = createClient()
  clearUserGroupData()        // ← 追加
  await supabase.auth.signOut()
  router.push('/')
}
```

### `hooks/use-groups.ts` — user → null 時の state リセット追加
```typescript
// user が null になったとき（ログアウト）は React state もリセット
useEffect(() => {
  if (user === null && isLoaded) {
    setGroups(loadGroups())
    setSelectedGroupId(null)
  }
}, [user, isLoaded])
```

logout 後に localStorage がクリーンになるため、`loadGroups()` が呼ばれると正しく空（またはローカルのみ）が返る。ページ遷移なしでログアウトが発生するケース（将来の実装）でも対応できる。

## 動作確認

| 確認項目 | 結果 |
|---------|------|
| `clearUserGroupData` が cloudId 付きグループを削除する | ✅ |
| `clearUserGroupData` が cloudId なしグループを保持する | ✅ |
| `clearUserGroupData` が treat stats を削除する | ✅ |
| ログアウト後のページに前ユーザーのグループが出ない | ✅（localStorage クリア確認） |
| TypeScript 型エラーなし | ✅ |

## 影響範囲
- `lib/group-storage.ts`: `clearUserGroupData` 追加（既存関数変更なし）
- `app/home/page.tsx`: `handleLogout` に1行追加
- `hooks/use-groups.ts`: `user=null` 時の state リセット effect 追加

## 残課題
- **マルチタブ logout**: 別タブからログアウトしてもこのタブの React state はリセットされない。`onAuthStateChange` リスナーを追加すれば対応可能だが、本修正の範囲外とした。

## 優先度
🔴 Critical — 認証境界を侵害するセキュリティ/信頼性の問題

## 発見
ユーザー報告（2026-03-28）
