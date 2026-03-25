# [ISSUE-002] `spinScheduledRef` 競合により `setPhase("spinning")` がブロックされ phase が "preparing" で永続停止

## 🧩 概要

ISSUE-001 の `isOwner` フリッカーが発生した際、メンバー用エフェクトの `scheduleSpin()` が `spinScheduledRef.current = true` をセットする。その後 `isOwner = true` になってもオーナーは `phase !== "waiting"` のため SPIN を押せない。やがて `scheduleSpin` 内の `setTimeout` が発火して `setPhase("spinning")` が呼ばれるが、delay の計算によっては長時間（数十秒〜数分）`phase = "preparing"` で止まる。

## 🚨 背景 / なぜ問題か

`scheduleSpin()` の実装（`play/page.tsx:291-312`）:

```tsx
const scheduleSpin = (session: Session) => {
  if (spinScheduledRef.current) return  // ← すでに true なら何もしない
  // ...
  spinScheduledRef.current = true       // ← true をセット
  setPhase("preparing")
  setTimeout(() => setPhase("spinning"), delay)
}
```

- ISSUE-001 のフリッカーで `scheduleSpin` が呼ばれると `spinScheduledRef.current = true` になる
- `isOwner = true` になっても `phase = "preparing"` なので SPIN ボタンは押せない
- `handleSpin` を呼ぶ手段がないため、`spinScheduledRef.current` を `false` にリセットする手段がない
- `delay = Math.max(0, startedAt - Date.now())` — 古いセッションの `startedAt` が過去ならば `delay = 0` で即座に `"spinning"` へ遷移するが、タイミングによっては数秒〜数十秒待つ

**本 Issue は ISSUE-001 の直接的な副作用。** ISSUE-001 が修正されれば `isOwner` フリッカー自体が起きないため、本 Issue も同時解消される。

ただし ISSUE-001 と独立した形でも発生する可能性がある:
- `isOwner` の再計算タイミングと React の batch 更新タイミングの競合
- 将来的な機能追加で同様のパターンが再現するリスク

## 🎯 目的

`spinScheduledRef.current = true` が誤ってセットされた場合でも、オーナーが SPIN を押したときに確実にリセットされ、正常なフローで `setPhase("spinning")` が呼ばれるようにする。

## 🔍 影響範囲

- **対象機能:** SPIN 開始フロー / フェーズ遷移
- **対象画面:** `/room/[code]/play`
- **対象コンポーネント:** `app/room/[code]/play/page.tsx`
  - `scheduleSpin` 関数（`line:291`）
  - `handleSpin` 関数（`line:368`）
  - メンバー用スピン検知 useEffect（`line:283`）

## 🛠 修正方針

ISSUE-001（`isGuestHostResolved` の loading guard 追加）を先に対応することで根本原因を解消する。本 Issue はその補完的な修正。

**追加の防衛的修正として:**

`handleSpin` が呼ばれたとき（`phase === "waiting"` の確認後）、`spinScheduledRef.current` が誤って `true` になっていても問題なく動作するよう、`spinScheduledRef.current = false` の reset が既にある（`line:378`）ことを利用し、処理を進める。

ただし現状は `phase !== "waiting"` のときに `handleSpin` 自体が早期 return するため、`spinScheduledRef` が残ったままになる。

**防衛的修正案: phase="preparing" の際に「スタック検知 → waiting に戻す」ボタンまたは自動タイムアウトを追加する（ISSUE-003 として分離）。**

本 Issue では ISSUE-001 の修正が完了した後、以下の assertion test を追加する:

```tsx
// 手動テスト確認コメントの追加
// play/page.tsx handleSpin 先頭
console.assert(
  spinScheduledRef.current === false,
  "[OgoRoulette] spinScheduledRef was true when handleSpin started — possible race condition"
)
```

## ⚠️ リスク / 副作用

- ISSUE-001 を修正すれば本 Issue の根本原因は解消される。独立した修正は不要な場合もある
- `spinScheduledRef` を強制 reset すると、メンバー側の同期スピンとの競合が起きる可能性がある（オーナー専用フローなので問題ないが注意）

## ✅ 確認項目

- [ ] ISSUE-001 修正後、`isOwner` フリッカーが発生しないこと
- [ ] フリッカーが発生した場合でも `phase = "preparing"` で永続停止しないこと（ISSUE-003 のタイムアウトで回収）
- [ ] `handleSpin` が `phase === "waiting"` で呼ばれたとき `spinScheduledRef.current` が必ず `false` になること

## 🧪 テスト観点

**手動確認:**
1. ISSUE-001 の再現手順を実施 → `phase` が "preparing" で止まらないことを確認
2. 通常のゲストホストフロー（リロードなし）で SPIN が正常に動作することを確認

## 📌 受け入れ条件（Acceptance Criteria）

- [ ] ISSUE-001 修正後に本 Issue の再現シナリオが発生しない
- [ ] `phase = "preparing"` で 10 秒以上停止するケースがない（ISSUE-003 と組み合わせ）
- [ ] `spinScheduledRef.current` の状態が `handleSpin` 開始時に必ず `false` である

## 🏷 優先度

**Critical**（ISSUE-001 の副作用として同時発生）

## 📅 実装順序

**2番目**（ISSUE-001 と同時対応。ISSUE-001 の修正で基本解消される）

## 🔗 関連Issue

- [ISSUE-001] ゲストホストの `isOwner` フリッカー（根本原因）
- [ISSUE-003] phase="spinning" タイムアウト安全網（補完的対策）
- [ISSUE-004] clock skew による delay 上限なし
