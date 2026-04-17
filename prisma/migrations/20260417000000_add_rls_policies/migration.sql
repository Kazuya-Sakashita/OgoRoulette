-- =============================================================================
-- RLS（Row Level Security）ポリシー追加
-- =============================================================================
-- 目的: Supabase REST API 経由の不正アクセスを防ぐ
-- 対象: 全7テーブル
--
-- 重要前提:
--   - アプリの DB 操作はすべて Prisma（postgres superuser 接続）経由
--   - superuser は RLS をバイパスするため既存機能への影響はゼロ
--   - RLS が守るのは Supabase REST API 経由の直接アクセス（anon key 使用）
--
-- Realtime 考慮:
--   - use-room-sync.ts が rooms テーブルを postgres_changes で購読
--   - ゲストユーザーは anon ロールで購読するため rooms に anon SELECT が必要
--   - 将来 Broadcast に完全移行後（ISSUE-221 完了後）に anon ポリシーを削除可能
-- =============================================================================


-- =============================================================================
-- 1. profiles
-- =============================================================================
-- リスク: email, total_amount_paid, total_treated など PII が全公開
-- 対応: authenticated ロールで自分の行のみ SELECT / UPDATE 許可
--       anon は完全排除

ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;

-- 自分のプロフィールのみ参照可能
CREATE POLICY "profiles: authenticated owner select"
  ON "profiles"
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 自分のプロフィールのみ更新可能（id 偽装を WITH CHECK で防止）
CREATE POLICY "profiles: authenticated owner update"
  ON "profiles"
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- INSERT は Supabase Admin（LINE OAuth）/ Supabase Auth（Google/X）が行う
-- DELETE は Supabase Auth の cascade で対応
-- → REST 経由の INSERT / DELETE は不要のためポリシーなし = 拒否


-- =============================================================================
-- 2. user_groups
-- =============================================================================
-- リスク: ユーザーが保存したグループ名・メンバー名が全公開
-- 対応: 所有者のみ CRUD 許可。anon は完全排除

ALTER TABLE "user_groups" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_groups: authenticated owner select"
  ON "user_groups"
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- WITH CHECK で user_id 偽装を防止
CREATE POLICY "user_groups: authenticated owner insert"
  ON "user_groups"
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_groups: authenticated owner update"
  ON "user_groups"
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_groups: authenticated owner delete"
  ON "user_groups"
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- =============================================================================
-- 3. rooms
-- =============================================================================
-- リスク: 全ルーム情報（invite_code, status, メンバー数等）が全公開
--
-- Realtime 状況（2026-04-17 確認済み）:
--   - use-room-sync.ts の postgres_changes は table: "Room"（大文字）を指定しており
--     実際のテーブル名 "rooms"（小文字）と不一致 → postgres_changes は現在未機能
--   - ISSUE-221 で Broadcast（spin_start 送受信）が実装済み
--   - Broadcast は WebSocket broadcast であり RLS に無関係
--   - polling fallback（2s/10s）がすべての状態変化をカバー
--   - よって anon SELECT は不要。anon ポリシーなし = anon は完全排除
--
-- 書き込み: Prisma 経由のみ許可。REST 経由は拒否

ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;

-- authenticated: 自分がオーナーのルーム、または自分がメンバーのルームを参照可能
-- anon ポリシーなし = anon key による全ルーム invite_code 列挙を阻止
CREATE POLICY "rooms: authenticated member select"
  ON "rooms"
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM "room_members"
      WHERE "room_members".room_id = "rooms".id
        AND "room_members".profile_id = auth.uid()
    )
  );

-- INSERT / UPDATE / DELETE はポリシーなし = REST 経由は拒否
-- （すべて Prisma 経由で処理）


-- =============================================================================
-- 4. room_members
-- =============================================================================
-- リスク: 全ルームの全メンバー情報が公開
-- Realtime: room_members は postgres_changes 購読対象外 → anon SELECT 不要
-- 書き込み: Prisma 経由のみ
--
-- 注意: PostgreSQL RLS では同一テーブルを USING 節から EXISTS で参照すると
-- 無限再帰が発生する。そのため自己参照は避け、自分の行のみ許可する設計とする。
-- 同ルームの他メンバー情報はすべて Prisma（API route）経由で取得するため問題なし。

ALTER TABLE "room_members" ENABLE ROW LEVEL SECURITY;

-- 自分の参加情報のみ参照可能（再帰防止のため限定的に設定）
CREATE POLICY "room_members: authenticated owner select"
  ON "room_members"
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- INSERT / UPDATE / DELETE はポリシーなし = REST 経由は拒否


-- =============================================================================
-- 5. roulette_sessions
-- =============================================================================
-- リスク: 金額情報（total_amount, treat_amount 等）が全公開
-- Realtime: rooms テーブルのみ購読 → anon SELECT 不要

ALTER TABLE "roulette_sessions" ENABLE ROW LEVEL SECURITY;

-- 自分がホスト、当選者、または参加ルームのメンバーであるセッションを参照可能
CREATE POLICY "roulette_sessions: authenticated participant select"
  ON "roulette_sessions"
  FOR SELECT
  TO authenticated
  USING (
    host_id = auth.uid()
    OR winner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM "room_members"
      WHERE "room_members".room_id = "roulette_sessions".room_id
        AND "room_members".profile_id = auth.uid()
    )
  );

-- INSERT / UPDATE / DELETE はポリシーなし = REST 経由は拒否


-- =============================================================================
-- 6. participants
-- =============================================================================
-- リスク: 参加者名・当選フラグ・金額情報が全公開

ALTER TABLE "participants" ENABLE ROW LEVEL SECURITY;

-- 自分の参加情報、または自分がホスト/当選者のセッション参加者を参照可能
CREATE POLICY "participants: authenticated participant select"
  ON "participants"
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM "roulette_sessions" rs
      WHERE rs.id = "participants".session_id
        AND (
          rs.host_id = auth.uid()
          OR rs.winner_id = auth.uid()
        )
    )
  );

-- INSERT / UPDATE / DELETE はポリシーなし = REST 経由は拒否


-- =============================================================================
-- 7. share_results
-- =============================================================================
-- リスク: 全シェア結果が公開（share_url, image_url 等）
-- 設計: share_code を知っている場合は公開（パブリックシェアリンクの設計上）
--       share_code が NULL（非公開）の場合は関係者のみ

ALTER TABLE "share_results" ENABLE ROW LEVEL SECURITY;

-- anon: share_code が設定されている行のみ参照可能（公開シェアリンク）
-- share_code は 12 文字のランダム文字列であり、総当たりは実質不可能
CREATE POLICY "share_results: anon select by share_code"
  ON "share_results"
  FOR SELECT
  TO anon
  USING (share_code IS NOT NULL);

-- authenticated: 自分がホストまたは当選者のセッションのシェア結果を参照可能
CREATE POLICY "share_results: authenticated host winner select"
  ON "share_results"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "roulette_sessions" rs
      WHERE rs.id = "share_results".session_id
        AND (
          rs.host_id = auth.uid()
          OR rs.winner_id = auth.uid()
        )
    )
  );

-- INSERT / UPDATE / DELETE はポリシーなし = REST 経由は拒否
