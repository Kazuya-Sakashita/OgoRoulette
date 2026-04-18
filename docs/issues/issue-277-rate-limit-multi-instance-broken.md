# ISSUE-277: Critical — レートリミットが Vercel マルチインスタンスで完全無効

## ステータス
✅ 対応完了 — PostgreSQL バックエンドを追加（案A）。優先順: KV（Vercel Redis, オプション）→ DB（PostgreSQL, 常時利用可）→ Memory（ローカル開発フォールバック）。ON CONFLICT DO UPDATE でアトミックなインクリメントを実現。RLS 有効+ポリシーなしで Supabase REST API から完全非公開。

## 優先度
**Critical / セキュリティ**

## カテゴリ
Security / Rate Limiting / Serverless / Infrastructure

---

## 問題

`app/api/rooms/route.ts` 他のレートリミットは `globalThis.rateLimitStore` をインメモリで管理している。
Vercel Functions はリクエストごとに異なるインスタンスで実行されるため、インスタンス間でストアが共有されない。

```typescript
// lib/rate-limit.ts（現状）
const store = globalThis.rateLimitStore ??= new Map<string, RateLimitEntry>()
// ↑ 同一インスタンス内では機能するが、Vercel の別インスタンスは別 Map を持つ
```

1インスタンスで5回叩いてブロックされても、別インスタンスへのリクエストはカウントゼロからスタートする。

---

## なぜ危険か

- ルーム作成 API（`POST /api/rooms`）はレートリミットのみで DoS 防御している
- 実質的にレートリミットが機能していない = DoS 攻撃が通る
- DB を圧迫するルーム大量作成が可能
- Supabase の接続数上限に達した場合、全ユーザーに影響

---

## 発生条件

- Vercel 本番環境（常時発生）
- ローカル開発環境では単一プロセスのため発現しない

---

## 影響範囲

- `POST /api/rooms`（ルーム作成）
- `POST /api/groups`（グループ作成）
- その他レートリミットを適用している全エンドポイント

---

## 推定原因

サーバーレス環境でインメモリキャッシュを使ったレートリミットは原理的に機能しない。
ISSUE-201 で検知済みだが対応が保留されていた。

---

## 修正方針

### 案A: Supabase テーブルを使った分散レートリミット（推奨）

```sql
-- rate_limits テーブル
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL
);
```

```typescript
// Supabase の upsert + SELECT で原子的にカウント
const { data } = await supabase.rpc('increment_rate_limit', { key, window_ms, max_requests })
if (data.count > max_requests) return 429
```

### 案B: Vercel KV（Redis）を使う

Vercel Marketplace の Upstash Redis を使う。コストが発生するが実装がシンプル。

### 案C: Supabase Edge Functions へ移動

ルーム作成をステートフルな Supabase Edge Function に移動してレートリミットを DB トランザクションで管理。

---

## 受け入れ条件

- [x] 分散環境（複数インスタンス）でレートリミットが正しく機能すること（PostgreSQL DB バックエンド）
- [x] 同一 IP から制限回数を超えたリクエストが 429 を返すこと（ON CONFLICT DO UPDATE でアトミック）
- [x] 既存のレートリミット設定値（ウィンドウ・上限）を維持すること
- [x] `globalThis.rateLimitStore` への依存を削除すること（DB フォールバック経由）

## 関連 ISSUE

- ISSUE-201: インメモリレートリミット問題（先行検知）
