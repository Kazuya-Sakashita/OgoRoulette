# [ISSUE-020] spin/route.ts — ゲストホスト検証の不整合と 500 エラー防御強化

## 🧩 概要

`app/api/rooms/[code]/spin/route.ts` のゲストルーム認可ロジックに2つの問題があった。

1. ゲストホスト検索時に `profileId: null` フィルタが欠落しており、`spin-complete` / `reset` と実装が不整合
2. `profile.upsert` の `create` パスが email ユニーク制約に違反した場合に例外が uncaught になり 500 を返す

## 🚨 背景 / なぜ問題か

ユーザー報告：「グループを作成する → メンバーが参加する → ルーレットを回す → 予期せぬエラー」

`spin/route.ts` の `else` ブランチ（ゲストルーム）で:

```typescript
// ❌ 修正前 — profileId フィルタなし
const hostMember = room.members.find(m => m.isHost)
```

一方、`spin-complete/route.ts` と `reset/route.ts` は:

```typescript
// ✅ 正しいパターン
const hostMember = await prisma.roomMember.findFirst({
  where: { roomId: room.id, isHost: true, profileId: null },
})
```

通常のゲストルームでは `isHost=true` のメンバーは1人だけなので実害は出にくいが、
認証メンバーが混在するルームや将来的なデータパターンの変化で誤動作する可能性がある。

### profile.upsert の 500 リスク

`if (user)` ブランチで実行される `profile.upsert` の `create` パスは:
- `Profile.email` の `@unique` 制約に違反すると例外を throw
- この例外は `statusCode` プロパティを持たないため catch ブロックで 500 になる
- 通常は room 作成 / join 時にプロフィールが upsert 済みなので発生しにくいが、
  エッジケース（複数の Supabase auth セッション / レガシーデータ）で起きる可能性がある

## 🛠 修正内容

### 1. ゲストホスト検索に `profileId: null` フィルタを追加

```typescript
// ✅ 修正後
const hostMember = room.members.find(m => m.isHost && m.profileId === null)
```

`spin-complete` / `reset` と同じパターンで一貫性を確保。

### 2. `profile.upsert` を try-catch でガード

```typescript
try {
  await prisma.profile.upsert({ ... })
} catch (upsertErr) {
  // email ユニーク制約違反など — プロフィールが既に存在するケースは続行
  console.warn("[spin] profile upsert skipped:", (upsertErr as Error).message)
}
```

upsert の失敗は続行（プロフィールが別ルートで作成済みの場合）。
真にプロフィールが存在しない場合はトランザクション内の FK 検証で検出される。

### 3. エラーログの改善

```typescript
// ❌ 修正前
console.error("Error in spin:", error)
return NextResponse.json({ error: "Internal server error" }, { status: 500 })

// ✅ 修正後
console.error("[spin] unexpected error:", error instanceof Error ? error.stack : String(error))
return NextResponse.json({ error: "予期せぬエラーが発生しました。時間をおいて再試行してください" }, { status: 500 })
```

スタックトレースを含むログで本番障害を追跡しやすくする。
ユーザー向けエラーメッセージも日本語化。

## 📋 タスク

- [x] `spin/route.ts`: `room.members.find(m => m.isHost)` → `room.members.find(m => m.isHost && m.profileId === null)`
- [x] `spin/route.ts`: `profile.upsert` を try-catch でガード
- [x] `spin/route.ts`: エラーログをスタックトレース付きに改善・エラーメッセージを日本語化
- [ ] ブラウザ実機確認: ゲストルームでのスピンが正常に動作すること
- [ ] 認証ルームでのスピンが正常に動作すること

## ✅ 受け入れ条件

- [ ] ゲストルームで「ルーレットを回す」が正常に完了する
- [ ] 認証ルームで「ルーレットを回す」が正常に完了する
- [ ] `npx tsc --noEmit` でエラーなし
- [ ] 既存テスト pass

## 🔗 関連 Issue

- [ISSUE-005](./issue-005-room-in-session-stuck.md) — spin-complete 失敗時のルームロック
- [ISSUE-006](./issue-006-handlerespin-polling-race.md) — handleRespin 後のポーリング競合

## 🏷 優先度

**High**（ルーレットの主要フロー）

## 📅 発見日

2026-03-26
