# [ISSUE-023] メンバーがいつものグループに参加できる — プリセット名前ピッカー

## 🧩 概要

オーナーが保存済みグループからルームを作成すると、参加者はJOINページでメンバー名の一覧から自分の名前をタップするだけで参加できる。名前を手入力する必要がなくなる。

---

## 🚨 背景 / なぜ問題か

**修正前のメンバー参加フロー:**
1. オーナーがルームを作成 → QRコードを共有
2. メンバーがQRをスキャン → `/join/[code]` へ
3. 「ルームに参加する」ボタン → 名前入力を求められる
4. 名前を手入力 → 参加

**問題点:**
- メンバーが毎回名前を手入力しなければならない
- 入力ミス・表記ゆれが起きやすい（「田中」vs「たなか」など）
- 「いつものグループ」を登録したのに、JOIN時には誰が誰か分からない

**修正後のフロー（いつものグループ利用時）:**
1. オーナーがグループカードをロングプレス →「ルームを作る」
2. ルームにグループメンバー名がプリセットとして登録される
3. メンバーがQRをスキャン → グループ全員の名前が一覧表示
4. 自分の名前をタップ → 即参加 ✅

---

## 🔍 根本原因

| 問題 | 詳細 |
|------|------|
| 参加ページに名前候補なし | JOINページは常に白紙のテキスト入力のみ |
| ルーム作成時にメンバー情報が渡せない | `POST /api/rooms` に事前メンバー名を渡す口がなかった |
| GroupList から「ルームを作る」導線がない | ロングプレスメニューに「ルームを作る」項目がなかった |

---

## 🛠 修正内容

### 1. Schema変更 — `Room.presetMemberNames`

```prisma
model Room {
  // ...
  presetMemberNames String[] @default([]) @map("preset_member_names")
}
```

`prisma/migrations/20260327000000_add_preset_member_names/migration.sql`:
```sql
ALTER TABLE "rooms"
  ADD COLUMN "preset_member_names" TEXT[] NOT NULL DEFAULT '{}';
```

**リスク: 低** — デフォルト `{}` のみ。既存ルームに影響なし。

---

### 2. `POST /api/rooms` — `presetMemberNames` 対応

```typescript
const { name, maxMembers = 10, guestNickname, isPersistent = false, presetMemberNames } = body

const validPresetNames: string[] = Array.isArray(presetMemberNames)
  ? presetMemberNames
      .filter((n: unknown): n is string => typeof n === "string" && n.trim().length > 0 && n.trim().length <= 20)
      .map((n: string) => n.trim())
      .slice(0, 19) // ホスト込み最大20人
  : []

// ホスト名と重複するプリセット名を除外
const filteredPresetNames = validPresetNames.filter(n => n !== resolvedNickname)
```

`maxMembers` はプリセット数を下回らないよう自動調整: `Math.max(maxMembers, filteredPresetNames.length + 2)`

---

### 3. `app/join/[code]/page.tsx` — 名前ピッカーUI

`presetMemberNames` がある場合、テキスト入力の代わりに名前ボタンを表示:

```tsx
{mode === "preset" && room.presetMemberNames.length > 0 && (
  <div>
    <p>あなたはどちらですか？</p>
    {room.presetMemberNames.map((name) => {
      const claimed = claimedNames.includes(name)  // 参加済みは無効化
      return (
        <button key={name} onClick={() => joinWithName(name)} disabled={claimed}>
          {claimed ? `${name} — 参加済み` : name}
        </button>
      )
    })}
    <button onClick={() => setMode("input")}>リストにない名前で参加</button>
  </div>
)}
```

**フォールバック**: プリセットなし → 従来の「名前を入力」UI のまま。

---

### 4. `components/group-list.tsx` — `onCreateRoom` prop + ロングプレスメニュー

```typescript
interface GroupListProps {
  onCreateRoom?: (id: string) => void  // 追加
}

// ロングプレスメニューに追加:
{onCreateRoom && (
  <button onClick={() => { setOpenMenuId(null); onCreateRoom(group.id) }}>
    <Users />
    ルームを作る
  </button>
)}
```

---

### 5. `app/home/page.tsx` — `handleCreateRoomWithGroup`

