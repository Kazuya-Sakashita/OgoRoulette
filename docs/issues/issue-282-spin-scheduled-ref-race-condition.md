# ISSUE-282: High — spinScheduledRef の競合条件でアニメーションが二重起動する

## ステータス
✅ 修正済み（2026-04-18）— spinScheduledRef を boolean から string | null（session ID）に変更

## 優先度
**High / バグ / Race Condition**

## カテゴリ
Bug / Race Condition / use-spin / Animation

---

## 問題

`spinScheduledRef` は scheduleSpin() の二重呼び出しを防ぐためのフラグだが、
フラグのセットと `setTimeout` の登録の間に非同期ギャップがある。

```typescript
// app/room/[code]/play/use-spin.ts（推定構造）
function scheduleSpin(delayMs: number) {
  if (spinScheduledRef.current) return  // ← チェック
  spinScheduledRef.current = true        // ← セット
  setTimeout(() => {
    spinScheduledRef.current = false
    // アニメーション開始...
  }, delayMs)
}
```

問題: `scheduleSpin()` が同期的に 2 回呼ばれた場合：
- 1 回目: `spinScheduledRef.current = false` → チェック通過 → true に設定 → setTimeout 登録
- 2 回目: `spinScheduledRef.current = true` → return（正常）

一見安全に見えるが、React の batching や useEffect の実行タイミングによっては
2 回目の呼び出しがチェック前に割り込む可能性がある（JS はシングルスレッドだが
useEffect の cleanup + 再実行サイクルで同じ条件が複数回評価される）。

---

## なぜ危険か

- スピンアニメーションが 2 回起動するとルーレットが止まらない / WinnerCard が 2 回表示される
- `setTimeout` が 2 個登録されると `delayMs` 後に WinnerCard が 2 回出る
- ユーザーには「バグった」「壊れた」と見える

---

## 発生条件

- `scheduleSpin()` が短時間に 2 回呼ばれる場合
  - Broadcast 受信 + polling の両方がほぼ同時に fetchRoom() を完了した場合（ISSUE-286）
  - ISSUE-279 の prevSessionIdRef ガード漏れが先に発生した場合

---

## 影響範囲

- メンバー画面でのスピンアニメーション開始タイミング
- respin 後の最初のスピン

---

## 推定原因

`spinScheduledRef` は Ref（ミュータブル）なため React の render サイクルとは独立して動作する。
単一の JS スレッドであればアトミックに見えるが、
useEffect の依存配列評価 → cleanup → 再実行のサイクルで複数回評価され得る。

---

## 修正方針

### 案A: scheduleSpin() を idempotent にする（推奨）

```typescript
function scheduleSpin(delayMs: number, sessionId: string) {
  // sessionId ベースで重複チェック（フラグより堅牢）
  if (spinScheduledRef.current === sessionId) return
  spinScheduledRef.current = sessionId
  setTimeout(() => {
    if (spinScheduledRef.current !== sessionId) return  // キャンセル済み
    // アニメーション開始
  }, delayMs)
}
```

フラグ（boolean）をセッション ID に変更することで、同じスピンの二重登録を防ぐ。

### 案B: useEffect の依存配列を見直して scheduleSpin の呼び出し回数を減らす

根本原因（ISSUE-286 二重発火）を先に解決する。

---

## 受け入れ条件

- [ ] 同一スピンで scheduleSpin() が 2 回呼ばれてもアニメーションが 1 回だけ起動すること
- [ ] respin → スピン の連続動作で WinnerCard が 2 回表示されないこと
- [ ] `npx tsc --noEmit` エラーなし

## 関連ファイル

- `app/room/[code]/play/use-spin.ts` (spinScheduledRef 使用箇所)

## 関連 ISSUE

- ISSUE-279: prevSessionIdRef undefined/null 混在（先行ガード漏れ）
- ISSUE-286: polling + Realtime 二重発火（二重呼び出しの原因）
