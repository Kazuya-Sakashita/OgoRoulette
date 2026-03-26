-- ISSUE-023: グループからルームを作成する際の事前登録メンバー名を保存するカラムを追加
-- 既存ルームは空配列として扱うため DEFAULT '{}'
-- このカラムがあるルームでは join ページにメンバー名ピッカーが表示される

ALTER TABLE "rooms"
  ADD COLUMN "preset_member_names" TEXT[] NOT NULL DEFAULT '{}';
