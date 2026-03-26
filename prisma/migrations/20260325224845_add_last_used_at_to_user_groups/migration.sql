-- DropForeignKey
ALTER TABLE "room_members" DROP CONSTRAINT "room_members_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "rooms" DROP CONSTRAINT "rooms_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "roulette_sessions" DROP CONSTRAINT "roulette_sessions_host_id_fkey";

-- AlterTable
ALTER TABLE "room_members" ALTER COLUMN "profile_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "rooms" ALTER COLUMN "owner_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "roulette_sessions" ALTER COLUMN "host_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roulette_sessions" ADD CONSTRAINT "roulette_sessions_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
