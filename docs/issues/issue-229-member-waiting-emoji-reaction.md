# ISSUE-229: UX改善(P2) — 待機中絵文字リアクション実装（ISSUE-225 Phase A）

## ステータス
📋 未着手

## 優先度
**P2 / Medium** — HEART-Engagement の主要ボトルネック。メンバーが受け身のままスピンを待つ

## カテゴリ
UX / Engagement / Multiplayer / Emotion

## 対象スコア
HEART-Engagement: +1.5 / HEART-Happiness: +0.5 / 感情: +0.5 → 総合 +2点

---

## Summary

ISSUE-225 で退室ボタンのみ実装し、待機中リアクション（Phase A）を先送りした。
メンバーはスピンを「見るだけ」の状態。
飲み会での盛り上がりは「全員で演出に参加する」ことで生まれるが、
現状メンバー側に能動的アクションがない。

---

## Background

### 現状（ISSUE-225 実装後）

```
メンバーの waiting 状態:
  ・「誰が奢る…？」テキスト表示
  ・「オーナーの回転を待っています」
  ・「ルームを離脱する」ボタン（ログイン時のみ）
```

絵文字リアクション機能は ISSUE-213 で実装済みだが:
- スピン中（spinning フェーズ）のみ使用可能
- waiting フェーズでは絵文字ボタンが表示されない

### リアクションアーキテクチャ（既存）

`room-play-overlays.tsx` の `handleReact` が Supabase broadcast チャンネル経由でリアクションを送信。
`reactChannelRef` が `use-room-sync.ts` で管理されている。

---

## Current Behavior

1. メンバーが waiting 状態でルームに入る
2. 絵文字ボタンが表示されない（spinning 開始まで使えない）
3. スピンが始まって初めてリアクション可能になる

---

## Expected Behavior

### waiting フェーズからリアクション可能に

- 「🔥」「😂」「😱」「👀」ボタンを waiting フェーズから表示
- オーナー・メンバー両方がリアクション可能（オーナーは SPIN ボタンの邪魔にならない位置に）
- 送信時に画面中央から絵文字フローティングアニメーション（既存機能を活用）
- スピン開始後も継続して使用可能

### レイアウト案

```
[waiting 状態の非オーナー画面]

  誰が奢る…？
  オーナーの回転を待っています

  ┌─────────────────────────────┐
  │  🔥   😂   😱   👀          │  ← 待機中から表示
  └─────────────────────────────┘

  [ルームを離脱する]
```

---

## Scope

- `app/room/[code]/play/_components/spin-controls.tsx` — waiting フェーズで絵文字ボタン表示
- `app/room/[code]/play/_components/room-play-body.tsx` — `handleReact` prop を SpinControls に渡す
- `app/room/[code]/play/_components/room-play-overlays.tsx` — `handleReact` の waiting フェーズ対応確認

---

## Root Cause Hypothesis

ISSUE-213 実装時に「スピン中のリアクション」として設計されたため、
waiting フェーズのリアクションが想定外だった。フェーズ条件の変更で対応可能。

---

## Proposed Fix

### spin-controls.tsx — 絵文字ボタン追加

```tsx
interface SpinControlsProps {
  // ... 既存
  handleReact?: (emoji: string) => void  // 追加
}

// メンバー waiting カード内
{!isOwner && handleReact && (phase === "waiting" || phase === "spinning") && (
  <div className="flex gap-3 justify-center mt-4">
    {["🔥", "😂", "😱", "👀"].map(emoji => (
      <button
        key={emoji}
        onClick={() => handleReact(emoji)}
        className="text-2xl hover:scale-125 transition-transform active:scale-110"
        aria-label={`${emoji} リアクション`}
      >
        {emoji}
      </button>
    ))}
  </div>
)}
```

### room-play-body.tsx — handleReact prop 追加

```tsx
interface RoomPlayBodyProps {
  // ... 既存
  handleReact?: (emoji: string) => void
}

// SpinControls に渡す
<SpinControls
  // ... 既存
  handleReact={handleReact}
/>
```

### page.tsx — handleReact を room-play-body に渡す

`RoomPlayOverlays` から受け取っている `handleReact` を `RoomPlayBody` にも渡す。

---

## Acceptance Criteria

- [ ] 非オーナーのメンバーが waiting 状態でリアクション絵文字を送れる
- [ ] オーナーも waiting 状態でリアクション可能（既存のリアクションUIと競合しない）
- [ ] フローティング絵文字アニメーションが waiting 中も動作する
- [ ] spinning フェーズでの既存リアクション動作に変更なし
- [ ] リアクションボタンが waiting カードのレイアウトを崩さない

## Priority
**P2**

## Impact
HEART-Engagement +1.5、HEART-Happiness +0.5、感情スコア +0.5 → 総合 +2点

## Risk / Notes
- `reactChannelRef` は `use-room-sync.ts` で管理。`handleReact` は overlays 経由で page.tsx から渡す
- waiting フェーズでのリアクションは channel が SUBSCRIBED 後に送信すること
- オーナーのリアクションは SPIN ボタンエリアを避けた配置にする（モバイル UX）
