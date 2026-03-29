# ISSUE-075: Profile テーブルに display_name フィールドを追加

## ステータス
🔴 未対応

## 優先度
Critical

## カテゴリ
Backend / DB

## 概要
ISSUE-074 で設計した `display_name` / `display_name_confirmed_at` フィールドを
`profiles` テーブルに追加する。

## 実装内容

### Prisma schema 変更

```prisma
model Profile {
  // 既存フィールドはそのまま維持
  id        String  @id @db.Uuid
  name      String? // provider_name — 内部保持のみ、変更しない

  // 追加
  displayName            String?   @map("display_name")
  displayNameConfirmedAt DateTime? @map("display_name_confirmed_at")
}
```

### マイグレーション SQL

```sql
ALTER TABLE profiles ADD COLUMN display_name TEXT;
ALTER TABLE profiles ADD COLUMN display_name_confirmed_at TIMESTAMPTZ;
```

### 既存ユーザー対応
- `display_name` は NULL のまま（バッチ不要）
- NULL 時は `getDisplayName()` が fallback を返す（ISSUE-076）

## 受け入れ条件
- [ ] `prisma/schema.prisma` に 2 フィールド追加
- [ ] `prisma migrate` が成功する
- [ ] 既存データが壊れない
