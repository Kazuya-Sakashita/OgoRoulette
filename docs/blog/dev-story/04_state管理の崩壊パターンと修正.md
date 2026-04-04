# state管理の崩壊パターンと修正

## OgoRouletteのstate管理は「思ったより複雑だった」

シンプルに見えるルーレットアプリだが、プレイ画面のstateは実はこれだけある：

```tsx
// 基本
const [room, setRoom] = useState<Room | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const [currentUser, setCurrentUser] = useState<User | null>(null)

// ルーレット
const [isSpinning, setIsSpinning] = useState(false)
const [pendingWinnerIndex, setPendingWinnerIndex] = useState<number | undefined>(undefined)
const [winner, setWinner] = useState<{ ... } | null>(null)
const [showConfetti, setShowConfetti] = useState(false)

// 金額入力
const [showBillInput, setShowBillInput] = useState(false)
const [totalBill, setTotalBill] = useState(0)
const [treatAmount, setTreatAmount] = useState(0)

// ゲストホスト
const [isGuestHost, setIsGuestHost] = useState(false)
```

さらにRefが2本：

```tsx
const prevSessionIdRef = useRef<string | null | undefined>(undefined)
const isCompletedRef = useRef(false)
```

多い。どこかで崩壊する。

---

## 崩壊パターン1：ポーリングによる不要な再レンダリング

最初の実装：

```tsx
useEffect(() => {
  fetchRoom()
  const interval = setInterval(() => {
    fetchRoom()  // 3秒ごとに呼ぶ
  }, 3000)
  return () => clearInterval(interval)
}, [code])
```

`fetchRoom` の中では `setRoom(data)` を呼んでいた。
`data` は毎回新しいオブジェクトなのでReactは毎回再レンダリングする。

**影響**：
- QRコード画像が3秒ごとに再リクエストされる
- `participants` の useMemo が毎回再計算される
- ルーレットホイールの再マウントが起きる可能性

**修正**：変化がなければstateを更新しない

```tsx
setRoom(prev => {
  if (
    prev &&
    prev.status === data.status &&
    prev._count.members === data._count.members &&
    (prev.sessions?.length ?? 0) === (data.sessions?.length ?? 0)
  ) return prev  // 変化なし → 同じrefを返す → Reactは再レンダリングしない
  return data
})
```

`prev` を返せばReactは「変化なし」と判断する。これで安定した。

---

## 崩壊パターン2：participantsの無限再計算

`participants`（参加者名の配列）は `room.members` から派生する。

```tsx
// NG: ポーリングのたびに新しい配列が生成される
const participants = room?.members.map(getMemberName) ?? []
```

これを `RouletteWheel` に渡すと、3秒ごとに `participants` の参照が変わり、
ホイールコンポーネントに変化として認識される可能性があった。

**修正**：文字列キーで useMemo をキャッシュ

```tsx
const membersKey = room?.members.map(getMemberName).join("\0") ?? ""
const participants = useMemo(
  () => (membersKey ? membersKey.split("\0") : []),
  [membersKey]  // 文字列の同一性で変化を判定
)
```

`"\0"` を区切り文字にしたのは名前に含まれにくいから。
名前が変わらない限り `participants` の参照は変わらない。

---

## 崩壊パターン3：prevSessionIdRefの初期化タイミング

非ホストへの「新しい結果が来た」通知は `prevSessionIdRef` で追跡していた。

最初は `useRef(null)` で初期化した。

問題：
- COMPLETEDルームにアクセスすると、最初から `sessions[0]` が存在する
- `prevSessionIdRef.current === null` → `latestId !== null` に変化
- → 「新しいセッション来た！」と誤判定
- → ページロード直後にWinnerCardが不意打ちで出る

**修正**：初期値を `undefined`（「まだ確認していない」状態）にする

```tsx
const prevSessionIdRef = useRef<string | null | undefined>(undefined)

useEffect(() => {
  const latestId = room.sessions?.[0]?.id ?? null

  // 初回: undefined → セッションIDを記録するだけ
  if (prevSessionIdRef.current === undefined) {
    prevSessionIdRef.current = latestId
    // COMPLETED部屋への再訪問 → 静かにWinnerCardを表示（confettiなし）
    if (room.status === "COMPLETED" && latestSession) { ... }
    return
  }

  // 2回目以降: 新しいIDが来たら通知
  if (!isHost && latestId && latestId !== prevSessionIdRef.current && !winner) {
    prevSessionIdRef.current = latestId
    // WinnerCard + confetti 表示
  }
}, [room, isHost])
```

`undefined` / `null` / `sessionId` の3状態で「初回」「セッションなし」「セッションあり」を表現した。

---

## 崩壊パターン4：setInterval内のstale closure

```tsx
const isCompleted = room?.status === "COMPLETED"  // state（レンダリング用）
isCompletedRef.current = !!isCompleted             // Ref（setInterval用）
```

なぜRefが必要か。

`setInterval` のコールバックは「作成時点の値」を閉じ込める（stale closure）。

```tsx
// NG: isCompletedはいつまでも初期値 false のまま
const interval = setInterval(() => {
  if (!isCompleted) fetchRoom()  // stale closure: 常にfalse
}, 3000)
```

```tsx
// OK: Refは常に最新値を参照できる
isCompletedRef.current = !!isCompleted  // レンダリングのたびに更新

const interval = setInterval(() => {
  if (!isCompletedRef.current) fetchRoom()  // 最新値を参照
}, 3000)
```

stale closureはReactを使い始めた人がよくハマる罠。
Refでラップすることで解決できる。

---

## 多重実行の3層防御

ホストがSPINボタンを連打した場合の防御：

**Layer 1: UIのdisabled**
```tsx
<Button
  onClick={handleSpin}
  disabled={isSpinning || participants.length < 2}
>
```

**Layer 2: ハンドラのガード**
```tsx
const handleSpin = () => {
  if (!isSpinning && !isCompleted && participants.length >= 2) {
    ...
  }
}
```

**Layer 3: サーバーのトランザクション**
```ts
// POST /api/sessions
// roomが COMPLETED なら 409 を返す（後述）
```

UIの保護だけでは足りない。keyboard操作や開発者ツールで迂回できる。
サーバー側が最後の砦。

---

## 学び

> `setInterval` 内では `useState` は stale closure になる。`useRef` でラップして最新値を参照する。

> APIレスポンスは毎回新しいオブジェクト。`prev` との比較で「実質的な変化がないなら再レンダリングしない」設計が必要。

> `undefined` と `null` を使い分けると「まだ確認していない」「確認済みで値なし」を区別できる。
