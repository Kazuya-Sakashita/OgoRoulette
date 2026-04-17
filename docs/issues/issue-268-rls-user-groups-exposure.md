# ISSUE-268: user_groups テーブルのRLS未設定 — 保存グループ全公開

## 概要

`user_groups` テーブルにRLSが設定されておらず、全ユーザーの保存グループデータ（グループ名・メンバー名配列）がSupabase REST API経由で読み書き可能。

---

## 問題

| 操作 | policy | 状態 |
|------|--------|------|
| SELECT | なし | 全ユーザーのグループ名・メンバー名が読み取り可能 |
| INSERT | なし | 他人の `user_id` を指定してグループ作成可能 |
| UPDATE | なし | 他人のグループを更新可能 |
| DELETE | なし | 他人のグループを削除可能 |

---

## 想定不正アクセスシナリオ

```sql
-- anon keyで全ユーザーのグループを列挙
SELECT * FROM user_groups;
-- → user_id, name, participants（メンバー名配列）が全公開

-- 他人のuser_idを指定してグループを作成（INSERT偽装）
INSERT INTO user_groups (user_id, name, participants)
VALUES ('victim-user-uuid', '悪意のあるグループ', ARRAY['名前']);

-- 他人のグループを削除
DELETE FROM user_groups WHERE id = 'target-group-id';
```

---

## 対応内容

```sql
ALTER TABLE "user_groups" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_groups: authenticated owner select"
  ON "user_groups" FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- WITH CHECK で user_id 偽装を防止（auth.uid() と一致しないINSERTを拒否）
CREATE POLICY "user_groups: authenticated owner insert"
  ON "user_groups" FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_groups: authenticated owner update"
  ON "user_groups" FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_groups: authenticated owner delete"
  ON "user_groups" FOR DELETE TO authenticated
  USING (user_id = auth.uid());
```

---

## 既存機能への影響
- なし（`/api/groups` はPrisma経由）

## 完了条件
- [x] RLS有効化 + 全CRUD policyを適用
- [x] WITH CHECK によるuser_id偽装防止
- [ ] Supabase Dashboardで確認

## 優先度: High
## 実施日: 2026-04-17
