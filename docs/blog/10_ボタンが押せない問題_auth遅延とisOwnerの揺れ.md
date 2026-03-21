# ボタンが押せない問題：auth 遅延と isOwner の揺れ

## 導入

「SPIN ボタンを押そうとしたら、一瞬押せない時間があった」という報告が上がった。
ログを見ると `GET /api/rooms/N6E95D` が短時間に大量発生していた。
ボタンが disabled になっているわけではないのに、押せない。なぜか。

---

## 問題

play 画面でオーナーがスピンボタンを押しても反応しない瞬間がある。

症状をまとめると：

- 画面表示直後の数秒間、スピンボタンが表示されない
- 代わりに「オーナーの回転を待っています...」という非オーナーUIが表示される
- しばらくすると正常なスピンボタンが表示される

---

## 原因

### isOwner は2つの非同期処理の結果に依存していた

```ts
// Owner: logged-in user with isHost=true, OR guest who created this room
const isOwner = currentUser
  ? isRoomOwner(room?.members ?? [], currentUser.id)
  : isGuestHost
```

この計算が `true` になるには、以下が **両方** 揃う必要がある：

| 条件 | 解決タイミング |
|------|--------------|
| `room?.members` が存在する | room fetch 完了後 |
| `currentUser` が存在する | `supabase.auth.getUser()` 完了後 |

### 問題のタイムライン

```
[0ms]   page mount: currentUser=null, room=null → isOwner=false
        → 非オーナーUIが表示される（問題の起点）

[~200ms] room fetch 完了: room=Room, currentUser=null → isOwner=false
         → loading=false → 画面が描画される
         → まだ currentUser=null なので isOwner=false のまま
         → 非オーナーUI が見えてしまう！

[~400ms] auth 解決: currentUser=User → isOwner=true
         → スピンボタンが表示される
```

`loading` は room fetch の完了のみを管理していた。
auth（`supabase.auth.getUser()`）は別の非同期処理で、
room より先に完了する保証がなかった。

### 結果

room が先に返ると、`currentUser=null` のまま UI が描画される。
`isOwner=false` なので、オーナーには非オーナーUIが数百ms〜数秒見える。

---

## 解決方法

### auth の完了フラグを追加する

```ts
const [authLoaded, setAuthLoaded] = useState(false)

useEffect(() => {
  const supabase = createClient()
  supabase.auth.getUser().then(({ data: { user } }) => {
    setCurrentUser(user)
    setAuthLoaded(true)  // ← auth が解決した
  })
}, [])
```

### loading チェックを auth にも対応させる

```ts
// 変更前
if (loading) { return <Spinner /> }

// 変更後：room fetch AND auth の両方が完了するまで待つ
if (loading || !authLoaded) { return <Spinner /> }
```

これで `isOwner` が安定してから UI を描画できる。
auth 完了前に「非オーナーUI が一瞬見える」フラッシュがなくなる。

### おまけ：スピン中のポーリングも止める

スピンボタンを押している間（`isSpinning=true`）も3秒ごとのポーリングが続いていた。
スピン中は room の状態が変わらないため、この fetch は無駄だった。

```ts
const isSpinningRef = useRef(false)
isSpinningRef.current = isSpinning  // render ごとに更新

// ポーリング
setInterval(() => {
  if (!isCompletedRef.current && !isSpinningRef.current) fetchRoom()
}, 3000)
```

`isSpinningRef` を ref にすることで stale closure を避けながら、
スピン中の不要な GET を削減できた。

---

## 学び

### 1. loading は「何が揃ったか」を正確に管理する

「room fetch が終わった」と「auth が解決した」は別のイベント。
`loading` state が room だけを管理していたことで、
auth 待ちの間に UI が中途半端な状態で描画されてしまった。

非同期処理が複数ある場合は、「すべてが揃った」をチェックする。

### 2. derived state（isOwner）の依存を把握する

`isOwner` は `currentUser` + `room.members` + `isGuestHost` から計算される。
どれか一つでも不確かな間は、isOwner は信頼できない。

computed value に非同期依存がある場合は、その非同期が完了するまで表示を保留する。

### 3. useRef で stale closure を避けながら ref を使う

`setInterval` のコールバック内では、state の最新値を直接参照できない（stale closure）。
`ref.current` に毎 render で最新値を書き込むパターンで対処した。

```ts
isSpinningRef.current = isSpinning  // render 時に更新
// setInterval 内では ref.current を読む（常に最新）
```

---

## まとめ

| 問題 | 原因 | 解決 |
|------|------|------|
| スピンボタンが一時的に押せない | auth 完了前に loading=false になる | `authLoaded` state を追加し、auth も待つ |
| スピン中も GET が続く | `isSpinning` を polling 条件に含めていない | `isSpinningRef` を追加し、スピン中は skip |

コードの変更量は小さいが、UX への影響は大きかった。
非同期の初期化処理が複数ある場合は、**すべてが揃うまでローディングを維持する**が基本。
