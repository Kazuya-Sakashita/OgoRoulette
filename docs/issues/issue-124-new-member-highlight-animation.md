# ISSUE-124: 新規メンバー参加時にリスト行をハイライトする

## 概要

ロビー（waiting room）で新しいメンバーが参加した際、
そのメンバーの行を一時的にハイライト表示して「今来た」ことを視覚的に伝える。

---

## 背景

- メンバーリストが更新されても誰が新しく来たか分からない
- ポーリング（fetchRoom）で検出した新着メンバーを区別する仕組みがなかった
- 「友達が来た」という体験が地味になっており、参加の嬉しさが伝わらない

---

## 修正内容

### `app/room/[code]/page.tsx`

```ts
// 新規メンバーIDのセット
const [newMemberIds, setNewMemberIds] = useState<Set<string>>(new Set())

// fetchRoom 内: 前回のメンバー一覧と比較して新着を検出
const prevIds = new Set(room?.members.map(m => m.id) ?? [])
const newMembers = data.members.filter((m: Member) => !prevIds.has(m.id))
if (newMembers.length > 0) {
  setNewMemberIds(new Set(newMembers.map((m: Member) => m.id)))
  // 3秒後にクリア
  setTimeout(() => setNewMemberIds(new Set()), 3000)
}

// メンバーリスト行の条件付きスタイル
className={`... ${newMemberIds.has(member.id) ? "ring-2 ring-primary/60" : ""}`}
```

- 新規参加から3秒間、`ring-2 ring-primary/60`（プライマリカラーのボーダーグロー）を表示
- 3秒後に自動クリア
- ページ初回ロード時は全メンバーが「既存」として扱われる（`prevIds` が空のため）

---

## 影響範囲

- `app/room/[code]/page.tsx`
- ロビーでのメンバー参加体験の向上
- ポーリング間隔（3秒）より長いハイライト時間（3秒）で確実に表示

---

## ステータス

✅ 完了（commit: c23bf2b）
