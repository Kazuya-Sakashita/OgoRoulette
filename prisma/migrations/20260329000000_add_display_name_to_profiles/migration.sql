-- AlterTable: Profile に display_name と display_name_confirmed_at を追加
-- provider_name (name フィールド) はそのまま保持し、外部公開には display_name を使う

ALTER TABLE "profiles" ADD COLUMN "display_name" TEXT;
ALTER TABLE "profiles" ADD COLUMN "display_name_confirmed_at" TIMESTAMPTZ;
