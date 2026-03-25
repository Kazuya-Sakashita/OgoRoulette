# [ISSUE-005] `spin-complete` API 失敗時に room.status が "IN_SESSION" のまま残り次のスピンが 409 エラーになる

## 🧩 概要

`handleSpinComplete` は `fetch('/api/rooms/[code]/spin-complete', ...)` を fire-and-forget（`.catch(() => {})`）で呼ぶ。この API 呼び出しが失敗した場合、`room.status` が DB 上で `"IN_SESSION"` のまま残る。次に SPIN を押すと spin API（`/api/rooms/[code]/spin`）が `{ error: "スピンが進行中です", status: 409 }` を返し、SPIN ボタンが disabled に戻る（`phase = "waiting"` にはなるが `spinError` が表示される）。また、ポーリングが `"IN_SESSION"` のルームを返し続けるため、メンバー側で意図しない spin 検知が繰り返される。

## 🚨 背景 / なぜ問題か

**問題のコード（`play/page.tsx:477-480`）:**

```tsx
fetch(`/api/rooms/${code}/spin-complete`, {
  method: "POST",
  headers: buildGuestAuthHeaders(),
}).catch(() => {})  // ← エラーを無視
```

**spin API のガード（`spin/route.ts:81-83`）:**

```tsx
if (room.status === "IN_SESSION") {
  return NextResponse.json({ error: "スピンが進行中です" }, { status: 409 })
}
```

**発生シナリオ:**
1. オーナーが SPIN → アニメーション完了 → `handleSpinComplete` が呼ばれる
2. `fetch('/spin-complete')` が失敗（ネットワークエラー・サーバーエラー）
3. DB の `room.status` は `"IN_SESSION"` のまま
4. 「もう一回！」→ `handleRespin` → SPIN を押す → 409 エラー
5. オーナーに「スピンが進行中です」というエラーが表示される
6. メンバー側ポーリングも `IN_SESSION` を検知し続け、`scheduleSpin` が繰り返し試みられる

**障害からの回復手段:**
- 現状、ユーザー側に自力回復の手段がない
- ページリロードしても `room.status = "IN_SESSION"` のまま
- 管理者が DB を直接修正するしかない

## 🎯 目的

`spin-complete` が失敗した場合に、ユーザーが自力でルームを回復できるようにする。また、`spin-complete` の呼び出しが確実に成功するよう retry 機構を設ける。

## 🔍 影響範囲

- **対象機能:** スピン完了フロー / ルームステータス管理
- **対象画面:** `/room/[code]/play`
- **対象コンポーネント:** `app/room/[code]/play/page.tsx`
  - `handleSpinComplete` 関数（`line:457`）
  - `handleRespin` 関数（`line:414`）
- **対象 API:** `/api/rooms/[code]/spin-complete`, `/api/rooms/[code]/reset`

## 🛠 修正方針

**方針1（優先）: retry 付きの spin-complete 呼び出し**

```tsx
const completeSpinWithRetry = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`/api/rooms/${code}/spin-complete`, {
        method: "POST",
        headers: buildGuestAuthHeaders(),
      })
      if (res.ok) return
      if (res.status === 409 || res.status === 404) return // すでに完了済み or ルームなし
    } catch {
      if (i === retries - 1) {
        console.error("[OgoRoulette] spin-complete failed after retries")
        // ユーザーに通知（toast）
        setSpinError("結果の保存に失敗しました。ページを再読み込みしてください")
      }
      await new Promise(r => setTimeout(r, 1000 * (i + 1))) // exponential backoff
    }
  }
}
```

**方針2: reset API が "IN_SESSION" ルームも受け付けるよう修正**

`/api/rooms/[code]/reset` は現在ステータスチェックなしで `status = "WAITING"` に更新する（`reset/route.ts:60-63`）。ただしスピン完了済みのセッション（`status = "SPINNING"`）が残った状態でリセットすると、セッションデータが不整合になる可能性があるため、`SPINNING` セッションを `CANCELLED` に更新する処理を追加する。

```tsx
// reset/route.ts
await prisma.$transaction([
  prisma.room.update({ where: { id: room.id }, data: { status: "WAITING" } }),
  prisma.rouletteSession.updateMany({
    where: { roomId: room.id, status: "SPINNING" },
    data: { status: "CANCELLED" },  // 未完了セッションはキャンセル扱い
  }),
])
```

## ⚠️ リスク / 副作用

- `SPINNING` セッションを `CANCELLED` にすることで、未完了データとして履歴に残る。適切なフィルタリングが必要
- retry 中に `setPhase("result")` に遷移しているため、ユーザーは WinnerCard を操作できる状態。retry の失敗通知が WinnerCard と重ならないよう注意

## ✅ 確認項目

- [ ] `spin-complete` が一時的に失敗した場合、retry で成功し room が COMPLETED になる
- [ ] retry が全て失敗した場合、ユーザーにエラーが通知される
- [ ] `handleRespin` 後に `room.status = "IN_SESSION"` の状態でも SPIN が押せる
- [ ] reset 後に `SPINNING` セッションが `CANCELLED` になる

## 🧪 テスト観点

**手動確認:**
1. `spin-complete` API をモックして 500 エラーを返す → retry が 3 回走ってエラー通知が表示されることを確認
2. retry 中に「もう一回！」を押した場合の挙動確認
3. `room.status = "IN_SESSION"` の状態で reset を呼ぶ → `WAITING` になり次のスピンが可能なことを確認

## 📌 受け入れ条件（Acceptance Criteria）

- [ ] `spin-complete` が失敗した場合、最大 3 回 retry される
- [ ] 全 retry 失敗時にユーザーに通知が表示される
- [ ] `room.status = "IN_SESSION"` のルームでも `handleRespin` → reset 後に SPIN が正常動作する
- [ ] reset 後に残った `SPINNING` セッションが `CANCELLED` になる

## 🏷 優先度

**High**（発生すると回復手段がない。頻度は低いが影響が大きい）

## 📅 実装順序

**5番目**

## 🔗 関連Issue

- [ISSUE-001] isOwner フリッカー（IN_SESSION 放置の別原因）
