# ISSUE-269: rooms / room_members / roulette_sessions / participants / share_results の RLS未設定

## 概要

ゲームデータ系5テーブルのRLSが未設定。invite_code列挙・金額情報漏洩・不正書き込みが可能。  
Realtimeとの兼ね合いから `rooms` のanon SELECTは一時的に維持する。

---

## テーブル別問題と対応

### rooms

**問題:**
- 全ルームのinvite_code・status・owner_idが全公開
- invite_code列挙により任意ルームへの不正参加が可能

**対応:**
```sql
ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;

-- anon: Realtimeのために一時的に全行SELECT許可
-- TODO: ISSUE-221（Broadcast完全移行）完了後に削除
CREATE POLICY "rooms: anon select for realtime"
  ON "rooms" FOR SELECT TO anon USING (true);

-- authenticated: オーナー or メンバーのルームのみ参照
CREATE POLICY "rooms: authenticated member select"
  ON "rooms" FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM "room_members"
      WHERE "room_members".room_id = "rooms".id
        AND "room_members".profile_id = auth.uid()
    )
  );
-- INSERT / UPDATE / DELETE: ポリシーなし = REST経由は拒否
```

**残課題:** `anon SELECT USING (true)` はRealtime依存。ISSUE-221（Broadcast移行）完了後に削除。

---

### room_members

**問題:**
- 全ルームの全メンバー情報が公開
- postgres_changes購読対象外のため anon SELECT は不要

**対応:**
```sql
ALTER TABLE "room_members" ENABLE ROW LEVEL SECURITY;

-- 自分の参加情報 or 同じルームのメンバー一覧を参照可能
CREATE POLICY "room_members: authenticated member select"
  ON "room_members" FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM "room_members" AS my_rm
      WHERE my_rm.room_id = "room_members".room_id
        AND my_rm.profile_id = auth.uid()
    )
  );
```

---

### roulette_sessions

**問題:**
- 金額情報（total_amount, treat_amount, split_amount, per_person_amount）が全公開
- 当選者情報（winner_id）が誰からでも参照可能

**対応:**
```sql
ALTER TABLE "roulette_sessions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roulette_sessions: authenticated participant select"
  ON "roulette_sessions" FOR SELECT TO authenticated
  USING (
    host_id = auth.uid()
    OR winner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM "room_members"
      WHERE "room_members".room_id = "roulette_sessions".room_id
        AND "room_members".profile_id = auth.uid()
    )
  );
```

---

### participants

**問題:**
- 参加者名・is_winner・amount_to_pay が全公開

**対応:**
```sql
ALTER TABLE "participants" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants: authenticated participant select"
  ON "participants" FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM "roulette_sessions" rs
      WHERE rs.id = "participants".session_id
        AND (rs.host_id = auth.uid() OR rs.winner_id = auth.uid())
    )
  );
```

---

### share_results

**問題:**
- share_codeがNULLのプライベートシェアも全公開
- 全シェア結果のimage_url・view_countが公開

**設計判断:**
- share_code（12文字ランダム）がある行は公開シェアリンクの設計なので anon SELECT 許可
- share_code が NULL の行はホスト/当選者のみ

**対応:**
```sql
ALTER TABLE "share_results" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "share_results: anon select by share_code"
  ON "share_results" FOR SELECT TO anon
  USING (share_code IS NOT NULL);

CREATE POLICY "share_results: authenticated host winner select"
  ON "share_results" FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "roulette_sessions" rs
      WHERE rs.id = "share_results".session_id
        AND (rs.host_id = auth.uid() OR rs.winner_id = auth.uid())
    )
  );
```

---

## 既存機能への影響

- なし（すべてPrisma経由、Realtime影響なし）
- ただし `rooms` のanon SELECTはRealtime継続のため維持

## 関連ISSUE
- ISSUE-221: Broadcast完全移行後に rooms の anon SELECT ポリシーを削除

## 優先度: Medium
## 実施日: 2026-04-17
