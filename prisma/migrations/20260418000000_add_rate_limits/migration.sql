-- ISSUE-277: 分散レートリミット用 PostgreSQL テーブル
-- Vercel マルチインスタンス間でレートリミット状態を共有する。
-- ON CONFLICT DO UPDATE でアトミックなインクリメントを実現。
-- RLS 有効 + ポリシーなし → Supabase REST API からは完全非公開（Prisma 経由のみアクセス可）。

CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "reset_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;
