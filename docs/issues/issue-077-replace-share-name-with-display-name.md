# ISSUE-077: シェア・公開箇所の表示名を display_name に切り替える

## ステータス
✅ 完了

## 優先度
Critical

## カテゴリ
Frontend / Privacy

## 概要
外部公開されるすべての箇所で `profile.name`（provider_name）の代わりに
`getDisplayName()` を使用するよう修正する。

## 修正対象ファイル・箇所

| ファイル | 行 | 修正内容 |
|---------|-----|---------|
| `app/home/page.tsx:175-177` | ルーム作成時の ownerName | `getDisplayName(profile)` に変更 |
| `app/history/[id]/page.tsx:112` | シェアテキスト | `winner.name` → セッション保存時の名前（display_name で保存済みのはず） |
| `app/join/[code]/page.tsx:187` | 招待ページのオーナー名 | `room.owner.name` → `getDisplayName(room.owner)` |
| `lib/share-service.ts` | `buildShareText`, `buildShareUrl` | payload の winner は呼び出し元で display_name を渡す |
| `app/auth/callback/route.ts` | Profile upsert | `display_name` は設定しない（NULL のまま）|

## ウェルカム文の例外

```tsx
// home/page.tsx — 外部公開されないため provider_name を維持
ようこそ、{user.user_metadata?.full_name || user.email?.split('@')[0]} さん
```

ヘッダーのウェルカム文は外部に出ないため `provider_name` のままでよい。

## 受け入れ条件
- [x] シェアテキストに本名が含まれない
- [x] OGP 画像・URL に本名が含まれない
- [x] 招待ページのオーナー名が display_name（またはfallback）になっている
- [x] ウェルカム文は変更しない

## 実装内容

- `app/api/rooms/[code]/route.ts` — owner/profile select に `displayName` 追加
- `app/api/rooms/route.ts` — room 作成時の nickname を `getDisplayName()` に変更（provider_name → display_name fallback）
- `app/join/[code]/page.tsx` — `Room.owner` 型に `displayName` 追加、表示を `getDisplayName(room.owner)` に変更
- `app/home/page.tsx` — profile を Supabase から取得し、ownerName フィルタを `getDisplayName(profile)` に変更
