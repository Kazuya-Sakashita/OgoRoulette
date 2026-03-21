-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('WAITING', 'IN_SESSION', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('WAITING', 'SPINNING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SharePlatform" AS ENUM ('X', 'LINE', 'INSTAGRAM', 'LINK', 'IMAGE');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "total_treated" INTEGER NOT NULL DEFAULT 0,
    "total_treated_by" INTEGER NOT NULL DEFAULT 0,
    "total_amount_paid" INTEGER NOT NULL DEFAULT 0,
    "total_sessions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "name" TEXT,
    "invite_code" VARCHAR(8) NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'WAITING',
    "max_members" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "room_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "nickname" TEXT,
    "color" TEXT NOT NULL,
    "is_host" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roulette_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "room_id" UUID,
    "host_id" UUID NOT NULL,
    "winner_id" UUID,
    "title" TEXT,
    "location" TEXT,
    "total_amount" INTEGER,
    "treat_amount" INTEGER,
    "split_amount" INTEGER,
    "per_person_amount" INTEGER,
    "status" "SessionStatus" NOT NULL DEFAULT 'WAITING',
    "spin_duration" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "roulette_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "profile_id" UUID,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "avatar_url" TEXT,
    "is_winner" BOOLEAN NOT NULL DEFAULT false,
    "amount_to_pay" INTEGER,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "platform" "SharePlatform" NOT NULL,
    "share_code" VARCHAR(12),
    "share_url" TEXT,
    "image_url" TEXT,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_invite_code_key" ON "rooms"("invite_code");

-- CreateIndex
CREATE INDEX "rooms_invite_code_idx" ON "rooms"("invite_code");

-- CreateIndex
CREATE INDEX "rooms_owner_id_idx" ON "rooms"("owner_id");

-- CreateIndex
CREATE INDEX "room_members_room_id_idx" ON "room_members"("room_id");

-- CreateIndex
CREATE INDEX "room_members_profile_id_idx" ON "room_members"("profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_members_room_id_profile_id_key" ON "room_members"("room_id", "profile_id");

-- CreateIndex
CREATE INDEX "roulette_sessions_room_id_idx" ON "roulette_sessions"("room_id");

-- CreateIndex
CREATE INDEX "roulette_sessions_host_id_idx" ON "roulette_sessions"("host_id");

-- CreateIndex
CREATE INDEX "roulette_sessions_created_at_idx" ON "roulette_sessions"("created_at");

-- CreateIndex
CREATE INDEX "participants_session_id_idx" ON "participants"("session_id");

-- CreateIndex
CREATE INDEX "participants_profile_id_idx" ON "participants"("profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "share_results_share_code_key" ON "share_results"("share_code");

-- CreateIndex
CREATE INDEX "share_results_session_id_idx" ON "share_results"("session_id");

-- CreateIndex
CREATE INDEX "share_results_share_code_idx" ON "share_results"("share_code");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roulette_sessions" ADD CONSTRAINT "roulette_sessions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roulette_sessions" ADD CONSTRAINT "roulette_sessions_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roulette_sessions" ADD CONSTRAINT "roulette_sessions_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "roulette_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_results" ADD CONSTRAINT "share_results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "roulette_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
