# ISSUE-205: saveGroup が名前マッチングのため、グループリネーム後に重複エントリが生成される

## ステータス
🔴 未着手

## 優先度
**Medium**

## カテゴリ
Bug / Data Integrity

## 概要
`lib/group-storage.ts` の `saveGroup` 関数はグループ名の一致でレコードを更新する。グループ名を変更してから保存すると、既存グループ（旧名）は更新されず、新しいエントリが作成される。結果として同じメンバー構成のグループが複数存在するようになる。

## 問題のコード

```typescript
// lib/group-storage.ts:77
export function saveGroup(name: string, participants: string[]): SavedGroup {
  const groups = loadGroups()
  const existing = groups.find((g) => g.name === name)  // 名前で検索
  if (existing) {
    existing.participants = participants
    // ...
    return existing
  }
  // 名前が変わっていると existing が undefined → 新規作成される
  const group: SavedGroup = { id: crypto.randomUUID(), name, ... }
  // ...
}
```

## 再現手順
1. 「飲み会グループ」を保存
2. 「飲み会グループ（追加）」に名前を変更して保存
3. グループリストに「飲み会グループ」と「飲み会グループ（追加）」の2つが存在する

## 影響
- グループが最大20件制限に近づくと、実際よりも早く古いグループが削除される
- ユーザーが意図せず重複グループを持ち、どちらのスピン履歴が正しいか混乱する

## 修正方針

`saveGroup` を ID ベースの更新に変更し、グループ名のリネームを `renameGroup(id, newName)` として分離する。

```typescript
// ID で既存グループを更新
export function updateGroup(id: string, name: string, participants: string[]): SavedGroup | null {
  const groups = loadGroups()
  const existing = groups.find((g) => g.id === id)
  if (!existing) return null
  existing.name = name
  existing.participants = participants
  existing.updatedAt = Date.now()
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups))
  return existing
}

// 新規保存
export function createGroup(name: string, participants: string[]): SavedGroup {
  // ...
}
```

## 影響ファイル
- `lib/group-storage.ts` — `saveGroup` の分割
- `hooks/use-groups.ts` — 呼び出し箇所の更新
- `app/home/page.tsx` — グループ保存/更新フローの整理

## 参照
- ISSUE-200（第4回評価）で BUG-05 として特定
