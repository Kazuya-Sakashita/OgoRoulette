# IN_SESSION 実装：オーナーとメンバーの状態分離

## 導入

OgoRoulette のデータベースには `RoomStatus` という enum があり、
`WAITING | IN_SESSION | COMPLETED | EXPIRED` の4つの状態が定義されていた。

しかし `IN_SESSION` は長らく **未使用** だった。
定義はあるが、誰も使っていない状態。
これを実装することで、メンバーにスピン中の視覚フィードバックを与えられると判断した。

---

## 問題

### メンバーはオーナーがスピンしていることを知れなかった

実装前の状態：

```
オーナー: SPIN ボタンを押す → ホイールが回る → 結果が出る
メンバー: ずっと「オーナーの回転を待っています...」が表示される
         （いつスピンが始まったか分からない）
```

メンバーは3秒ごとのポーリングで `COMPLETED` を検知するまで、
何も変化しない待機画面を見続けていた。

また「オーナーだけがスピンできる」という仕様はコードのコメントにあったが、
API レベルでの検証がなかった。URL を知っていれば誰でも POST できる状態だった。

---

## 解決方法

### 全体設計

```
オーナー: SPIN → IN_SESSION（POST /api/rooms/:code/spin-start）
               → ホイールアニメーション
               → COMPLETED（POST /api/sessions）

メンバー: ポーリングで IN_SESSION を検知 → 「スピン中！」表示
         ポーリングで COMPLETED を検知 → ローカルでホイールアニメーション
         → handleSpinComplete → サーバーの結果を表示
```

### 1. 純粋関数でロジックを分離（lib/room-spin.ts）

ステータス遷移ロジックをコンポーネントから切り出した。

```ts
// WAITING 状態からのみスピン開始できる（多重実行防止）
export function canStartSpin(roomStatus: string): boolean {
  return roomStatus === "WAITING"
}

// メンバー用：スピン中かどうか
export function isSpinInProgress(roomStatus: string): boolean {
  return roomStatus === "IN_SESSION"
}

export type MemberSpinAction = "trigger-spin" | "show-winner" | "noop"

// メンバーがポーリング結果を受け取ったとき何をすべきか
export function determineMemberSpinAction(
  isOwner: boolean,
  roomStatus: string,
  newSessionId: string | null,
  prevSessionId: string | null | undefined,  // undefined = 初回ロード
  hasWinner: boolean
): MemberSpinAction {
  if (isOwner) return "noop"

  // 初回ロード
  if (prevSessionId === undefined) {
    if (roomStatus === "COMPLETED" && newSessionId) return "show-winner"
    return "noop"
  }

  // 新しいセッション検知 かつ まだ表示していない
  if (newSessionId && newSessionId !== prevSessionId && !hasWinner) {
    return "trigger-spin"
  }

  return "noop"
}
```

この設計の利点：
- 状態遷移ロジックが純粋関数 → ユニットテストが書ける
- `play/page.tsx` と `spin-start/route.ts` の両方から使える
- 「何をすべきか」が `"trigger-spin" | "show-winner" | "noop"` の3値で明確

### 2. API エンドポイント（POST /api/rooms/:code/spin-start）

```ts
// WAITING → IN_SESSION に遷移する
export async function POST(_request, { params }) {
  const room = await prisma.room.findUnique({ ... })

  // WAITING 以外からは遷移できない（多重実行防止）
  if (!canStartSpin(room.status)) {
    return NextResponse.json({ error: "Room is not in WAITING state" }, { status: 409 })
  }

  // 認証ユーザーはオーナー検証必須
  if (user) {
    const ownerMembership = await prisma.roomMember.findFirst({
      where: { roomId: room.id, isHost: true, profileId: user.id },
    })
    if (!ownerMembership) {
      return NextResponse.json({ error: "Only the room owner can start a spin" }, { status: 403 })
    }
  }

  await prisma.room.update({ data: { status: "IN_SESSION" } })
  return NextResponse.json({ status: "IN_SESSION" })
}
```

### 3. オーナー側：SPIN ボタンで spin-start を fire-and-forget

```ts
const handleSpin = () => {
  if (!isSpinning && !isCompleted && isOwner && participants.length >= 2) {
    const idx = Math.floor(Math.random() * participants.length)
    setPendingWinnerIndex(idx)
    setIsSpinning(true)
    setWinner(null)

    // メンバーに IN_SESSION を知らせる（non-critical）
    fetch(`/api/rooms/${code}/spin-start`, { method: "POST" }).catch(() => {})
  }
}
```

fire-and-forget にした理由：
- この API が失敗してもオーナーのスピン体験は壊れない
- メンバーは IN_SESSION を見逃しても COMPLETED で最終的に結果を受け取れる

### 4. メンバー側：セッション検知を状態機械で管理

