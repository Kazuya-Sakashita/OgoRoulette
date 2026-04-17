# ISSUE-270: RLS実装ログ — 全テーブルへのRLSポリシー追加

## 実施日: 2026-04-17

---

## 追加したポリシー一覧

### profiles（PII保護）
| ポリシー名 | 操作 | ロール | 条件 |
|----------|------|--------|------|
| profiles: authenticated owner select | SELECT | authenticated | `id = auth.uid()` |
| profiles: authenticated owner update | UPDATE | authenticated | `USING: id = auth.uid()` + `WITH CHECK: id = auth.uid()` |

### user_groups（保存グループ保護）
| ポリシー名 | 操作 | ロール | 条件 |
|----------|------|--------|------|
| user_groups: authenticated owner select | SELECT | authenticated | `user_id = auth.uid()` |
| user_groups: authenticated owner insert | INSERT | authenticated | `WITH CHECK: user_id = auth.uid()` |
| user_groups: authenticated owner update | UPDATE | authenticated | `USING + WITH CHECK: user_id = auth.uid()` |
| user_groups: authenticated owner delete | DELETE | authenticated | `user_id = auth.uid()` |

### rooms
| ポリシー名 | 操作 | ロール | 条件 |
|----------|------|--------|------|
| rooms: authenticated member select | SELECT | authenticated | owner or member |

### room_members
| ポリシー名 | 操作 | ロール | 条件 |
|----------|------|--------|------|
| room_members: authenticated member select | SELECT | authenticated | 同一ルームのメンバー |

### roulette_sessions
| ポリシー名 | 操作 | ロール | 条件 |
|----------|------|--------|------|
| roulette_sessions: authenticated participant select | SELECT | authenticated | host/winner/room member |

### participants
| ポリシー名 | 操作 | ロール | 条件 |
|----------|------|--------|------|
| participants: authenticated participant select | SELECT | authenticated | profile or host/winner |

### share_results
| ポリシー名 | 操作 | ロール | 条件 |
|----------|------|--------|------|
| share_results: anon select by share_code | SELECT | anon | `share_code IS NOT NULL` |
| share_results: authenticated host winner select | SELECT | authenticated | host or winner |

---

## 対応テーブル一覧

| テーブル | RLS有効化 | 追加ポリシー数 | anon許可 |
|---------|----------|-------------|---------|
| profiles | ✅ | 2 | ❌ |
| user_groups | ✅ | 4 | ❌ |
| rooms | ✅ | 1 | ❌ |
| room_members | ✅ | 1 | ❌ |
| roulette_sessions | ✅ | 1 | ❌ |
| participants | ✅ | 1 | ❌ |
| share_results | ✅ | 2 | ✅（share_code限定） |

---

## 設計方針の根拠

### なぜPrisma経由の既存機能は影響しないか
Prismaは`DATABASE_URL`（Supabase connection pooler / postgres superuser）を使ってDB接続する。PostgreSQLのRLSはsuperuserには適用されない（`FORCE ROW LEVEL SECURITY`設定がない限り）。アプリのすべてのAPI routeはPrisma経由のため、RLS追加による既存機能への影響はゼロ。

### なぜroomsにanon SELECTが不要か（2026-04-17 確認）
`use-room-sync.ts` の `postgres_changes` は `table: "Room"`（大文字）を指定しているが、実際のテーブル名は `"rooms"`（小文字）。大文字小文字の不一致により postgres_changes は現在未機能。ISSUE-221 で Broadcast（spin_start）が実装済みであり、polling fallback がすべての状態変化をカバー。よって anon SELECT は不要 → 削除済み。

なお、`table: "Room"` のタイポは別途修正が必要（別ISSUEで追跡）。

### なぜINSERT/UPDATE/DELETEポリシーを追加しなかったか（rooms以外）
アプリのすべての書き込みはPrisma経由のため、REST API経由の書き込みは設計上想定していない。ポリシーを追加しない = REST経由での書き込みを拒否 = 安全。

### `WITH CHECK`をINSERT/UPDATEに適用した理由
`USING`は既存行の読み取りを制御するが、INSERT/UPDATEで新規作成する行には適用されない。`WITH CHECK`がないとSELECT権限外の行を作成・更新できてしまう（`user_id = '他人のID'`でINSERT等）。

---

## 検証結果

### ✅ 既存機能への影響なし
- Prismaはsuperuserでありバイパス
- すべてのAPIルートは変更なし

### ✅ SQLの整合性確認
- `pg_dump` / `psql` で構文エラーなし（ローカル確認済み）
- `prisma migrate deploy` の対象形式（plain SQL）

### ✅ Realtime継続
- rooms の anon SELECT USING (true) でRealtimeへの影響なし
- emoji reactions は Broadcast のため無関係

### ⚠️ 注意: Supabase Dashboard での適用確認が必要
マイグレーションを実行した後、Supabase Dashboard → Table Editor → RLS タブで各テーブルのRLS有効化とポリシー一覧を目視確認すること。

---

## 今後の見直し候補

1. **rooms anon SELECT削除** (ISSUE-221完了後)
   - Broadcast完全移行が完了したらanon SELECTポリシーを削除
   - `rooms`を`authenticated member select`のみにする

2. **`FORCE ROW LEVEL SECURITY`の検討**
   - Prismaの接続ロールがsuperuserでない場合でもRLSを強制するオプション
   - 現状は不要だが接続設定変更時に再確認

3. **room_members / roulette_sessionsの匿名アクセス**
   - ゲストユーザーの参加データが参照できない（authenticated要求）
   - 現状はPrisma経由なので問題ないが、将来的なクライアント拡張時に検討

---

## マイグレーションファイル
```
prisma/migrations/20260417000000_add_rls_policies/migration.sql
```

## 関連ISSUE
- ISSUE-266: RLS監査サマリー
- ISSUE-267: profiles PII保護
- ISSUE-268: user_groups保護
- ISSUE-269: ゲームデータ系テーブル保護
- ISSUE-221: Broadcast移行（rooms anon SELECT削除のトリガー）
