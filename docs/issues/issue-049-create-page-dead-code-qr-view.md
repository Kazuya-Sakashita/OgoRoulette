# issue-049: `app/room/create/page.tsx` の QR コード・メンバーリスト UI が到達不能なデッドコード

## 概要

`app/room/create/page.tsx` にはルーム作成後の QR コード表示・メンバーリスト・「ルーレットを回す」ボタン UI（230行以上）が実装されているが、ルーム作成直後に `router.replace()` でナビゲートするため、この UI は一切表示されない。`setRoom(data)` が呼ばれないまま別ページに遷移する。

## 背景

ルーム作成ページが初期設計では QR コード + 待機ロビーとして機能することを想定していたと思われる。その後、ロビーページ（`app/room/[code]/page.tsx`）が作成され、作成後の遷移先として採用された。しかしルーム作成ページの旧 UI が削除されずデッドコードとして残っている。

## 問題点

`app/room/create/page.tsx:119-120`：

```typescript
// Redirect to room lobby — URL now carries the room state (reload-safe)
router.replace(`/room/${data.inviteCode}`)
```

ルーム作成成功後、即座に `/room/[code]`（ロビーページ）に遷移する。この行の前に `setRoom(data)` の呼び出しがないため、`room` state は `null` のまま。

その後に到達すべき UI（line 159〜443）：

```tsx
if (showQRFull && room) { ... }   // QR フルスクリーン表示 — room は null なので条件偽
if (room) {                        // メンバーリスト・「ルーレットを回す」ボタン — 同上
  return (
    <main>...</main>
  )
}
```

これらは `router.replace()` でページが unmount されるため永久に表示されない。

また、`useEffect` で `room.inviteCode` を監視するポーリング（line 58-74）も `room` が設定されないため動作しない。

## 原因

ロビーページへの遷移に切り替えた際に旧 UI の削除が漏れた。コメント「Redirect to room lobby」が追加されており、意図的な変更であることは明らか。

## ユーザー影響

直接のユーザー影響はない（ユーザーはデッドコードを見ない）。しかし：

- 開発者がコードを読む際に混乱する
- 「なぜこんな UI があるのか」という疑問が生まれる
- 将来の変更時に誤って「なぜ room state が設定されていないのか」を調査する時間が生まれる
- バンドルサイズにわずかに影響する（未使用コードが含まれる）

## 修正方針

`app/room/create/page.tsx` から到達不能な UI と関連 state を削除する：

**削除対象:**
- `room` state（`useState<Room | null>(null)`）
- `copied` state
- `showQRFull` state
- `copyInviteLink` 関数
- `shareRoom` 関数
- `shareUrl` 変数
- ポーリング `useEffect`（`room?.inviteCode` 依存）
- `if (showQRFull && room)` ブロック（line 159-231）
- `if (room)` ブロック（line 234-443）

**維持すべきもの:**
- `currentUser`, `guestNickname`, `roomName`, `maxMembers`, `isPersistent`, `loading`, `error` state
- `handleCreate` 関数
- フォーム UI（line 1-158 の入力部分）

## タスク

- [ ] `app/room/create/page.tsx` からデッドコードを削除
- [ ] 削除後に TypeScript コンパイルエラーがないことを確認
- [ ] ルーム作成 → ロビーページ遷移が正常に動作することを確認

## 受け入れ条件

- `app/room/create/page.tsx` がシンプルな作成フォームのみを含む
- ルーム作成後のロビー遷移（`/room/[code]`）が変わらず動作する
- バンドルサイズが削減される

## 優先度

Low

## デプロイブロッカー

No
