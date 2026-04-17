-- =============================================================================
-- ISSUE-275: rooms テーブルに anon SELECT ポリシーを追加
-- =============================================================================
-- 目的: ゲスト（anon）ユーザーの Supabase Realtime postgres_changes 購読を許可する
--
-- 背景:
--   20260417000000_add_rls_policies で rooms に anon SELECT なしで設計した。
--   根拠は「postgres_changes は table: "Room" タイポで未機能」という前提だったが、
--   直後の ISSUE-271 で table: "rooms" に修正して postgres_changes が有効化された。
--   結果として anon ユーザーが CHANNEL_ERROR → spin_start Broadcast 消滅
--   → ルーレット後のリアクションがメンバー画面に表示されないリグレッションが発生。
--
-- セキュリティ評価:
--   - rooms テーブルには PII を含まない（invite_code, status, expires_at 等）
--   - Realtime 購読は filter: invite_code=eq.XXX で特定ルームに絞られる
--   - Supabase REST API 経由の全件取得は anon key が公開前提であり許容範囲
--   - invite_code は 12文字英数字ランダム。総当たりは事実上不可能
--   - 将来 Broadcast に完全移行後（ISSUE-221 完了後）に本ポリシーを削除可能
-- =============================================================================

CREATE POLICY "rooms: anon realtime select"
  ON "rooms"
  FOR SELECT
  TO anon
  USING (true);
