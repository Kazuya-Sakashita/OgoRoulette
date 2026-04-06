# ISSUE-215: AARRR-Revenue Phase 1 — プレミアムテーマ + ブランドルームモード

## ステータス
📋 未着手

## 優先度
**Medium** — Revenue 0/5 が 6軸スコアの構造的ボトルネック。感情スコア 17+ 達成後に着手

## カテゴリ
Business / Revenue / UX

## 対象スコア
AARRR-Revenue: +2（0→2/5） / G-STACK-Goal: +1 / G-STACK-Strategy: +1

---

## 背景

現在の AARRR-Revenue スコアは 0/5（完全無料・マネタイズ設計なし）。
これが AARRR 軸の最大の足かせとなっており、6軸スコアの上限を構造的に制限している。

マネタイズは大掛かりな実装は不要。「ユーザーが自然に払いたくなる価値」を設計する。

OgoRoulette のユーザーは：
- 飲み会・合コン・ランチなどのリアルな場で使う
- 友人・同僚に見せる場面で使う
- 「見た目がかっこいい」「特別感がある」ことに価値を感じる

→ **見た目のカスタマイズ（テーマ）** が最も自然なマネタイズ起点。

---

## G-STACK 評価

| 軸 | 評価 | 根拠 |
|----|------|------|
| Goal | ◯ | 継続利用・収益化は明示されたゴール |
| Strategy | ◯ | 無料ユーザーを損なわず Premium UX で差別化 |
| Tactics | ◯ | テーマ選択 UI は既存コンポーネントで実装可能 |
| Architecture | △ | Stripe/PAY.JP 連携が必要 |
| Risk | △ | 課金実装は初めて。失敗リスクは UI のみにとどめる |

**判断: 実装推奨**（Architecture/Risk は小さく始めることでヘッジ可能）

---

## 問題

### ① Revenue = 0 が AARRR 軸の天井を下げている

G-STACK + HEART がいくら高くても、AARRR-Revenue = 0 だと
AARRR 軸の合計スコアが 16/20 止まりになる（他が全部 4/5 でも）。

### ② 「課金のきっかけ」が設計されていない

毎回無料で使えるため「有料にする理由を考えたことがない」状態。
ユーザーが価値を感じた瞬間（WinnerCard 表示後など）に課金提案がない。

---

## 改善内容

### Step 1: フリーミアム設計の定義（実装なし）

```
Free プラン（現在と同じ）:
- デフォルトテーマ（ダーク）
- ルーム最大 10人
- 履歴 7日間

Premium プラン（月額 ¥300 または ¥500）:
- 追加テーマ（ネオン / ゴールド / パーティー）
- ルーム最大 20人  
- 履歴無制限
- ルーム名にブランド/チーム名を設定可能（名刺代わり）
- 当選者への「ありがとうコメント」機能
```

### Step 2: テーマプレビュー UI の実装（課金なしで体験）

```tsx
// 設定画面 or WinnerCard 後のモーダル
const THEMES = [
  { id: 'default', name: 'デフォルト', free: true },
  { id: 'neon', name: 'ネオン ✨', free: false, preview: '/themes/neon-preview.png' },
  { id: 'gold', name: 'ゴールド 🏆', free: false, preview: '/themes/gold-preview.png' },
  { id: 'party', name: 'パーティー 🎉', free: false, preview: '/themes/party-preview.png' },
]

// 無料ユーザーはプレビュー見学可能 → 「プレミアムにアップグレード」CTA
```

### Step 3: アップグレードの導線設計

当選発表後（感情ピーク時）に 1回だけ表示：
```tsx
// WinnerCard 閉じた後、初回のみ
<PremiumNudge
  message="テーマをカスタマイズしてさらに盛り上げよう"
  ctaText="プレミアムを見る（¥300/月〜）"
  onDismiss={() => setPremiumNudgeSeen(true)}
/>
```

### Step 4: Stripe 連携（最小実装）

```bash
npm install stripe @stripe/stripe-js
```

```ts
// app/api/checkout/route.ts
// Stripe Checkout Session を作成して redirect
// webhook で premium_until を DB に書き込む
```

---

## 影響ファイル

- `app/settings/page.tsx` — テーマ選択 UI 追加
- `components/winner-card.tsx` — Premium Nudge（初回のみ）
- `app/api/checkout/route.ts`（新規）
- `app/api/webhooks/stripe/route.ts`（新規）
- `prisma/schema.prisma` — User に `premiumUntil` フィールド追加

---

## 完了条件

**Phase 1a（設計・UI、課金なし）：**
- [ ] テーマ選択プレビュー UI が実装され、Premium テーマは「鍵アイコン」で表示
- [ ] WinnerCard 後に初回のみ Premium Nudge が表示される
- [ ] ¥300/月 の Stripe Product が Stripe ダッシュボードで作成済み

**Phase 1b（課金実装）：**
- [ ] Stripe Checkout でクレジットカード決済が完了できる
- [ ] 決済完了後、Premium テーマが適用される
- [ ] ¥0 → 1件でも課金が発生したことを確認

## 期待スコア上昇

AARRR-Revenue: +2（0→2/5） / G-STACK-Goal: +1 / G-STACK-Strategy: +1
→ 総合: +2〜3点

## 注意事項（リスク）

- 課金実装は複雑。Phase 1a（UI のみ）と Phase 1b（課金）に分割して進める
- Revenue +2 は「設計が見えている」状態で付与。実際の収益が発生すれば +4 まで上昇
- 感情スコアが 17/20 未満の段階では着手しない（演出改善が先）
