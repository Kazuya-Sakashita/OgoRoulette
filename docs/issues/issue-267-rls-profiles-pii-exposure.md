# ISSUE-267: profiles テーブルのRLS未設定 — PII全公開

## 概要

`profiles` テーブルにRLSが設定されておらず、Supabase REST API経由で全ユーザーのPIIデータが読み書き可能な状態。

---

## 問題

### RLS状態
- RLS有効: ❌ 無効

### policy有無
| 操作 | policy | 状態 |
|------|--------|------|
| SELECT | なし | 全ユーザーのプロフィールが読み取り可能 |
| INSERT | なし | 誰でも任意のprofileを作成可能 |
| UPDATE | なし | 他人のprofileを更新可能 |
| DELETE | なし | 他人のprofileを削除可能 |

---

## 現状

```sql
-- 現在の状態（RLS設定なし）
-- anon keyで以下が実行可能:
SELECT * FROM profiles;
-- → 全ユーザーのemail, name, avatar_url,
--   total_treated, total_treated_by, total_amount_paid,
--   total_sessions, display_name が返る

UPDATE profiles SET email = 'evil@example.com' WHERE id = 'any-user-id';
-- → 他人のメールアドレスを書き換え可能
```

---

## 原因

Prismaマイグレーションにより作成されたテーブルはRLSがデフォルト無効。  
RLSを明示的に有効化していなかった。

---

## 影響

- **email漏洩**: 全ユーザーのemailアドレスが取得可能
- **金額統計漏洩**: `total_amount_paid`（累計支払額）が他人に見える
- **プロフィール改ざん**: `name`, `avatar_url`, `display_name` を任意に変更可能
- **表示名偽装**: `display_name` を他人の名前に変更してなりすまし

---

## 対応内容

```sql
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;

-- 自分のプロフィールのみ参照可能
CREATE POLICY "profiles: authenticated owner select"
  ON "profiles" FOR SELECT TO authenticated
  USING (id = auth.uid());

-- 自分のプロフィールのみ更新可能（id偽装をWITH CHECKで防止）
CREATE POLICY "profiles: authenticated owner update"
  ON "profiles" FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
```

### INSERT / DELETE を許可しない理由
- INSERT: Supabase Admin（LINE OAuth）またはSupabase Auth（Google/X）が管理
- DELETE: Supabase Auth の cascade で対応
- REST経由での INSERT/DELETE は不要 → ポリシーなし = 拒否

---

## 既存機能への影響
- なし（APIルートはすべてPrisma経由、postgres superuserはRLSバイパス）

---

## 完了条件
- [x] `ALTER TABLE profiles ENABLE ROW LEVEL SECURITY` 適用
- [x] `authenticated owner select` ポリシー作成
- [x] `authenticated owner update` ポリシー作成（WITH CHECK含む）
- [ ] Supabase Dashboardで確認

## 優先度: High（PII保護）
## 実施日: 2026-04-17
