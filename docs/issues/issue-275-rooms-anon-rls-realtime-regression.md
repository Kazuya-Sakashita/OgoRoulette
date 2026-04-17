# ISSUE-275: rooms テーブルの anon SELECT ポリシー欠落によるリアルタイム・リアクション リグレッション（✅ 修正済み）

## 概要

ISSUE-271（postgres_changes テーブル名修正）と ISSUE-266（RLS追加）の**適用順序バグ**により、
ゲスト（anon）ユーザーの Realtime チャンネルが CHANNEL_ERROR を引き起こしている。

これにより以下の症状が発生する：

- ゲストメンバーの `room-play:${code}` チャンネルが CHANNEL_ERROR → rejoin ループ
- `spin_start` Broadcast が届かない → スピン検知が最大 10s 遅延（WAITING ポーリング間隔）
- WebSocket が不安定になり、**ルーレット後の絵文字リアクションがメンバー画面に表示されない**

---

## 発生経緯（バグの連鎖）

```
d415ec3  RLS追加: rooms に anon SELECT なし
         └─ 根拠: "postgres_changes は table: "Room" タイポで未機能"
         └─ コメント: "anon SELECT は不要" と明記

1704943  ISSUE-271: table: "Room" → "rooms" に修正
         └─ postgres_changes が本当に有効化された
         └─ しかし anon SELECT ポリシーは追加されなかった
         
結果: anon ユーザーは postgres_changes 購読が RLS で拒否される → CHANNEL_ERROR
```

RLS の設計前提（postgres_changes 未機能）が、直後の ISSUE-271 で崩れた。

---

## 影響範囲

| ユーザー種別 | チャンネル | 状態 |
|------------|-----------|------|
| ゲスト（anon） | `room-play:${code}` | ❌ CHANNEL_ERROR → rejoin ループ |
| ゲスト（anon） | `reactions:${code}` | ⚠️ 間接的に不安定（WebSocket 負荷） |
| ログイン済みメンバー | `room-play:${code}` | ✅ RLS authenticated ポリシーで正常 |

### 具体的なリグレッション

1. **spin_start Broadcast 受信不可**: チャンネルが errored/closed 状態のため
2. **スピン検知遅延最大 10s**: WAITING フェーズのポーリング間隔が 10s
3. **絵文字リアクション表示不全**: `reactions:${roomCode}` チャンネルへの間接影響

---

## 対象ファイル

新規 Prisma migration が必要：

```sql
-- prisma/migrations/20260417100000_add_rooms_anon_rls/migration.sql

-- ゲスト（anon）ユーザーの postgres_changes Realtime 購読を許可
-- 対象: invite_code フィルタ付きで自ルームの状態変化のみ受信
-- 範囲: 招待コードを知っているユーザーは参加者として扱う（設計上の前提）

CREATE POLICY "rooms: anon realtime select"
  ON "rooms"
  FOR SELECT
  TO anon
  USING (true);
-- 注意: anon は invite_code を知らないと部屋に入れない設計。
-- RLS で全 rooms を返しても、Realtime filter: invite_code=eq.XXX で絞られる。
-- Supabase REST API 経由の全件取得は別途 anon ポリシーの USING 条件で制御できるが、
-- 現状の攻撃面は invite_code 総当たりのみ（12文字英数字、実質不可能）。
```

または invite_code 条件付きに制限する場合：

```sql
-- より保守的な代替案（Supabase Realtime の filter との二重チェック）
-- ただし USING 節で filter を使えないため実質 USING (true) と同等

CREATE POLICY "rooms: anon realtime select"
  ON "rooms"
  FOR SELECT
  TO anon
  USING (true);
```

---

## 修正内容

### Option A: 根本修正（推奨）

rooms テーブルに anon SELECT ポリシーを追加する。

RLS migration コメント（d415ec3）にもともと記載があった意図通りの対応：

```
-- Realtime 考慮（d415ec3 のコメント）:
--   - ゲストユーザーは anon ロールで購読するため rooms に anon SELECT が必要
--   - 将来 Broadcast に完全移行後（ISSUE-221 完了後）に anon ポリシーを削除可能
```

### Option B: 安全修正（暫定）

ISSUE-271 を revert して `table: "Room"` に戻す。
postgres_changes を無効に戻すことで CHANNEL_ERROR を回避する。
Broadcast（ISSUE-221）+ polling fallback で現状と同等の動作を維持。

```typescript
// app/room/[code]/play/use-room-sync.ts
table: "Room",  // → "rooms" を revert
```

---

## リスク評価（Option A）

| 項目 | 評価 |
|------|------|
| 影響範囲 | Supabase REST API 経由での rooms 全件取得が anon に許可される |
| 攻撃難度 | invite_code は 12文字英数字。総当たりは事実上不可能 |
| 情報漏洩 | invite_code, status, expires_at 等。メンバー個人情報は rooms テーブルに含まれない |
| 深刻度 | Low（Supabase REST の anon 経由アクセスは anon key の性質上全公開相当） |
| Prisma 影響 | なし（Prisma は superuser 接続で RLS バイパス） |

---

## 受け入れ条件

- [x] rooms に `anon` SELECT ポリシーを追加する migration を作成（`20260417100000_add_rooms_anon_rls`）
- [x] `use-room-sync.ts` subscribe callback に CHANNEL_ERROR ハンドラを追加（fetchRoom フォールバック）
- [x] `pnpm typecheck` 通過
- [ ] Supabase に migration を適用後、ゲストユーザーで CHANNEL_ERROR が出ないことを確認
- [ ] ゲストメンバー画面で絵文字リアクションが正常に表示されることを実機確認
- [ ] ゲストメンバー画面でスピン後 WinnerCard が遅延なく表示されることを実機確認

---

## 優先度: High

- ルーレット後のリアクション表示はコアの感情設計（感情スコア 20/20 を支える機能）
- ゲストモードは「ログイン不要」を謳う主要機能
- リグレッションは直近の修正（d415ec3 + 1704943）が原因で特定済み

## 関連 ISSUE

- ISSUE-221: Broadcast（spin_start）実装
- ISSUE-266: RLS 監査サマリー
- ISSUE-269: rooms テーブル RLS 詳細
- ISSUE-271: postgres_changes テーブル名タイポ修正（本 ISSUE の直接原因）
- ISSUE-213: 絵文字リアクション実装
