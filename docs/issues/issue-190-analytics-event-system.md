# Analyticsイベント体系整備（NSMトラッキング基盤）

## 背景

Vercel Analytics を導入しているが、カスタムイベントの体系が不完全でファネル分析ができない。「どこで離脱するか」「どのシェアが最も効果的か」「グループ再開CTAのクリック率」などが計測できず、データ駆動の改善が困難。ISSUE-182〜183 の施策を実装したが、効果測定の仕組みが整っていない。

## 問題

- `lib/analytics.ts` の `AnalyticsEvent` に必要なイベントが不足している
- ファネル分析用イベントが未定義（Activation CVR不明）
- グループ再開CTA（ISSUE-182）のクリック数が計測されていない
- Canvas シェアカード（ISSUE-183）の実際のシェア率が不明
- NSM（週次完走ルーム数）を Vercel Analytics で直接確認できない

## 目的

- NSM に至るファネル（表示→再開CTA→スピン→シェア）を可視化する
- 各施策の効果をデータで測定できる状態にする
- G-STACK Tactics の PDCA 基盤を整備する

## 対応内容

### Step 1: AnalyticsEvent の追加

```typescript
// lib/analytics.ts
export enum AnalyticsEvent {
  // 既存イベント（維持）
  SPIN_BUTTON_CLICKED = "spin_button_clicked",
  SPIN_API_SUCCESS = "spin_api_success",
  SPIN_API_ERROR = "spin_api_error",
  SPIN_ANIMATION_COMPLETE = "spin_animation_complete",
  RESPIN_CLICKED = "respin_clicked",
  PHASE_TIMEOUT = "phase_timeout",
  SPIN_COMPLETE_FAILED = "spin_complete_failed",

  // ISSUE-190: Funnel events（新規追加）
  HOME_VIEWED = "home_viewed",

  // Retention（ISSUE-182）
  REENGAGEMENT_CTA_CLICKED = "reengagement_cta_clicked",
  GROUP_SAVED = "group_saved",
  GROUP_SELECTED = "group_selected",

  // Share（ISSUE-181/183）
  SHARE_PRIMARY_CLICKED = "share_primary_clicked",
  SHARE_CARD_GENERATED = "share_card_generated",
  SHARE_X_CLICKED = "share_x_clicked",
  SHARE_LINE_CLICKED = "share_line_clicked",
  DETAILS_ACCORDION_OPENED = "details_accordion_opened",

  // Viral（ISSUE-187）
  SHARE_JOIN_CLICK = "share_join_click",
  SHARE_JOIN_COMPLETE = "share_join_complete",

  // Room lifecycle
  ROOM_CREATED = "room_created",
  ROOM_JOINED = "room_joined",
  ROOM_COMPLETED = "room_completed",

  // Push（ISSUE-188）
  PUSH_SUBSCRIBE_SUCCESS = "push_subscribe_success",
  PUSH_SUBSCRIBE_FAILED = "push_subscribe_failed",
  PUSH_PROMPT_SHOWN = "push_prompt_shown",
  PUSH_PROMPT_DISMISSED = "push_prompt_dismissed",
}
```

### Step 2: trackEvent 呼び出し追加

#### app/home/page.tsx

```typescript
// ホーム表示時
useEffect(() => {
  trackEvent(AnalyticsEvent.HOME_VIEWED)
}, [])

// 再開CTAクリック時（ISSUE-182 handleSpinWithGroup の前）
const handleSpinWithGroup = (id: string) => {
  const isFromReengagement = activeGroup?.id === id
  if (isFromReengagement) {
    trackEvent(AnalyticsEvent.REENGAGEMENT_CTA_CLICKED, { group_id: id })
  }
  trackEvent(AnalyticsEvent.GROUP_SELECTED)
  // ...既存処理
}

// グループ保存後
await saveGroup(name, members)
trackEvent(AnalyticsEvent.GROUP_SAVED)
```

#### components/winner-card.tsx

```typescript
// Phase B シェアボタンクリック
const handlePrimaryShare = useCallback(async () => {
  trackEvent(AnalyticsEvent.SHARE_PRIMARY_CLICKED)
  const imageBlob = await generateShareCard(winner, color).catch(() => null)
  if (imageBlob) trackEvent(AnalyticsEvent.SHARE_CARD_GENERATED)
  // ...既存処理
}, [...])

// X/LINE ボタンクリック
const handleShare = (platform: "x" | "line") => {
  if (platform === "x") trackEvent(AnalyticsEvent.SHARE_X_CLICKED)
  if (platform === "line") trackEvent(AnalyticsEvent.SHARE_LINE_CLICKED)
  // ...既存処理
}

// アコーディオン展開
<button onClick={() => {
  setShowDetails((v) => !v)
  if (!showDetails) trackEvent(AnalyticsEvent.DETAILS_ACCORDION_OPENED)
}}>

#### app/room/[code]/play/page.tsx

```typescript
// spin-complete 成功時
if (res.ok) {
  fetchRanking()
  trackEvent(AnalyticsEvent.ROOM_COMPLETED)
}
```

### Step 3: Vercel Analytics ダッシュボード確認

- カスタムイベント一覧でファネルを確認
- `reengagement_cta_clicked` / `spin_button_clicked` の比率（再開CTA効果）
- `share_primary_clicked` / `share_card_generated` の比率（Canvas生成成功率）

## 完了条件

- [ ] `AnalyticsEvent` に ISSUE-190 で定義した全イベントが追加されている
- [ ] ホーム画面で `home_viewed` が送信される
- [ ] 再開CTAクリック時に `reengagement_cta_clicked` が送信される
- [ ] Phase B「シェアする」クリック時に `share_primary_clicked` が送信される
- [ ] Vercel Analytics ダッシュボードで各イベントが確認できる
- [ ] `npm run build` でエラーなし

## 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `lib/analytics.ts` | `AnalyticsEvent` に新規イベント追加 |
| `app/home/page.tsx` | 再開CTA・グループ保存・ホーム表示のイベント |
| `components/winner-card.tsx` | シェア・アコーディオンのイベント |
| `app/room/[code]/play/page.tsx` | ルーム完走イベント |

## リスク

低。既存フローへの影響なし。イベント送信失敗はUI に影響しない（fire-and-forget）。

## ステータス

**完了** — 2026-04-05

## 優先度

**Critical** — 計測なくして改善なし。ISSUE-186（Search Console）と同時着手推奨。

## 期待効果

- データ駆動改善のサイクルが回せるようになる
- ISSUE-182〜183 の効果が定量的に確認できる
- G-STACK Tactics スコアの向上基盤

## 関連ISSUE

- issue-187（ref=shareコンバージョン計測）
- issue-182（リテンション再開CTA）
- issue-183（ウイルスループURL）
- issue-181（Phase B シェアCTA）
