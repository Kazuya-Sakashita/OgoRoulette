# ISSUE-266: RLS監査サマリー — 全テーブルRLS未設定

## 概要

OgoRouletteのすべてのPostgreSQLテーブルでRow Level Security（RLS）が無効になっている。  
`NEXT_PUBLIC_SUPABASE_ANON_KEY`（ブラウザ公開値）を使えば、Supabase REST API経由で全テーブルのデータを自由に読み書きできる状態だった。

---

## 監査結果

### 確認テーブル数: 7

| テーブル | RLS | 判定 | 主な問題 |
|---------|-----|------|---------|
| profiles | ❌ 無効 | **危険** | email / 金額 / 統計などPIIが全公開 |
| user_groups | ❌ 無効 | **危険** | ユーザーの保存グループ（名前・メンバー名）が全公開 |
| rooms | ❌ 無効 | 要改善 | invite_code・status等が全公開、書き込みも無制限 |
| room_members | ❌ 無効 | 要改善 | 全ルームのメンバー情報が全公開 |
| roulette_sessions | ❌ 無効 | 要改善 | 金額情報（total_amount等）が全公開 |
| participants | ❌ 無効 | 要改善 | 参加者名・当選フラグ・金額が全公開 |
| share_results | ❌ 無効 | 要改善 | シェア情報が全公開 |

### RLS有効テーブル数: 0 / 7

---

## 攻撃シナリオ

```bash
# anon key は NEXT_PUBLIC_SUPABASE_ANON_KEY として JavaScript に公開されている
# ブラウザの DevTools → Sources → 環境変数から取得可能

# 全ユーザーのプロフィール（email含む）を取得
curl https://PROJECT.supabase.co/rest/v1/profiles \
  -H "apikey: ANON_KEY" \
  -H "Authorization: Bearer ANON_KEY"

# 全ルームのinvite_codeを列挙 → 任意ルームに参加可能
curl https://PROJECT.supabase.co/rest/v1/rooms?select=id,invite_code,status \
  -H "apikey: ANON_KEY" \
  -H "Authorization: Bearer ANON_KEY"

# ログイン済みユーザーが他人のuser_groupsを読み取り
curl https://PROJECT.supabase.co/rest/v1/user_groups?select=* \
  -H "apikey: ANON_KEY" \
  -H "Authorization: Bearer USER_JWT"

# 不正なINSERT（anonによるルーム作成）
curl -X POST https://PROJECT.supabase.co/rest/v1/rooms \
  -H "apikey: ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"fake","invite_code":"XXXXXXXX","status":"WAITING",...}'
```

---

## 既存機能への影響（RLS追加前後）

| アクセスパス | RLS前 | RLS後 |
|------------|-------|-------|
| Prisma（API routes） | ✅ 正常 | ✅ 変化なし（postgres superuserはRLSバイパス） |
| Supabase REST API（anon） | ❌ 全アクセス可 | ✅ 制限あり |
| Supabase Realtime（postgres_changes） | ✅ 動作中 | ✅ 継続（rooms anon SELECT保持） |
| Supabase Realtime（broadcast） | ✅ 動作中 | ✅ 変化なし（RLS対象外） |

---

## 対応内容

### 追加したポリシー一覧

| テーブル | ポリシー名 | 操作 | 対象ロール | 条件 |
|---------|----------|------|----------|------|
| profiles | authenticated owner select | SELECT | authenticated | `id = auth.uid()` |
| profiles | authenticated owner update | UPDATE | authenticated | `id = auth.uid()` |
| user_groups | authenticated owner select | SELECT | authenticated | `user_id = auth.uid()` |
| user_groups | authenticated owner insert | INSERT | authenticated | `user_id = auth.uid()` |
| user_groups | authenticated owner update | UPDATE | authenticated | `user_id = auth.uid()` |
| user_groups | authenticated owner delete | DELETE | authenticated | `user_id = auth.uid()` |
| rooms | authenticated member select | SELECT | authenticated | owner or member |
| room_members | authenticated owner select | SELECT | authenticated | 自分の行のみ（再帰防止） |
| roulette_sessions | authenticated participant select | SELECT | authenticated | host/winner/room member |
| participants | authenticated participant select | SELECT | authenticated | profile or host/winner |
| share_results | anon select by share_code | SELECT | anon | `share_code IS NOT NULL` |
| share_results | authenticated host winner select | SELECT | authenticated | host or winner |

### 保護された主な攻撃面

- ✅ 他人のプロフィール（email, 金額統計）の読み取り阻止
- ✅ 全ルームのinvite_code列挙阻止
- ✅ 他人のuser_groups読み取り・改ざん阻止
- ✅ REST API経由の不正INSERT/UPDATE/DELETE阻止
- ✅ anon keyによる認証スキップ攻撃阻止

---

## 残課題 / 今後の見直し候補

### 要対応
- [ ] Supabase Dashboard でRLSが正しく有効化されているか目視確認
- [ ] Prisma DATABASE_URL が superuser 接続であることを確認（RLSバイパス前提）
- [ ] `use-room-sync.ts` の `postgres_changes` の `table: "Room"` を `"rooms"` に修正（別ISSUE推奨）

### 将来的な改善
- `rooms` テーブルのRLS: Broadcast移行後は `anon` ポリシー削除 → より厳格に
- `roulette_sessions` のSELECT: 参加者も含めた条件に拡張可能
- RLS違反のモニタリング: Supabase Dashboardのログ監視

---

## マイグレーションファイル

```
prisma/migrations/20260417000000_add_rls_policies/migration.sql
```

---

## 優先度: High
## 実施日: 2026-04-17
## 担当: Kazuya-Sakashita
