# ISSUE-218: バグ修正(P0) — WinnerCard X 押下で error boundary が発火する

## ステータス
✅ 完了 — 2026-04-06

## 優先度
**P0 / Critical** — ルーレット体験の最後で 100% 再現するクラッシュ

## カテゴリ
Bug / State / UX

## 対象スコア
技術: +2 / G-STACK信頼性: +2 / HEART-Task success: +2

---

## Summary

WinnerCard の X ボタンを押すと `winner!.name` が null アクセスで TypeError をスローし、
Next.js error boundary が発火して「ルームの読み込みに失敗しました」エラー画面が表示される。

---

## Background

`room-play-overlays.tsx` の WinnerCard は `showWinnerCard` state で表示制御している。
`showWinnerCard` は `winner` state の変化を監視する useEffect 経由でのみクリアされる（非同期）。

一方で WinnerCard の `onClose` は同期的に `setWinner(null)` を呼ぶ。
結果として「`showWinnerCard=true` かつ `winner=null`」が 1 レンダリングサイクル共存し、
`winner!.name` が TypeError を投げて error boundary を発火させる。

---

## Current Behavior

1. ルーレット停止 → WinnerCard 表示
2. WinnerCard の X ボタン（または演出完了後に表示される WinnerCard）を押す
3. 「ルームの読み込みに失敗しました」エラー画面が表示される（100% 再現）

---

## Expected Behavior

WinnerCard を閉じる → 何もエラーを出さず → ルーム待機画面（`phase = "waiting"`）に戻る

---

## Reproduction Steps

1. ルーム作成 → メンバー参加
2. スピン実行 → WinnerCard Phase A/B が表示される
3. WinnerCard 右上の X を押す
4. → 「ルームの読み込みに失敗しました」が表示される

---

## Root Cause

`app/room/[code]/play/_components/room-play-overlays.tsx` の WinnerCard レンダリング条件：

```tsx
// 問題のあるコード（L202）
{showWinnerCard && (
  <WinnerCard
    winner={winner!.name}       // ← winner=null 時に TypeError
    winnerIndex={winner!.index} // ← 同上
    onClose={() => { setWinner(null); setPhase("waiting"); resetRecording() }}
```

`onClose` で `setWinner(null)` が呼ばれた直後のレンダリング：
- `winner` = null（即時更新）
- `showWinnerCard` = true（useEffect がまだ実行されていない）

→ `showWinnerCard && (winner!.name)` で `null.name` → TypeError

---

## Proposed Fix

```tsx
// app/room/[code]/play/_components/room-play-overlays.tsx

// Before
{showWinnerCard && (
  <WinnerCard
    winner={winner!.name}
    winnerIndex={winner!.index}

// After
{showWinnerCard && winner && (
  <WinnerCard
    winner={winner.name}
    winnerIndex={winner.index}
```

変更量: 1行追加（条件に `winner &&`）+ `!` アサーション 2箇所削除。

---

## Acceptance Criteria

- [ ] WinnerCard の X ボタンを押してもエラー境界が発火しない
- [ ] 閉じた後にルーム待機画面（phase="waiting"）に正常遷移する
- [ ] ホスト・メンバー両方で確認
- [ ] `winner` が null の状態で `showWinnerCard` が true になっても TypeError が出ない
- [ ] PC Chrome + iPhone Safari で確認

## Priority
**P0** — ルーレット体験のクリティカルパスが壊れている。最優先で修正。

## Risk / Notes

- 修正は 1 行の条件追加のみ。デグレリスク極小。
- 本質的には `showWinnerCard` と `winner` の二重管理が問題（ISSUE-219 で追跡）。
- `winner!` 非 null アサーションが他箇所にあるか確認が必要。