```ts
useEffect(() => {
  if (!room) return

  const latestSession = room.sessions?.[0]
  const latestId = latestSession?.id ?? null

  const action = determineMemberSpinAction(
    isOwner,
    room.status,
    latestId,
    prevSessionIdRef.current,
    !!winner
  )

  // baseline を常に更新
  prevSessionIdRef.current = latestId

  if (action === "show-winner") {
    // リロード時：アニメーションなしで結果を表示
    const winnerParticipant = latestSession?.participants?.find((p) => p.isWinner)
    if (winnerParticipant) {
      setWinner({ name: winnerParticipant.name, index: winnerParticipant.orderIndex, ... })
    }
    return
  }

  if (action === "trigger-spin") {
    // 新セッション検知：サーバーの当選者を ref に保存してからアニメーション開始
    const winnerParticipant = latestSession?.participants?.find((p) => p.isWinner)
    if (winnerParticipant) {
      pendingMemberWinnerRef.current = { name: ..., index: ..., ... }
      setPendingWinnerIndex(winnerParticipant.orderIndex)
      setIsSpinning(true)  // ローカルアニメーション開始
    }
  }
}, [room, isOwner])
```

### 5. セッション保存はオーナーだけが行う

```ts
const handleSpinComplete = (winnerName: string, winnerIndex: number) => {
  setIsSpinning(false)
  setPendingWinnerIndex(undefined)

  if (isOwner) {
    // オーナー：自分の spin 結果が正しい → 保存 + 表示
    setWinner({ ... })
    fetch("/api/sessions", { method: "POST", body: JSON.stringify({ ... }) })
  } else {
    // メンバー：サーバー確定の当選者を ref から取り出して表示
    const serverWinner = pendingMemberWinnerRef.current
    if (serverWinner) {
      setWinner(serverWinner)
      pendingMemberWinnerRef.current = null
    }
  }
}
```

メンバーが `POST /api/sessions` を呼ばない理由：
- 正しい当選者はオーナーだけが知っている（サーバーに保存されたもの）
- メンバーのローカルアニメーションは「演出」であり、結果はサーバーから取得する
- セッション保存が二重になることを防ぐ

### 6. メンバーの待機 UI に IN_SESSION を反映

```tsx
// WAITING 時
<div className="border-white/10 ...">
  <div className="bg-primary animate-pulse" />
  <p>オーナーの回転を待っています...</p>
</div>

// IN_SESSION 時
<div className="border-primary/40 ...">
  <div className="bg-green-400 animate-ping" />  {/* より激しいアニメーション */}
  <p>スピン中！</p>
</div>
```

---

## テスト

純粋関数として切り出したことで、ユニットテストが書けた。

```ts
describe('determineMemberSpinAction', () => {
  test('オーナーは常に noop', () => {
    expect(determineMemberSpinAction(true, 'COMPLETED', 'sess-1', null, false)).toBe('noop')
  })

  test('初回ロードで COMPLETED かつセッションあり → show-winner', () => {
    expect(determineMemberSpinAction(false, 'COMPLETED', 'sess-1', undefined, false)).toBe('show-winner')
  })

  test('新しいセッションIDが来た → trigger-spin', () => {
    expect(determineMemberSpinAction(false, 'COMPLETED', 'sess-2', 'sess-1', false)).toBe('trigger-spin')
  })
})
```

12ケースのテストが全て通った。

---

## 学び

### 1. 未使用の enum 値には意図がある

`IN_SESSION` は最初から設計に入っていた。
「スピン中」という状態を DB レベルで表現できるように enum に含まれていた。
未使用でも削除しないことで、後から実装できた。

### 2. ポーリングで「完全な同期」は不要

3秒ポーリングで IN_SESSION をリアルタイムに通知することはできない。
しかしそれでも良い。

- IN_SESSION は「今スピン中」という視覚フィードバック
- COMPLETED で最終結果が確定
- メンバーはローカルアニメーションで「スピンしている感」を体験できる

完璧な同期を目指さず、「UX として十分な体験」を設計した。

### 3. owner / member の責務を分ける

オーナーとメンバーで同じ `handleSpinComplete` を呼ぶが、中身が違う：
- オーナー：自分が決めた結果を保存する
- メンバー：サーバーが確定した結果を受け取って表示する

この責務分離を明確にしたことで、コードの意図が読みやすくなった。

### 4. ref を使って「スピン前確定」パターンを実装する

メンバーのアニメーションは、サーバーの当選者を先に ref に保存してから開始する。
こうすることで、アニメーション中に余計な state 更新を起こさず、
`handleSpinComplete` で ref から取り出して表示できる。

```ts
// サーバーの当選者を先に保存
pendingMemberWinnerRef.current = { name: ..., index: ... }

// アニメーション開始（完了時に ref から取り出す）
setPendingWinnerIndex(winnerParticipant.orderIndex)
setIsSpinning(true)
```

---

## まとめ

| 実装 | 効果 |
|------|------|
| `POST /spin-start` → `IN_SESSION` | API レベルでオーナー検証、多重実行防止 |
| `determineMemberSpinAction` 純粋関数 | テスト可能、意図が明確 |
| メンバーのローカルアニメーション | ポーリング遅延をごまかして UX を改善 |
| `pendingMemberWinnerRef` パターン | アニメーション中の state 競合を防止 |

`IN_SESSION` 実装の本質は「状態の責務分離」。
オーナーとメンバーが同じ画面を見ているように見えて、
実はまったく別のロジックで動いている。
