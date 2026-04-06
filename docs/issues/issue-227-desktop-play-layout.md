# ISSUE-227: UX改善(P2) — デスクトップ/タブレットのplayページレイアウト最適化

## ステータス
✅ 完了 2026-04-07（max-width拡張のみ。2カラムレイアウトは効果測定後に検討）

## 優先度
**P2 / Medium** — PCオーナーが最もストレスを感じる画面。Clarity と Kando に影響

## カテゴリ
UX / Layout / Desktop / Responsive

## 対象スコア
G-STACK-Kando: +0.5 / G-STACK-Clarity: +0.5 / HEART-Happiness: +0.5 → 総合 +1点

---

## Summary

`/room/[code]/play` はモバイルファーストで設計されており、
デスクトップ（PCオーナーが最多利用）では `max-w-[390px]` のままで
大きな余白が左右に発生し、ルーレットホイールが小さく見える。
PCオーナーが操作する場面で「スピンボタンがはるか下にある」という問題もある。

---

## Background

### 現状のplayページレイアウト

```
<div className="min-h-dvh flex flex-col relative max-w-[390px] mx-auto">
  {/* ヘッダー */}
  {/* 参加者リスト */}
  {/* ルーレット: 200-360px（viewport依存） */}
  {/* 金額入力 */}
  {/* SPINコントロール */}
</div>
```

- `max-w-[390px]` が全体に適用されており、1440px幅モニターでも390px幅で表示
- `lg:` ブレークポイントでホイールサイズは上がるが、レイアウト構造は変わらない
- PCでは左右に大量の余白が発生し、ルーレットが「窓の中の小さな輪」に見える
- SPINボタンがスクロール先にある（モバイル設計の副作用）

### デスクトップ利用シナリオ

飲み会の幹事（オーナー）がノートPCで操作し、画面をスマホメンバーに見せながら使う場合がある。
この場合、ルーレットが大きく表示されるほど場の盛り上がりが増す。

---

## Current Behavior

- デスクトップで `/room/[code]/play` を開くと中央に390px幅のカラムが表示
- ルーレットは最大360px程度
- SPINボタンはルーレットの下にあり、スクロールが必要な場合がある
- 左右の余白は真っ暗（背景グラデーションのみ）

---

## Expected Behavior

### デスクトップ（768px以上）での改善

- `md:max-w-[600px]` または `md:max-w-[700px]` にmax-widthを拡大
- ルーレットサイズを md ブレークポイントで拡大（現在 `lg:` のみ）
- SPINボタンをルーレット横または下部固定に配置（スクロール不要）
- 左右余白にグラデーション装飾（単純な黒ではなく背景のテーマカラーを活用）

### レイアウト案（2カラム、md以上）

```
┌─────────────────────────────────────────┐
│                ヘッダー                  │
├────────────────────┬────────────────────┤
│  参加者リスト      │   ルーレット(大)    │
│  ・田中            │     〇〇〇〇〇      │
│  ・山田            │   SPIN ボタン       │
│  金額設定          │                     │
└────────────────────┴────────────────────┘
```

---

## Scope

- `app/room/[code]/play/page.tsx` — max-width をレスポンシブ対応に変更
- `app/room/[code]/play/_components/room-play-body.tsx` — md ブレークポイントで2カラムレイアウト切り替え
- `components/roulette-wheel.tsx` (参照) — wheel サイズの上限を md で拡大

---

## Root Cause Hypothesis

アプリがモバイルファーストで設計されたため、デスクトップ最適化が後回しになった。
ランディングページ (`/`) は2カラムデスクトップレイアウトを持つが、
コアのplay画面はモバイル幅のままになっている。

---

## Proposed Fix

```tsx
// page.tsx のラッパー
<div className="min-h-dvh flex flex-col relative max-w-[390px] md:max-w-[680px] mx-auto px-4 md:px-8">

// room-play-body.tsx — md以上で2カラム
<div className="md:grid md:grid-cols-[1fr_auto] md:gap-8 md:items-start">
  <div> {/* 左: 参加者リスト + 金額 */} </div>
  <div> {/* 右: ルーレット + SPINボタン */} </div>
</div>
```

---

## Acceptance Criteria

- [ ] md（768px）以上でmax-widthが390px → 680px以上に拡大する
- [ ] ルーレットホイールが md 以上で 400px 以上のサイズで表示される
- [ ] SPINボタンがスクロールなしで画面内に収まる（md以上）
- [ ] モバイル（<768px）のレイアウトは変更なし
- [ ] PC Chromeで確認: 1280px幅でルーレットが画面の半分以上を占める

## Priority
**P2**

## Impact
G-STACK-Kando +0.5、G-STACK-Clarity +0.5、HEART-Happiness +0.5 → 総合 +1点

## Risk / Notes
- `min-h-dvh` とスクロール動作の整合性に注意（2カラム化すると縦スクロールが不要になる場合がある）
- `RoomPlayOverlays`（fixed positioning）は max-width に関係なく全画面に表示されるため問題なし
- 参加者リストが長い場合（6〜10人）の2カラムレイアウトの見た目を確認すること