```typescript
const handleCreateRoomWithGroup = async (id: string) => {
  if (!user) return  // ログインユーザー専用
  const group = savedGroups.find((g) => g.id === id)
  if (!group) return

  const ownerName = user.user_metadata?.name ?? ...
  const res = await fetch("/api/rooms", {
    method: "POST",
    body: JSON.stringify({
      name: group.name,
      maxMembers: Math.max(10, group.participants.length + 2),
      presetMemberNames: group.participants.filter((n) => n !== ownerName),
    }),
  })
  const data = await res.json()
  if (res.ok && data.inviteCode) {
    router.push(`/room/${data.inviteCode}`)  // QRコードロビーへ
  }
}

// GroupList に渡す（ログイン時のみ有効化）
<GroupList
  onCreateRoom={user ? handleCreateRoomWithGroup : undefined}
  ...
/>
```

---

## 📐 影響範囲

| ファイル | 変更内容 |
|----------|---------|
| `prisma/schema.prisma` | `Room.presetMemberNames String[]` フィールド追加 |
| `prisma/migrations/20260327000000_add_preset_member_names/migration.sql` | マイグレーション SQL |
| `app/api/rooms/route.ts` | `POST /api/rooms` に `presetMemberNames` 対応 |
| `app/join/[code]/page.tsx` | プリセット名前ピッカーUI追加 |
| `components/group-list.tsx` | `onCreateRoom` prop + ロングプレスメニュー「ルームを作る」 |
| `app/home/page.tsx` | `handleCreateRoomWithGroup` 実装、GroupList に `onCreateRoom` 渡す |

---

## ⚠️ リスク評価

| 変更 | リスク | 対策 |
|------|--------|------|
| スキーマ追加 | 低 | DEFAULT `{}` で既存データ不変 |
| API 変更 | 低 | `presetMemberNames` は省略可能（後方互換） |
| JOIN ページ UI | 低 | `presetMemberNames` が空なら従来UI のまま |
| GroupList `onCreateRoom` | 低 | オプション prop。渡さなければ従来動作 |
| `handleCreateRoomWithGroup` | 低 | ユーザーログイン時のみ実行。失敗しても UX に影響なし |

---

## 📋 タスク

- [x] Schema: `Room.presetMemberNames` 追加
- [x] Migration SQL 作成（`20260327000000_add_preset_member_names`）
- [x] `npx prisma generate` 実行
- [x] `POST /api/rooms`: `presetMemberNames` バリデーション + 保存
- [x] `app/join/[code]/page.tsx`: 名前ピッカーUI追加
- [x] `components/group-list.tsx`: `onCreateRoom` prop + ロングプレスメニュー「ルームを作る」
- [x] `app/home/page.tsx`: `handleCreateRoomWithGroup` + GroupList に渡す
- [x] `npx tsc --noEmit` エラーなし
- [x] `npx vitest run` 97/97 pass
- [ ] DB マイグレーション実行: `npx prisma migrate dev`（本番適用前に要実行）
- [ ] ブラウザ実機確認:
  - [ ] ホーム画面でグループをロングプレス →「ルームを作る」表示
  - [ ] ルームを作成するとロビーページ（`/room/[code]`）に遷移
  - [ ] 別デバイスから Join ページを開くとメンバー名一覧が表示される
  - [ ] 名前をタップするとルームに参加できる
  - [ ] 参加済みの名前は「参加済み」グレーアウト表示
  - [ ] 「リストにない名前で参加」で通常の名前入力モードに切り替え可能
  - [ ] プリセットなしのルームでは従来の join UI のまま（後方互換）

---

## ✅ 受け入れ条件

- [ ] オーナーがグループロングプレス →「ルームを作る」でルームが作成され、ロビーへ遷移
- [ ] メンバーが JOIN ページを開くとグループメンバー名の一覧が表示される
- [ ] 名前をタップするだけで参加完了（名前入力不要）
- [ ] 参加済みの名前は無効化される（二重参加防止）
- [ ] プリセットにない名前でも「リストにない名前で参加」から参加可能
- [ ] 既存の通常ルーム（プリセットなし）は従来のUIのまま

---

## 🔗 関連 Issue

- [ISSUE-017](./issue-017-improve-group-ux.md) — いつものメンバー UX 改善
- [ISSUE-018](./issue-018-fix-group-create-bug.md) — グループ登録バグ修正
- [ISSUE-022](./issue-022-group-spin-utilization.md) — グループ活用 UX の再設計

## 🏷 優先度

**High**（グループ機能のマルチデバイス活用に直結）

## 📅 作成日

2026-03-27
