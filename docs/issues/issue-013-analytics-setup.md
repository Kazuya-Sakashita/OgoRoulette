# [ISSUE-013] 行動分析基盤の欠如でユーザー行動が把握できない

## 🧩 概要

現在の分析は Vercel Web Vitals（LCP/FID/CLS）のみで、ユーザーの実際の行動（どこで離脱するか・シェア率・スピン回数・グループ保存率等）が把握できない。改善の意思決定をデータに基づいて行う基盤がないため、どの施策が効いているか判断できない。

## 🚨 背景 / なぜ問題か

**現在計測できていない主要指標:**
- スピン完了率（SPIN ボタンを押してから結果が表示されるまで完走したか）
- 動画シェア率（録画開始 → シェア完了）
- 「もう一回！」押下率
- ルーム作成 → メンバー参加率（招待 QR が有効に使われているか）
- ゲスト → ログイン転換率
- エラー発生率（spin-complete 失敗、clock skew 等）

**なぜ重要か:**
- SPIN ボタンバグの発生頻度が分からない（ユーザーが報告しない限り気づけない）
- どの機能が使われているか不明
- A/B テストや改善の効果測定ができない

## 🎯 目的

主要なユーザーアクション・エラー・ファネルを計測し、プロダクト改善の意思決定をデータに基づいて行えるようにする。

## 🔍 影響範囲

- **対象機能:** 全機能（横断的）
- **対象コンポーネント:** `play/page.tsx`、`home/page.tsx`、`room/[code]/play/page.tsx`

## 🛠 修正方針

**ツール選定:**

| ツール | 月額 | 特徴 |
|--------|------|------|
| PostHog（推奨） | 無料〜（OSS も可） | イベント追跡・ファネル分析・セッションリプレイ |
| Mixpanel | 無料〜 | イベント追跡・コホート分析 |
| Vercel Analytics Pro | $20〜 | Web Vitals + カスタムイベント |

**推奨: PostHog**（GDPR 対応・日本語対応・OSS で自己ホスト可能）

**計測すべき主要イベント:**

```ts
// 計測イベント定義
const EVENTS = {
  // スピンファネル
  SPIN_BUTTON_CLICKED: "spin_button_clicked",
  SPIN_API_SUCCESS: "spin_api_success",
  SPIN_API_ERROR: "spin_api_error",           // {error: string}
  SPIN_ANIMATION_COMPLETE: "spin_animation_complete",
  SPIN_TIMEOUT: "spin_timeout",               // バグ検知

  // シェアファネル
  SHARE_SHEET_OPENED: "share_sheet_opened",
  SHARE_BUTTON_CLICKED: "share_button_clicked",  // {platform: string}
  SHARE_SUCCESS: "share_success",
  VIDEO_DOWNLOAD: "video_download",

  // ルームファネル
  ROOM_CREATED: "room_created",
  ROOM_JOINED: "room_joined",
  RESPIN_CLICKED: "respin_clicked",

  // エラー
  PHASE_TIMEOUT: "phase_timeout",             // {phase: string}
  ISOWNER_FLICKER: "isowner_flicker_detected",
} as const
```

**実装例（`play/page.tsx`）:**

```tsx
import posthog from "posthog-js"

// SPIN 押下
const handleSpin = async () => {
  posthog.capture(EVENTS.SPIN_BUTTON_CLICKED, { participants_count: participants.length })
  // ...
  if (!res.ok) {
    posthog.capture(EVENTS.SPIN_API_ERROR, { error: data.error, status: res.status })
  }
}

// タイムアウト発火時
posthog.capture(EVENTS.PHASE_TIMEOUT, { phase, duration_ms: ... })
```

## ⚠️ リスク / 副作用

- ユーザーデータを外部サービスに送信するため、プライバシーポリシーの更新が必要
- PostHog の初期化は `next/script` で遅延ロード推奨（パフォーマンス影響を最小化）

## ✅ 確認項目

- [ ] PostHog（または選定ツール）が正しく初期化される
- [ ] 主要イベントが PostHog ダッシュボードで確認できる
- [ ] スピンファネル（ボタン押下 → 完了）の離脱率が可視化される
- [ ] プライバシーポリシーにトラッキングに関する記述が追加される

## 🧪 テスト観点

**手動確認:**
1. PostHog ダッシュボードでイベントが到達することを確認
2. スピンフローを一通り実行してイベントが正しく記録される
3. エラーシナリオ（API 失敗等）でエラーイベントが記録される

## 📌 受け入れ条件（Acceptance Criteria）

- [ ] スピンファネルの主要ステップ（ボタン押下・API 成功/失敗・完了）が計測される
- [ ] フェーズタイムアウト（バグ）が発生したときにアラートイベントが記録される
- [ ] シェア率（シェアボタン押下数 / スピン完了数）が計算できる
- [ ] プライバシーポリシーが更新される

## 🏷 優先度

**Medium**

## 📅 実装順序

**13番目**（リリース前に設定。データなしで改善は困難）

## 🔗 関連Issue

なし
