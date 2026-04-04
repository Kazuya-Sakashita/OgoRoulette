# 収益モデル設計（プレミアムプラン）

## 背景

AARRR Revenue が 5/20（最低評価）。現状 OgoRoulette は完全無料で収益ゼロ。G-STACK 評価でも「収益化なしでは持続性がない」と指摘されている。NSM（週次完走ルーム数）が向上しても、それがビジネス価値に転換されていない。

## 問題

- アプリが完全無料で収益がない
- Vercel・Supabase の運用コストが増大すれば継続困難
- 無料ユーザーへの価値提供と有料化のバランス設計が未定
- 課金基盤（Stripe 等）が未導入

## 目的

- AARRR Revenue を 5 → 10 (+5) に改善する
- 持続可能な運用基盤を構築する
- コアバリュー（無料でルーレット）を損なわずに収益化する

## 収益モデル案

### モデルA: フリーミアム（推奨）

| 機能 | Free | Pro（月額300〜500円） |
|-----|------|---------------------|
| 参加人数上限 | 10人 | 無制限 |
| 保存グループ数 | 3グループ | 無制限 |
| シェアカード | OgoRoulette透かし入り | ロゴなし・カスタムカラー |
| 過去の抽選履歴 | 直近5回 | 全履歴 |
| プッシュ通知 | なし | あり（ISSUE-188） |
| 広告 | あり | なし |

### モデルB: 使い切り課金

- 1ルーム作成 = 1コイン（50〜100円）
- 10コインパック = 400円（20%お得）
- 飲み会文化に合わせた「その場課金」

### モデルC: B2B プラン

- チーム管理機能（Slack連携・CSVエクスポート）
- 月額1,000〜3,000円/チーム
- 企業の懇親会・チームランチ向け

## 推奨アプローチ

**フリーミアム（モデルA）から開始**

理由:
- 初期ユーザー獲得を妨げない
- NSM（完走ルーム数）を最大化しながら転換率を測定できる
- 実装コストが最も低い（機能フラグ + Stripe Billing）

### 実装優先順序

1. **Stripe 導入** (`npm install stripe @stripe/stripe-js`)
2. **Prisma: User.plan フィールド追加**（`"free" | "pro"`）
3. **機能フラグ**: `isPro(user)` チェック関数
4. **制限の実装**:
   - グループ保存 3件超 → アップグレードモーダル
   - 参加人数 10人超 → アップグレードモーダル
5. **Stripe Checkout セッション** (`/api/billing/checkout/route.ts`)
6. **Webhook** (`/api/billing/webhook/route.ts`): 支払い完了で DB 更新

### Step 1: Stripe 設定

```bash
npm install stripe @stripe/stripe-js
```

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRO_PRICE_ID=price_...
```

### Step 2: アップグレードモーダル

```typescript
// components/upgrade-modal.tsx
// グループ保存 3件超時に表示
// 「Pro にアップグレード」→ /api/billing/checkout
```

### Step 3: Stripe Checkout

```typescript
// app/api/billing/checkout/route.ts
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID!, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/home?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/home`,
  })
  return Response.json({ url: session.url })
}
```

## 完了条件

- [ ] フリーミアム制限の設計が確定（機能・上限値）
- [ ] Stripe アカウントが作成され、商品・価格が設定されている
- [ ] グループ保存 3件超でアップグレードモーダルが表示される
- [ ] Stripe Checkout でサブスクリプション購入ができる
- [ ] Webhook で DB の `user.plan` が更新される
- [ ] Pro プランでは制限が解除される
- [ ] `npm run build` でエラーなし

## 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `prisma/schema.prisma` | `User.plan` フィールド追加 |
| `lib/plan.ts` | `isPro(user)` ユーティリティ（新規） |
| `app/api/billing/checkout/route.ts` | Stripe Checkout セッション（新規） |
| `app/api/billing/webhook/route.ts` | Stripe Webhook 処理（新規） |
| `components/upgrade-modal.tsx` | アップグレード誘導UI（新規） |
| `hooks/use-groups.ts` | グループ保存制限チェック追加 |

## リスク

**中〜高**。
- Stripe 本番環境の設定ミスで課金不具合が起きる可能性
- フリーミアム制限が厳しすぎると新規ユーザーの離脱増加
- 日本のキャッシュレス文化・サブスク抵抗感への配慮が必要
- 既存無料ユーザーの移行ポリシー設計が必要

## ステータス

**未着手** — 2026-04-04

## 優先度

**Nice-to-have** — NSM・Retention が安定してから着手。月次アクティブユーザーが 500 MAU を超えたタイミングでの収益化を推奨。

## 期待効果

- AARRR Revenue: 5 → 10 (+5)
- 総合スコア: 71 → 73
- 月収: 300円 × 転換率1% × MAU として、5,000 MAU 到達時に月15,000円規模

## 関連ISSUE

- issue-188（PWAプッシュ通知 — Pro機能候補）
- issue-182（リテンション再開CTA — Pro転換トリガー）
- issue-191（テストスイート — 課金フロー保護に必須）
