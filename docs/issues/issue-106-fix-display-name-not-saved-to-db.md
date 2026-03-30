# issue-106: 公開名を編集してもDBに保存されない問題を修正

## ステータス
✅ 修正済み（commit 1c3833c）

## 優先度
High

## デプロイブロッカー
No（回避策: ページリロードで fallback 名が表示される）

---

## 概要

ISSUE-079 で実装したプロフィール編集シートで公開名（display_name）を変更しても、
ページリロード後に変更が反映されない問題。

---

## 根本原因

### 原因 1: `prisma.profile.update()` が P2025 で失敗

`PATCH /api/profile` ハンドラが `prisma.profile.update()` を使っていた。
`update()` は対象レコードが存在しない場合 `P2025 (RecordNotFoundError)` をスローする。

profile レコードは以下のタイミングで作成される:
- Google OAuth: `app/auth/callback/route.ts` の upsert
- LINE OAuth: `app/api/auth/line/callback/route.ts` の upsert

しかし何らかの理由（ネットワークエラー、途中キャンセル）で profile 作成が失敗した場合、
Supabase Auth にはユーザーが存在するが Prisma profiles にレコードがない状態になる。
その状態で PATCH を呼ぶと P2025 → 500 エラー → フロント側では「保存に失敗しました」表示。

### 原因 2: Prisma クライアントが stale（displayName フィールド未反映）

ISSUE-079 で `display_name` カラムを追加したあと `prisma generate` を実行していなかった。
そのため `node_modules/.prisma/client/` が古いまま残り、
`displayName` フィールドが SQL に含まれず無言で保存されないケースがあった。

---

## 修正内容

### `app/api/profile/route.ts`

```typescript
// Before (バグあり)
const profile = await prisma.profile.update({
  where: { id: user.id },
  data,
})

// After (修正済み)
const profile = await prisma.profile.upsert({
  where: { id: user.id },
  update: data,
  create: {
    id: user.id,
    email: user.email ?? null,
    ...data,
  },
})
```

`update()` → `upsert()` に変更。profile レコードが未作成でも保存できるよう対応。

### Prisma クライアント再生成

```bash
npx prisma generate
```

`displayName` フィールドをクライアントに反映。
Vercel 再デプロイで `node_modules/.prisma/client/` を最新状態に更新。

---

## 修正されたファイル

- `app/api/profile/route.ts` — `update()` → `upsert()` に変更

---

## 受け入れ条件（確認済み）

- ✅ 公開名を入力して「保存する」をタップすると DB に保存される
- ✅ ページリロード後も変更が反映される
- ✅ profile レコードが未作成のユーザーでも保存できる
- ✅ 空文字保存時は NULL（fallback 名）に戻る

---

## 再発防止

新規カラムを追加する際は必ず `npx prisma generate` を実行し、
Vercel 再デプロイ（または `vercel --prod`）で本番クライアントに反映すること。
