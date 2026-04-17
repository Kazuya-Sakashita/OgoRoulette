# ISSUE-278: Critical — メンバーリロード時に前回当選者が表示されるリスク

## ステータス
🔲 TODO

## 優先度
**Critical / データ整合性 / UX**

## カテゴリ
Bug / State Management / Realtime / use-spin

---

## 問題

メンバー画面でスピン中にページをリロードすると、`pendingMemberWinnerRef` が null のまま `showResult(room)` にフォールバックし、`sessions[0]`（最新のセッション）の当選者をそのまま表示する。

```typescript
// app/room/[code]/play/use-spin.ts:313-326
const winner = pendingMemberWinnerRef.current ?? showResult(room)
//              ↑ Broadcast を受信できなかった場合
//                sessions[0] を信頼して表示する — セッションIDの照合なし
```

`showResult(room)` は `sessions[0].winnerIndex` を使うだけで、現在のスピンと同じセッションかを検証しない。

---

## なぜ危険か

- リロード直後にオーナーがスピンを開始すると、前回スピンのセッションが `sessions[0]` に残っている可能性がある
- Broadcast を受信できなかったメンバーは古い当選者名で WinnerCard を表示する
- ユーザーは「間違った人が奢りになった」と誤認する（UX 上の重大バグ）
- シェアされた結果も誤りになるため、ISSUE-276 の HMAC トークンによる信頼性と矛盾する

---

## 発生条件

1. メンバーがスピン中（アニメーション中）にページをリロード
2. Supabase Realtime の Broadcast が届かない（ネットワーク不安定）
3. `pendingMemberWinnerRef.current` が null のまま showResult() が呼ばれる

---

## 影響範囲

- メンバー（非オーナー）全員
- スマートフォンでのページリロード・バックグラウンド復帰時
- 特にモバイルネットワーク環境（Realtime が切断されやすい）

---

## 推定原因

`pendingMemberWinnerRef.current` は Broadcast で受信した当選者情報を保持する。
Broadcast を受信できなかった場合のフォールバックが `sessions[0]` の盲目的な信頼になっている。
セッション ID を照合してから表示する設計になっていない。

---

## 修正方針

### 案A: showResult() でセッション ID を照合する（推奨）

```typescript
// fetchRoom() で取得した room.sessions[0].id と
// スピン開始時に受け取った currentSpinSessionId を照合する
function showResultSafe(room: Room, expectedSessionId: string | null) {
  const latest = room.sessions[0]
  if (expectedSessionId && latest?.id !== expectedSessionId) {
    // セッション不一致 → 表示しない / 再フェッチを促す
    return null
  }
  return latest
}
```

### 案B: Broadcast を受信できなかった場合は当選者表示をスキップ

フォールバック表示をせず、「リロードが必要です」メッセージを表示する。

---

## 受け入れ条件

- [ ] メンバーリロード後に前回のスピン結果が表示されないこと
- [ ] `showResult()` がセッション ID を照合してから表示すること
- [ ] Broadcast 未受信の場合は安全なフォールバック（非表示 or 再フェッチ）になること
- [ ] オーナー側の表示は変更なし

## 関連ファイル

- `app/room/[code]/play/use-spin.ts` (lines 313-326)
