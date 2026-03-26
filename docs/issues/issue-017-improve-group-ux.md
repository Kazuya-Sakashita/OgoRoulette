# [ISSUE-017] いつものメンバー UX 改善（グループ動線の再設計）

## 🧩 概要

ホームページの「保存済みグループ」がページ最下部に配置されており、リピーターがグループを使うまでに 4 アクション（スクロール 2 回 + タップ 2 回）かかる。グループ一覧をルーレット上部に移動し、タップ → 即スピンの 2 タップフローに再設計する。あわせて `lastUsedAt` を追加してソート精度を改善し、スピン後に「このメンバーを登録」する導線を設ける。

> **スコープ注記:** `isPersistent Room`（永続ルーム）との統合はこの Issue の対象外。`UserGroup`（参加者名リスト）のホーム UX 改善のみを対象とする。

## 🚨 背景 / なぜ問題か

### 現状のタップ数

```
リピーターの現在フロー（4アクション）:
  1. 画面を下にスクロール（グループ一覧が最下部）
  2. グループをタップ（参加者ロード）
  3. 上にスクロール（SPINボタンが上にある）
  4. SPIN タップ

目標フロー（2タップ）:
  1. グループカードをタップ（画面上部に常時表示）
  2. SPIN タップ
```

### 個別問題

1. **グループ一覧が最下部** — ページ上部にルーレット・SPIN・参加者・保存操作が積み重なっており、グループ一覧はスクロールしないと見えない

2. **「このメンバーを保存」が見つけにくい** — Bookmark アイコンの小さいテキストリンクが参加者セクション内に埋まっている。初回ユーザーが気づけない

3. **最終利用日がない** — `UserGroup` テーブルに `lastUsedAt` カラムがなく、ソートが `updatedAt`（参加者変更日）になっている。グループをロードするだけでは順序が変わらない

4. **メンバー編集ができない** — `PUT /api/groups/[id]` エンドポイントが未実装。名前や参加者を変更するには削除→再作成が必要

5. **`home/page.tsx` が 760 行** — グループ管理ロジックが散在しており、変更コストが高い

## 🎯 目的

- リピーターがいつものメンバーで 2 タップで始められる
- 初回ユーザーがスピン後に自然に「このメンバーを登録」できる
- グループ一覧が最終利用日順に並び、識別しやすい
- グループ管理コードを `useGroups` フックに分離し、保守性を上げる

## 🔍 影響範囲

- **変更ファイル:**
  - `app/home/page.tsx` — グループ一覧を上部に移動、ロジック整理
  - `app/api/groups/route.ts` — ソート変更（`lastUsedAt DESC`）
  - `app/api/groups/[id]/route.ts` — `PUT` ハンドラー追加
  - `prisma/schema.prisma` — `UserGroup.lastUsedAt` 追加
  - `lib/group-storage.ts` — `lastUsedAt` フィールド追加
- **新規ファイル:**
  - `hooks/use-groups.ts` — グループ CRUD + クラウド同期フック
  - `components/group-list.tsx` — グループ一覧コンポーネント
  - `app/api/groups/[id]/use/route.ts` — `lastUsedAt` 更新エンドポイント
  - `components/winner-card.tsx` — 「このメンバーを登録」CTA 追加

## 🛠 修正方針 / 仕様

### ホーム画面レイアウト（変更後）

```
┌─────────────────────────────────────┐
│ OgoRoulette               [履歴][設定]│
├─────────────────────────────────────┤
│     今日の奢りは誰だ？               │
├─────────────────────────────────────┤
│ いつものメンバー                      │  ← ここに移動（現在は最下部）
│ ┌────────────────────────────────┐  │
│ │ ● 飲み会メンバー     3日前  › │  │  ← タップ → 即ロード
│ │   田中 · 鈴木 · 佐藤 · 山田   │  │
│ ├────────────────────────────────┤  │
│ │ ● チームランチ       先週   › │  │
│ │   山田 · 伊藤 · 渡辺          │  │
│ └────────────────────────────────┘  │
│ [+ 新しいグループを作成]              │
├─────────────────────────────────────┤
│         [ルーレットホイール]          │
├─────────────────────────────────────┤
│          [  SPIN  ]                  │
├─────────────────────────────────────┤
│ 参加者  田中 · 鈴木 · 佐藤 · 山田   │
│ [+ メンバーを追加]                   │
├─────────────────────────────────────┤
│ [ルームを作成（みんなで参加）]        │
│ [QRで参加]                           │
└─────────────────────────────────────┘
```

### グループカードの状態

```
通常状態:
  ● 飲み会メンバー     3日前  ›
    田中 · 鈴木 · 佐藤 · 山田

選択状態（タップ後）:
  ✓ 飲み会メンバー     3日前   ← ハイライト + チェックマーク
    田中 · 鈴木 · 佐藤 · 山田

長押し時:
  → [編集] [削除] アクションが出現
  削除は即時（Undo バナーを 3 秒表示）
```

### グループからのスピンフロー

1. グループカードをタップ
2. `participants` に即反映、カードが選択状態に変化
3. `POST /api/groups/[id]/use` を fire-and-forget で呼ぶ（`lastUsedAt` 更新）
4. ページは動かず（スクロールなし）、参加者セクションが更新されるのみ
5. ユーザーは SPIN ボタンをタップ

### WinnerCard への「このメンバーを登録」CTA 追加

```
WinnerCard（スピン後表示）
 ├─ [もう一回！]
 ├─ [このメンバーを登録]  ← 現在のメンバーが未保存のとき表示
 │   タップ → グループ名入力（インライン）→ 保存
 └─ [動画をシェア]
```

### グループ編集フロー

