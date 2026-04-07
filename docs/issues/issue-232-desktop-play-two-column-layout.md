# ISSUE-232: UX改善(P2) — デスクトップplayページ2カラムレイアウト実装

## ステータス
✅ 完了 2026-04-07

## 優先度
**P2 / Medium** — ISSUE-227 のPhase 2。max-width拡張済み、2カラム化で真のデスクトップ最適化

## カテゴリ
UX / Layout / Desktop / Responsive

## 対象スコア
G-STACK-Kando: +0.5 / Kano: +0.5 / HEART-Happiness: +0.5 → 総合 +1点

---

## Summary

ISSUE-227（2026-04-07完了）で `/room/[code]/play` の max-width を `390px → 680px` に拡張した。
しかしレイアウト構造はシングルカラムのまま。
PCオーナーが使う場面（ノートPCでメンバーに画面を見せる）では、
参加者リストとルーレットが縦に並んでいるため、ルーレットが画面の半分以下に収まっている。

---

## Background

### ISSUE-227 実装後の現状

```
desktop (680px wide, single column):
┌──────────────────────────────┐
│  ヘッダー                     │
│  参加者リスト                 │
│  金額入力                     │
│  ─────────────────────────── │
│  ルーレット (360px max)        │
│  SPINボタン                   │
└──────────────────────────────┘
```

ルーレットが大きくなりきっていない。参加者リストとルーレットが縦並びで効率が悪い。

### デスクトップ利用シナリオ

飲み会の幹事（オーナー）がノートPCで操作し、画面をスマホメンバーに見せる場面。
ルーレットが大きいほど「全員で見る」体験の質が上がる。

---

## Current Behavior（ISSUE-227後）

- `md:max-w-[680px]` でウィンドウ幅が広がった
- ルーレットは最大 360px（viewport依存）
- 参加者リスト + 金額 + ルーレット + SPINが縦一列

---

## Expected Behavior

### md以上で2カラムレイアウト

```
┌─────────────────────────────────────────────┐
│  ヘッダー（全幅）                              │
├──────────────────┬──────────────────────────┤
│  参加者リスト      │  ルーレット (400px以上)   │
│  ・田中 👑        │                          │
│  ・山田           │     ╭─────────╮          │
│  ・佐藤           │     │ roulette│          │
│  ・鈴木           │     ╰─────────╯          │
│                  │                          │
│  金額設定         │  [🎯 運命を回す]          │
│  ──────────      │                          │
│  ¥30,000        │                          │
└──────────────────┴──────────────────────────┘
```

- 左カラム: 参加者リスト + 金額入力（固定幅 or flex-1）
- 右カラム: ルーレット + SPINボタン（flex-1）
- md未満（モバイル）: 現状のシングルカラムのまま

---

## Scope

- `app/room/[code]/play/_components/room-play-body.tsx` — md 以上で2カラムグリッドに切り替え
- `app/room/[code]/play/page.tsx` — wheelSize 計算に md ブレークポイントを考慮
- `app/room/[code]/play/_components/bill-input-section.tsx` — 左カラムに収まるように確認

---

## Root Cause Hypothesis

ISSUE-227 で max-width のみを広げたため、中身の配置は変わらなかった。
2カラム化はレイアウト構造の変更が必要で、ISSUE-227 のスコープ外とした。

---

## Proposed Fix

### room-play-body.tsx — グリッドレイアウト

```tsx
// 現在: flex flex-col で縦並び
// 変更後: md以上で2カラムグリッド

<div className="mx-auto max-w-[390px] md:max-w-[680px] min-h-dvh flex flex-col px-5 py-6 md:px-8">
  {/* ヘッダー（全幅）*/}
  <header className="...">

  {/* メインコンテンツ: md以上で2カラム */}
  <div className="flex-1 flex flex-col md:grid md:grid-cols-[1fr_auto] md:gap-8 md:items-start">

    {/* 左カラム: 参加者 + 金額 */}
    <div className="md:pt-2">
      {/* Participants section */}
      {/* BillInputSection */}
    </div>

    {/* 右カラム: ルーレット + SPIN */}
    <div className="flex flex-col items-center">
      {/* RouletteWheel */}
      {/* SpinControls */}
    </div>

  </div>
</div>
```

### page.tsx — wheelSize 計算の md 対応

```typescript
const update = () => {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const isMd = vw >= 768
  if (isMd) {
    // 2カラム時: 右カラム幅の約半分をルーレットに使える
    const rightColWidth = Math.min(340, (vw - 64) / 2)
    setWheelSize(Math.min(400, rightColWidth - 16))
  } else {
    const byWidth = Math.min(360, vw - 40)
    const byHeight = Math.min(360, vh - 440)
    setWheelSize(Math.max(200, Math.min(byWidth, byHeight)))
  }
}
```

---

## Acceptance Criteria

- [ ] md（768px）以上でルーレットと参加者リストが横並びになる
- [ ] ルーレットが md 以上で 380px 以上のサイズで表示される
- [ ] SPINボタンがスクロールなしで画面内に収まる
- [ ] モバイル（<768px）のレイアウトは ISSUE-227 実装後と同じ
- [ ] 参加者が 6 人以上の場合も2カラムが崩れない（左カラムのスクロール）
- [ ] `RoomPlayOverlays`（fixed positioning）に影響なし

## Priority
**P2**

## Impact
G-STACK-Kando +0.5、Kano +0.5、HEART-Happiness +0.5 → 総合 +1点

## Risk / Notes
- `min-h-dvh` と2カラム化の組み合わせで縦スクロールが発生しないか確認
- 参加者数が多い（8〜10人）場合、左カラムが右カラム（ルーレット）より長くなる場合がある → `md:items-start` で対応
- `BillInputSection` が closing/opening するときの高さ変動アニメーションが2カラムでも問題ないか確認
