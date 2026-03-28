# issue-046: 期限切れルームへの GET が HTTP 400 を返す — セマンティクス不正確 + クライアント未対応

## 概要

`GET /api/rooms/[code]` は期限切れルームに対して `HTTP 400 Bad Request` を返す。正しいステータスコードは `410 Gone` または `404 Not Found`。また、クライアント（`app/room/[code]/page.tsx`、`app/room/[code]/play/page.tsx`）は `expired` フラグを個別に処理せず、汎用エラー表示になる。

## 背景

ルームには24時間の有効期限（常設グループを除く）があり、期限切れルームへのアクセスはエラーになる。しかし HTTP ステータスが意味的に誤っており、クライアントが期限切れを判定できない。

## 問題点

### API 側（`app/api/rooms/[code]/route.ts:48-53`）

```typescript
if (room.expiresAt && room.expiresAt < new Date()) {
  return NextResponse.json({
    error: "このルームは有効期限が切れています",
    expired: true
  }, { status: 400 })   // ← 400 Bad Request は不正確
}
```

`400 Bad Request` はクライアントのリクエストが不正な場合のコード。期限切れリソースには `410 Gone` が適切（永続的に消滅）または `404 Not Found`（存在しないリソース扱い）。

### クライアント側（`app/room/[code]/page.tsx:59-62`）

```typescript
if (!res.ok) {
  isCompletedRef.current = true // stop polling on error
  setError(data.error || "ルームが見つかりません")
  return
}
```

`expired: true` フラグを個別に処理していない。「ルームが見つかりません」と表示されるが、実際には「期限切れ」であり、ユーザーへの案内が異なる（「新しいルームを作成」へ誘導すべき）。

`app/room/[code]/play/page.tsx:215-219` も同様にフラグ未処理。

## 原因

- API 実装時に適切な HTTP ステータスコードが選ばれなかった
- クライアントが `expired` フラグを活用するロジックが未実装

## ユーザー影響

- 期限切れルームに入ったユーザーが「ルームが見つかりません」と表示される（誤メッセージ）
- 「新しいルームを作成」ボタンへの誘導がなく、次のアクションが不明
- ロビーページには期限切れバナー（ISSUE-010 対応）があるが、API が 400 を返すのでバナーが表示される前にエラー画面になる

## 技術的リスク

- 外部 API クライアントや監視ツールが `400` を見て「クライアントのバグ」と判定する
- Sentry 等のエラートラッキングで `400` は通常アラートにならないが `4xx` 分類は正しい

## 修正方針

### API 側

```typescript
// app/api/rooms/[code]/route.ts
if (room.expiresAt && room.expiresAt < new Date()) {
  return NextResponse.json({
    error: "このルームは有効期限が切れています",
    expired: true
  }, { status: 410 })  // 400 → 410 Gone
}
```

### クライアント側（ロビーページ）

```typescript
if (!res.ok) {
  if (data.expired) {
    setError("expired")  // 専用状態
    return
  }
  setError(data.error || "ルームが見つかりません")
  return
}
```

エラー表示を期限切れ専用メッセージ + 「新しいルームを作成」ボタンに変更。

## タスク

- [ ] `app/api/rooms/[code]/route.ts` のステータスコードを 400 → 410 に変更
- [ ] `app/room/[code]/page.tsx` で `expired: true` フラグを個別ハンドリング
- [ ] `app/room/[code]/play/page.tsx` で同様に修正
- [ ] 期限切れエラー画面に「新しいルームを作成」ボタンを追加

## 受け入れ条件

- 期限切れルームへのアクセスが HTTP 410 を返す
- ロビー/プレイページで「期限切れ」専用のエラーメッセージが表示される
- 「新しいルームを作る」ボタンが表示される

## 優先度

Medium

## デプロイブロッカー

No
