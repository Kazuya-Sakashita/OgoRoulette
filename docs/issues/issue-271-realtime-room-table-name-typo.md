# ISSUE-271: Realtimeの postgres_changes テーブル名タイポ（"Room" → "rooms"）

## 概要

`use-room-sync.ts` の Supabase Realtime `postgres_changes` サブスクリプションで、
テーブル名を `"Room"`（Prismaモデル名・大文字）と指定しているが、
PostgreSQL の実際のテーブル名は `"rooms"`（小文字）。
この不一致により postgres_changes によるリアルタイム更新が現在**機能していない**。

---

## 対象ファイル

`app/room/[code]/play/use-room-sync.ts` — line 79

```typescript
// 現状（誤り）
{
  event: "*",
  schema: "public",
  table: "Room",          // ← Prismaモデル名。実際のテーブル名は "rooms"
  filter: `invite_code=eq.${code.toUpperCase()}`,
}

// 修正後
{
  event: "*",
  schema: "public",
  table: "rooms",         // ← PostgreSQLの実際のテーブル名（@@map: "rooms"）
  filter: `invite_code=eq.${code.toUpperCase()}`,
}
```

---

## 現状の影響

| 機構 | 状態 |
|------|------|
| `postgres_changes` on `"Room"` | ❌ イベント未受信（テーブル名不一致） |
| Broadcast `spin_start`（ISSUE-221） | ✅ 動作中（RLSと無関係） |
| polling fallback（2s / 10s） | ✅ 動作中（安全網として機能） |

現在はBroadcast + pollingで機能を補完しているため、ユーザー体験への即時影響は軽微。
ただし、`postgres_changes`は元来Broadcastより確実な変更検知（DB書き込みと連動）の役割を持つため、修正することで信頼性が向上する。

---

## 修正内容

```typescript
// app/room/[code]/play/use-room-sync.ts

.on(
  "postgres_changes" as Parameters<ReturnType<typeof supabase.channel>["on"]>[0],
  {
    event: "*",
    schema: "public",
    table: "rooms",   // "Room" → "rooms" に修正
    filter: `invite_code=eq.${code.toUpperCase()}`,
  },
  () => { fetchRoom() }
)
```

---

## 修正後の注意点

### RLS との関係
ISSUE-266（RLS追加）にて `rooms` テーブルに以下のポリシーを設定済み：

- `authenticated` ロール: オーナー or メンバーのルームのみ SELECT 可
- `anon` ロール: **SELECT ポリシーなし**（完全排除）

`postgres_changes` を修正した場合、以下の動作となる：

| ユーザー種別 | Realtime受信 |
|------------|------------|
| ログイン済み（自分のルーム） | ✅ 受信可（authenticated SELECT policy あり） |
| ゲスト（anon ロール） | ❌ 受信不可（anon SELECT policy なし） |

**ゲストユーザーは polling fallback（2s/10s）でカバーされるため問題なし。**
Broadcast（spin_start）も引き続き機能する。

### Supabase Realtime の有効化確認
`rooms` テーブルの Supabase Realtime が Dashboard で有効化されているか確認すること。
有効化されていない場合、`postgres_changes` は機能しない（テーブル名修正だけでは不十分）。

---

## 受け入れ条件

- [ ] `table: "Room"` を `table: "rooms"` に修正
- [ ] Supabase Dashboard で `rooms` テーブルの Realtime が有効化されていることを確認
- [ ] ログイン済みオーナーのルームで、別デバイスからルームに参加した際に postgres_changes イベントが届くことを確認
- [ ] ゲストユーザーは polling fallback で正常動作することを確認
- [ ] `pnpm typecheck` 通過

---

## 優先度: Low
- Broadcast + polling で現状補完されており、ユーザー体験への即時影響は軽微
- ISSUE-221（Broadcast）完了後、長期的にはpollingを廃止してrealtime+broadcastに統合する方針の場合は優先度上昇

## 関連ISSUE
- ISSUE-221: Broadcast実装（spin_start）
- ISSUE-266: RLS監査（rooms の anon SELECT 判断の根拠）
- ISSUE-009: Realtime + polling fallback 設計
