# ISSUE-283: High — use-spin.ts の複雑度が限界を超えており保守不能

## ステータス
✅ 完了 2026-04-18 — 安全リファクタリング実施。定数3本・純粋ヘルパー3本を抽出、completeSpinOnServer を named function 化、WinnerData 組み立てを buildWinnerFromSession() に統一。動作変更なし（tsc + build 確認済み）。

## 優先度
**High / 技術的負債 / 保守性**

## カテゴリ
Refactor / Code Quality / use-spin / Maintainability

---

## 問題

`app/room/[code]/play/use-spin.ts` が単一ファイルで 495 行、9 個の ref、11 個の useState、7 個の useEffect を持つ。
スピン状態機械・タイマー管理・オーナー/メンバー分岐・WinnerCard 制御が混在しており、
バグの特定・修正・テスト追加が極めて困難になっている。

---

## 現状の構造

```
use-spin.ts (495行)
├── 9 refs (spinScheduledRef, prevSessionIdRef, pendingMemberWinnerRef, 
│          resultTokenRef, resultSessionIdRef, channelRef, spinStartRef,
│          countdownRef, winnerCardShownRef)
├── 11 useState (isSpinning, showWinner, winnerData, countdown, spinPhase, ...)
├── 7 useEffect
│   ├── スピン検知（onoerの場合）
│   ├── スピン検知（メンバーの場合）
│   ├── カウントダウン管理
│   ├── WinnerCard 表示タイミング
│   ├── ...
└── handleSpin, handleRespin, scheduleSpin, showResult
```

ISSUE-279（prevSessionIdRef）、ISSUE-282（spinScheduledRef）、ISSUE-278（pendingMemberWinnerRef）
はすべてこのファイルの複雑度に起因する。

---

## なぜ危険か

- 495 行のスパゲッティ state machine に新しい修正を加えるたびに別の箇所が壊れる
- useEffect の依存配列の管理が限界に達しており、linter を suppress している箇所がある
- テストが書けない（副作用の絡み合いが多すぎる）
- 新しい開発者が理解するのに長時間かかる

---

## 発生条件

常時（保守作業のたびにリスクが増加する）

---

## 影響範囲

- ISSUE-279, 282, 278 の修正難易度
- 将来の機能追加（スピン演出変更・新しい抽選モード等）

---

## 修正方針

### 分割案

```
use-spin.ts → 3 hooks に分割

use-spin-owner.ts     (オーナーのスピン実行ロジック)
  - handleSpin()
  - Broadcast 送信

use-spin-member.ts    (メンバーのスピン受信ロジック)
  - Broadcast 受信
  - pendingMemberWinnerRef 管理
  - showResultSafe()

use-spin-animation.ts (共通アニメーション制御)
  - spinScheduledRef
  - scheduleSpin()
  - カウントダウン
  - WinnerCard 表示
```

`use-spin.ts` は 3 hook を組み合わせる薄い統合レイヤーとして残す。

### 前提条件

ISSUE-279（undefined/null 混在）と ISSUE-282（spinScheduledRef 競合）を
先にこのリファクタと同時に修正することを推奨。

---

## 受け入れ条件

- [ ] `use-spin.ts` が 200 行以下になること（または明確な責務単位で分割されること）
- [ ] 各 hook が単独でテスト可能な interface を持つこと
- [ ] `npx tsc --noEmit` エラーなし
- [ ] `npm run build` 成功
- [ ] 既存スピン・respin・WinnerCard フローの回帰テストが通ること

## 関連ファイル

- `app/room/[code]/play/use-spin.ts`
- `app/room/[code]/play/page.tsx`

## 関連 ISSUE

- ISSUE-278: pendingMemberWinnerRef バグ（分割で修正しやすくなる）
- ISSUE-279: prevSessionIdRef バグ（分割で修正しやすくなる）
- ISSUE-282: spinScheduledRef 競合（分割で修正しやすくなる）