```
グループカードを長押し
 ├─ [✏ 編集]
 │   → グループ名・メンバーをインライン編集
 │   → 保存: PUT /api/groups/[id]
 └─ [🗑 削除]
     → 確認なし（Undo バナーを 3 秒表示）
     → DELETE /api/groups/[id]
```

### `useGroups` フック設計

```typescript
// hooks/use-groups.ts
interface UseGroupsReturn {
  groups: SavedGroup[]
  selectedGroupId: string | null
  selectGroup: (id: string) => void       // ロード + lastUsedAt 更新
  saveGroup: (name: string, participants: string[]) => Promise<void>
  updateGroup: (id: string, data: { name?: string; participants?: string[] }) => Promise<void>
  deleteGroup: (id: string) => Promise<void>
}
```

### Prisma スキーマ変更

```prisma
model UserGroup {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId       String    @map("user_id") @db.Uuid
  name         String
  participants String[]
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  lastUsedAt   DateTime? @map("last_used_at")   // 追加

  user Profile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, name])
  @@index([userId])
  @@index([userId, lastUsedAt])   // 追加（ソート用）
  @@map("user_groups")
}
```

> `usageCount` は追加しない。`RouletteSession` から算出できる。denormalize するとデータ不整合リスクがある。

### API 設計（最終）

```
GET    /api/groups              既存（lastUsedAt DESC, updatedAt DESC のフォールバック）
POST   /api/groups              既存（upsert）
PUT    /api/groups/[id]         新規（名前・参加者の更新）
DELETE /api/groups/[id]         既存
POST   /api/groups/[id]/use     新規（lastUsedAt = now()）
```

## ⚠️ リスク / 副作用

- **スコープ外の誘惑**: `isPersistent Room` との統合を試みると複雑度が 2 倍になる。本 Issue の対象外として厳守する
- **`home/page.tsx` の肥大化**: グループ関連コードを `useGroups` に分離しないと変更が難しくなる。フック分離を最初に行うこと
- **ローカルストレージとの同期**: `lastUsedAt` を localStorage にも保持し、未ログインユーザーでもソートが効くようにする
- **iOS Safari のローカルストレージ制限**: ログイン済みユーザーは DB が正式なデータソースとなるため影響なし

## 📋 タスク

### Task 1: スキーマ変更（前提）

- [ ] `prisma/schema.prisma` — `UserGroup.lastUsedAt DateTime?` 追加
- [ ] `prisma/schema.prisma` — `@@index([userId, lastUsedAt])` 追加
- [ ] `prisma migrate dev` 実行

### Task 2: API 変更

- [ ] `GET /api/groups` — ソートを `[lastUsedAt: "desc", updatedAt: "desc"]` に変更
- [ ] `PUT /api/groups/[id]` — 名前・参加者更新ハンドラー追加
- [ ] `POST /api/groups/[id]/use` — `lastUsedAt` 更新エンドポイント新規作成

### Task 3: `useGroups` フック作成

- [ ] `lib/group-storage.ts` — `SavedGroup` 型に `lastUsedAt: string | null` 追加
- [ ] `hooks/use-groups.ts` — CRUD + クラウド同期フック作成
- [ ] `selectGroup` でローカル `lastUsedAt` を即更新し、`/use` を fire-and-forget

### Task 4: `GroupList` コンポーネント作成

- [ ] `components/group-list.tsx` — カード一覧（名前・メンバー名・最終利用相対時間）
- [ ] グループカードの選択状態（ハイライト + チェックマーク）
- [ ] 長押し → 編集・削除アクション
- [ ] 楽観的削除（即時 UI 反映 + Undo バナー）

### Task 5: `home/page.tsx` レイアウト変更

- [ ] グループ一覧をルーレット上部に移動
- [ ] `useGroups` フックを利用するようにリファクタリング
- [ ] グループタップ時は `setParticipants` を呼ぶのみ（スクロールなし）
- [ ] 参加者セクション下部の「このメンバーを保存」小テキストを削除（WinnerCard に移動）

### Task 6: WinnerCard に保存 CTA 追加

- [ ] `components/winner-card.tsx` — `onSaveGroup?: (participants: string[]) => void` props 追加
- [ ] 現在の参加者が未保存グループのとき「このメンバーを登録」ボタン表示
- [ ] タップ → グループ名インライン入力 → `saveGroup()` 呼び出し

### 名称統一

- [ ] 「保存済みグループ」→「いつものメンバー」へ表示テキスト変更
- [ ] 「このメンバーを保存」→「このメンバーを登録」へ変更

## ✅ 受け入れ条件（Acceptance Criteria）

- [ ] グループ一覧がルーレット上部に表示される（スクロールなしで見える）
- [ ] グループタップ → SPIN が 2 タップで完了する
- [ ] グループの最終利用日が相対時間（「3日前」「先週」）で表示される
- [ ] グループ一覧が `lastUsedAt` 降順でソートされる
- [ ] グループの名前・メンバーを編集できる
- [ ] WinnerCard 内に「このメンバーを登録」CTA が表示される（未保存時）
- [ ] 未ログインユーザーも localStorage 経由でグループを保存・利用できる
- [ ] ログイン済みユーザーは DB にも保存され、`lastUsedAt` が更新される

## 🏷 優先度

**Medium**（継続利用率に直結するが、クリティカルバグではない）

## 📅 実装順序

**17番目**（基本機能完成後の UX 改善フェーズ）

## 🔗 関連 Issue

- [ISSUE-014](./issue-014-persistent-group-rooms.md) — 常設グループ機能（`isPersistent Room`。本 Issue とは別概念）
- [ISSUE-013](./issue-013-analytics-setup.md) — 分析基盤（`lastUsedAt` データの活用）
- [ISSUE-008](./issue-008-winner-card-respin-ux.md) — WinnerCard UX（保存 CTA の配置先）
