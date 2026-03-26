-- AlterTable
ALTER TABLE "user_groups" ADD COLUMN "last_used_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "user_groups_user_id_last_used_at_idx" ON "user_groups"("user_id", "last_used_at");
