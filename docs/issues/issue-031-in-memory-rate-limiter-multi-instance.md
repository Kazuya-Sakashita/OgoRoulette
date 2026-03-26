# ISSUE-031: インメモリ rate limiter が Vercel 複数インスタンス間で機能しない

## 概要

`lib/rate-limit.ts` の rate limiter はプロセスメモリに状態を持つ。Vercel Serverless Functions は複数インスタンスで動作するため、インスタンスをまたいだリクエストのカウントが共有されず、rate limit が実質的に無効化される。

## 背景

```typescript
// lib/rate-limit.ts lines 18-20
// ⚠ Vercel Serverless の複数インスタンス間では共有されない。
// 本番スケール後は Redis (Upstash 等) に移行することを推奨。
```

コード内コメントでも認識されているが未対応。現状の rate limit は「同一インスタンスへの連続リクエスト」のみ制限でき、インスタンス分散環境では無効。

## 問題点

- 現在何が起きているか: 10リクエスト/分の制限が意図通りに機能しない（インスタンスをまたぐと各インスタンスのカウンターがリセットされる）
- ユーザー影響: 悪意ある利用者が複数インスタンスにリクエストを分散させると制限を回避できる
- 技術的影響: ISSUE-026 で追加する rate limit も含めて、すべての制限が Vercel スケールアウト時に無効化される

## 原因

分散対応の state store（Redis 等）なしで rate limiting を実装している。

## 修正方針

**短期:** 現状維持（単一インスタンスの保護は有効。ローンチ初期は低トラフィックのため実害は限定的）。README に既知の制限として明記する。

**中長期:** Upstash Redis（Vercel 統合あり、無料枠あり）を使った分散 rate limiter に移行:

```typescript
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1m"),
})
```

## タスク

- [ ] 現状を既知の制限として `docs/` に明記
- [ ] Upstash Redis 導入の技術調査と コスト見積もり
- [ ] （中長期）`lib/rate-limit.ts` を Upstash Redis ベースに置換
- [ ] 回帰確認: 移行後も既存の rate limit テストが通ること

## 受け入れ条件

- 複数 Vercel インスタンスをまたいだ rate limit が機能する（中長期目標）
- 短期では制限の限界が文書化されている

## 優先度

Medium

## デプロイブロッカー

No（単一インスタンスの保護は機能する。ローンチ初期は許容範囲）
