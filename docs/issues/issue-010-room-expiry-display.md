# [ISSUE-010] ルームの有効期限（expiresAt）が UI に表示されず、期限切れで操作不能になる

## 🧩 概要

`Room` モデルには `expiresAt` フィールドがあり、スピン API・リセット API では期限切れチェックが行われる。しかし UI にはどこにも期限が表示されていない。ユーザーは期限切れのルームで SPIN を押して `403 Forbidden`（「ルームが期限切れです」）に遭遇するまで、期限の存在を知らない。

## 🚨 背景 / なぜ問題か

**API 側のチェック（`spin/route.ts:70-72`）:**

```tsx
if (room.expiresAt && room.expiresAt < new Date()) {
  return NextResponse.json({ error: "ルームが期限切れです" }, { status: 403 })
}
```

**UI 側の対応:**
- `room.expiresAt` は `fetchRoom` で取得されているが、画面上で表示されていない
- `spinError` にエラーが表示されるが、それまでユーザーは何も知らない
- 期限切れのルームで「もう一回！」を押すと reset も失敗する（同様のチェックあり）

**発生シナリオ:**
1. 昨日作ったルームを今日も使おうとする
2. SPIN を押す → `403` → `spinError: "ルームが期限切れです"`
3. 「もう一回！」→ `403`
4. 行き詰まる（新しいルームを作る方法が分からない）

## 🎯 目的

ルームの有効期限を UI に表示し、期限が近い場合または期限切れの場合に適切なメッセージと次のアクション（新しいルームを作る）を提示する。

## 🔍 影響範囲

- **対象機能:** ルームステータス表示
- **対象画面:** `/room/[code]`（ロビー）、`/room/[code]/play`
- **対象コンポーネント:**
  - `app/room/[code]/page.tsx`
  - `app/room/[code]/play/page.tsx`

## 🛠 修正方針

**修正1: ルームヘッダーに期限表示を追加**

```tsx
// ロビー・プレイページ共通
const expiresAt = room.expiresAt ? new Date(room.expiresAt) : null
const isExpired = expiresAt ? expiresAt < new Date() : false
const isExpiringSoon = expiresAt
  ? (expiresAt.getTime() - Date.now()) < 24 * 60 * 60 * 1000  // 24時間以内
  : false

// 表示
{expiresAt && (
  <p className={`text-xs ${isExpired ? "text-red-400" : isExpiringSoon ? "text-yellow-400" : "text-muted-foreground"}`}>
    {isExpired
      ? "このルームは期限切れです"
      : `有効期限: ${format(expiresAt, "M月d日 HH:mm", { locale: ja })}`
    }
  </p>
)}
```

**修正2: 期限切れルームのフォールバック UI**

```tsx
// play/page.tsx の isCompleted チェックに加えて
if (isExpired) {
  return (
    <div className="...">
      <p>このルームは期限切れです</p>
      <Button asChild>
        <Link href="/room/create">新しいルームを作る</Link>
      </Button>
    </div>
  )
}
```

**修正3: spin API の `expiresAt` をフロントエンドに返す**

`GET /api/rooms/[code]` のレスポンスに `expiresAt` が含まれていることを確認（Prisma の select に含まれているか確認）。

## ⚠️ リスク / 副作用

- `date-fns` は既に `package.json` に含まれているため、追加依存なし
- 有効期限の表示フォーマットは `ja` ロケールを使用（`date-fns/locale` 要 import）

## ✅ 確認項目

- [ ] ルームロビーとプレイページにルームの有効期限が表示される
- [ ] 24 時間以内に期限切れのルームで黄色い警告が表示される
- [ ] 期限切れのルームで赤いエラーと「新しいルームを作る」ボタンが表示される
- [ ] `expiresAt = null`（期限なし）のルームで余分な表示がない

## 🧪 テスト観点

**手動確認:**
1. `expiresAt` を過去の日時に設定したテストルームで動作確認
2. 24 時間以内に期限切れになるルームで警告表示を確認
3. `expiresAt = null` のルームで表示なしを確認

## 📌 受け入れ条件（Acceptance Criteria）

- [ ] 期限切れルームで UI にエラーと次のアクションが表示される
- [ ] 期限間近（24時間以内）のルームで警告が表示される
- [ ] 期限切れルームの SPIN ボタンが disabled になる（API エラー前に）

## 🏷 優先度

**Medium**

## 📅 実装順序

**10番目**

## 🔗 関連Issue

なし
