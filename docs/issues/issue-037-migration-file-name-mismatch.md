# ISSUE-037: Prisma マイグレーションファイル名と内容の不一致

## 概要

`prisma/migrations/20260325224845_add_last_used_at_to_user_groups/migration.sql` のファイル名は `add_last_used_at` を示しているが、実際の SQL 内容は `room_members`, `rooms`, `roulette_sessions` の外部キー制約を `NULL` 許容に変更する処理を含んでいる。

## 背景

マイグレーション生成時に名前が誤ってつけられた可能性がある。同名の別マイグレーション `20260326000000_add_last_used_at_to_user_groups` が実際に `lastUsedAt` カラムを追加している。

## 問題点

- 現在何が起きているか: `prisma migrate status` を実行すると、`20260325224845_add_last_used_at_to_user_groups` のチェックサムが schema.prisma の期待値と一致しない場合に `drift` として検出される可能性がある
- ユーザー影響: エンドユーザーへの影響なし
- 技術的影響: 開発者が `prisma migrate dev` を実行すると「未適用のマイグレーションがある」という誤解を招く。CI/CD で `prisma migrate deploy --skip-generate` 時に予期せぬエラーが発生する可能性

## 原因

マイグレーション作成時の命名ミス。内容的には2つのマイグレーションが混在している。

## 修正方針

本番 DB がまだ作成されていない場合：
1. `20260325224845_add_last_used_at_to_user_groups` を `20260325224845_allow_null_profile_id` にリネーム（DB 未適用の場合）

本番 DB に既に適用済みの場合：
1. そのまま放置（機能に問題なし）
2. 将来のマイグレーションで補正コメントを追加

## タスク

- [ ] 本番 DB に当該マイグレーションが適用済みか確認
- [ ] 未適用であれば安全なタイミングでリネーム
- [ ] `prisma migrate status` を実行して drift がないことを確認

## 受け入れ条件

- `prisma migrate status` が clean な状態を示す
- または本番 DB 適用済みと確認できドリフトが問題ないことが明記されている

## 優先度

Low

## デプロイブロッカー

No（機能への影響なし。運用上の混乱リスク）
