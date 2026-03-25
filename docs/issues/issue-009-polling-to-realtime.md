# [ISSUE-009] 3 秒ポーリングアーキテクチャの Supabase Realtime（WebSocket）への移行

## 🧩 概要

現在のマルチプレイヤー同期は 3 秒ごとの HTTP ポーリング（`setInterval` 相当）で実装されている。ユーザー数が増えると DB への読み取りリクエストが線形増加し、コストとレイテンシの両面で問題になる。Supabase Realtime（WebSocket）に移行することで、リアルタイム体験の向上と DB 負荷の削減を両立できる。

## 🚨 背景 / なぜ問題か

**現在のポーリング実装（`play/page.tsx:214`）:**

```tsx
useEffect(() => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let cancelled = false

  const poll = async () => {
    await fetchRoom()
    if (!cancelled) timeoutId = setTimeout(poll, 3000)
  }

  poll()
  return () => { cancelled = true; if (timeoutId) clearTimeout(timeoutId) }
}, [code])
```

**問題:**
- 10 人のメンバーが同時接続 → 毎秒 10/3 ≈ 3.3 リクエスト/秒、1 分で 200 リクエスト
- ルームが 100 個同時稼働 → 毎分 20,000 DB 読み取り
- Supabase Free Tier の DB 接続数上限（60 接続）に到達しやすい
- ポーリング間隔（3 秒）は体験上の遅延にもなる（メンバーへのスピン通知が最大 3 秒遅れる）
- `fetchRoom` はルームの全データ（メンバー・セッション）を毎回取得するため、N+1 に近い問題も発生

## 🎯 目的

ポーリングを Supabase Realtime の PostgreSQL Changes（WebSocket）に置き換え、DB 負荷を削減しながらリアルタイム性を向上する。

## 🔍 影響範囲

- **対象機能:** マルチプレイヤー同期
- **対象画面:** `/room/[code]/play`、`/room/[code]`（ロビー）
- **対象コンポーネント:** `app/room/[code]/play/page.tsx`
- **対象 API:** `GET /api/rooms/[code]`（呼び出し頻度が激減）

## 🛠 修正方針

**Supabase Realtime の設定:**

1. Supabase ダッシュボードで `Room` テーブルの Realtime を有効化
2. RLS（Row Level Security）を設定（招待コードで読み取りを許可）

**クライアント側の変更:**

```tsx
// Realtime サブスクリプション（ポーリングの代替）
useEffect(() => {
  const supabase = createClient()

  // 初回データ取得
  fetchRoom()

  // Room テーブルの変更を購読
  const channel = supabase
    .channel(`room:${code}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "Room",
        filter: `inviteCode=eq.${code.toUpperCase()}`,
      },
      (payload) => {
        // 変更があった場合のみデータ再取得
        fetchRoom()
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [code])
```

**段階的移行:**
1. Realtime を追加（ポーリングと並行稼働）
2. ポーリング間隔を 10 秒に延長して Realtime のフォールバックに
3. 安定確認後にポーリングを削除

## ⚠️ リスク / 副作用

- Supabase Realtime は Free Tier で最大 200 同時接続（Pro Tier で増加）
- RLS 設定を誤ると全ユーザーのルームデータが漏洩する可能性がある
- WebSocket 接続が切れた場合のフォールバックとしてポーリングを維持することを推奨（移行期間中）
- `postgres_changes` は INSERT/UPDATE/DELETE のイベントを発火するが、ペイロードには変更後のデータ（`new` フィールド）が含まれる。ただし `RoomMember` の変更検知には別チャンネルが必要

## ✅ 確認項目

- [ ] メンバーがルームに参加した際、オーナーの画面に即座に反映される
- [ ] スピン開始（room.status → IN_SESSION）がメンバーに即座に通知される
- [ ] Realtime 接続が切れた場合にフォールバックポーリングが動作する
- [ ] 複数ルームが同時稼働してもパフォーマンスが劣化しない

## 🧪 テスト観点

**手動確認:**
1. 2 端末で同じルームに接続 → 一方の端末でメンバーを追加 → もう一方の画面に即座（< 1秒）に反映される
2. SPIN 押下 → メンバー端末へのアニメーション開始が 3 秒以内（ポーリング比）で高速化される
3. モバイルのバックグラウンド移行 → フォアグラウンド復帰後にデータが最新になっている

## 📌 受け入れ条件（Acceptance Criteria）

- [ ] ルームデータの変更が WebSocket で通知され、ポーリングより低レイテンシで反映される
- [ ] Supabase Realtime を使用してもルーム間のデータ漏洩がない（RLS 設定）
- [ ] Realtime 接続失敗時にポーリングフォールバックが機能する
- [ ] DB への読み取りリクエストがポーリング比で 50% 以上削減される

## 🏷 優先度

**Medium**（スケール時に問題になるが、初期ユーザー数では許容範囲）

## 📅 実装順序

**9番目**（Critical/High 対応後。スケールアウトが見えてきたタイミングで着手）

## 🔗 関連Issue

なし
