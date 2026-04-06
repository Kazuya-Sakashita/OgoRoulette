# ISSUE-223: バグ修正(P0) — SPINボタン連打でAPIが二重呼び出しされる

## ステータス
✅ 完了 2026-04-07

## 優先度
**P0 / Critical** — 飲み会本番で連打すると2回スピンAPIが発行されルーム状態が破損する

## カテゴリ
Bug / UX / State / Reliability

## 対象スコア
G-STACK-Trigger: +1 / G-STACK-State: +1 / HEART-Task success: +1 → 総合 +1〜2点

---

## Summary

SPIN ボタンを素早く2回押すと `POST /api/rooms/[code]/spin` が2回発行される。
1回目のレスポンスが返る前に2回目のクリックが発生した場合、
`phase !== "waiting"` ガードが間に合わず二重送信が起きる可能性がある。
結果として、ルームが不正な状態（二重セッション作成）になりうる。

---

## Background

`use-spin.ts` の `handleSpin()`:

```typescript
const handleSpin = async () => {
  if (phase !== "waiting" || participants.length < 2) return  // L129
  // ...
  setPhase("preparing")  // L135: これより前に2回目のクリックが来ると通過する
  // ...
  await fetch(`/api/rooms/${code}/spin`, ...)  // L140: 非同期API呼び出し
}
```

`setPhase("preparing")` は React の非同期 state 更新のため、
クリックイベントが同一フレーム内に2回発生した場合、2回目も `phase === "waiting"` と判定されて通過する。

`phase` は `useState` であり、`handleSpin` が呼ばれた瞬間の閉包をキャプチャしている。
2回目のクリックが1回目の `setPhase("preparing")` より前に処理されると、両方とも通過する。

---

## Current Behavior

1. オーナーがSPINボタンを連打（または遅延タップ）
2. 2回の `handleSpin()` が `phase === "waiting"` で通過
3. `/api/spin` が2回呼び出される
4. サーバーが2つのセッションを作成 or エラーを返す
5. ルームが不安定な状態になる

---

## Expected Behavior

- SPINボタンを何回押しても API呼び出しは1回だけ
- 2回目以降のクリックは無視される
- ボタンは `disabled` またはローディング状態になり、視覚的にフィードバックを返す

---

## Scope

- `app/room/[code]/play/use-spin.ts` — `handleSpin()` に ref ガードを追加
- `app/room/[code]/play/_components/spin-controls.tsx` — ボタンの disabled 条件を強化

---

## Root Cause Hypothesis

`phase` state の更新が非同期であるため、同フレーム内の2回目のクリックが
`phase === "waiting"` 判定を通過してしまう。
`useRef` を使った同期フラグで防御する必要がある。

---

## Proposed Fix

```typescript
// use-spin.ts

const isSpinningRef = useRef(false)  // 追加: 同期フラグ

const handleSpin = async () => {
  if (phase !== "waiting" || participants.length < 2) return
  if (isSpinningRef.current) return  // 追加: ref で二重防止
  isSpinningRef.current = true       // 追加: 即時ロック

  // ... 既存処理 ...

  try {
    // ... API呼び出し ...
  } catch {
    // ...
  } finally {
    isSpinningRef.current = false    // 追加: エラー時も解除
  }
}
```

`spinScheduledRef` がすでに存在しているため、それを流用することも検討:

```typescript
const handleSpin = async () => {
  if (phase !== "waiting" || participants.length < 2) return
  if (spinScheduledRef.current) return  // spinScheduledRef を二重防止に活用
  spinScheduledRef.current = true       // API呼び出し前にセット
  // ...
}
```

---

## Acceptance Criteria

- [ ] SPINボタンを0.1秒以内に2回押しても API 呼び出しが1回になる
- [ ] ボタンが押された瞬間に `disabled` または視覚的ローディング状態になる
- [ ] エラー時（API失敗）にボタンが再び押せる状態に戻る
- [ ] 正常フロー（1回押し）に影響なし

## Priority
**P0** — 本番飲み会でルーム破壊が起きる。防御コストが低い（3行追加）のに対してリスクが高い。

## Impact
G-STACK-Trigger +1、G-STACK-State +1、信頼性向上

## Risk / Notes
- `spinScheduledRef.current` は `scheduleSpin()` 内でも使われているため、フラグのセット/リセットタイミングに注意
- 既存の `phase !== "waiting"` チェックとの整合性を確認すること
- `handleRespin()` にも同様の問題がある可能性があるため確認すること
