-- ISSUE-014: 常設グループ機能のための is_persistent カラムを追加
-- 既存ルームはすべて一時ルームとして扱うため DEFAULT false

ALTER TABLE "rooms"
  ADD COLUMN "is_persistent" BOOLEAN NOT NULL DEFAULT false;
