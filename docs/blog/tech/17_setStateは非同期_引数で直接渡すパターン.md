# `setState` は非同期：グループ選択と同時にスピンしようとしたら壊れた話

## 導入

「グループカードの ▶ ボタンを押したら、そのメンバーでルーレットを回す」という機能を作った。
動かしてみると、**最初の1回目だけ参加者が反映されない**。
2回目は正しく動く。

典型的な「React の setState が非同期だから起きるバグ」だった。

---

## 問題

OgoRoulette のホーム画面に、保存済みグループの「▶ 回す」ボタンを追加した。
このボタンを押すと「グループのメンバーをセットして即スピン開始」という動作を意図していた。

```typescript
// 最初に書いたコード（バグあり）
const handleSpinWithGroup = (id: string) => {
  const members = selectGroup(id)   // グループのメンバー名を返す関数
  setParticipants(members)          // ← state を更新
  handleSpin()                      // ← 直後にスピン開始
}
```

一見すると正しく見える。しかし実際には：

- 1回目：`participants` が更新される前の古い値（前のメンバー）でスピンが始まる
- 2回目：前回の `setParticipants` がようやく反映された状態でスピンが始まる

---

## 原因

### React の setState は「すぐには反映されない」

```typescript
setParticipants(members)  // この行が実行されても...
handleSpin()              // ...次の行では participants はまだ古い値
```

React の state 更新は「非同期」に行われる。
`setParticipants(members)` を呼んだ直後に `participants` を読んでも、まだ古い値が入っている。
新しい値が参照できるようになるのは、**次の再レンダリング後**。

### handleSpin の中身を見ると

```typescript
const handleSpin = () => {
  if (isSpinning || participants.length < 2 || countdown !== null) return
  //                 ^^^^^^^^^^^^^^^^^^^
  //                 ここで participants を参照している
  //                 → setParticipants 直後は古い値
  ...
}
```

`handleSpin` は `participants.length < 2` という条件で弾く。
初期状態の `participants` が `["A", "B", "C", "D"]`（4人）であれば `handleSpin` は動く。
でも「このグループで回す」という意図は反映されず、古いメンバーで回ってしまう。

---

## 解決方法

### state に頼らず、値を引数として直接渡す

```typescript
// 修正後：スピン開始ロジックを「参加者数を引数に受け取る」形に切り出す
const startSpin = (participantCount: number) => {
  if (isSpinning || participantCount < 2 || countdown !== null) return
  setWinner(null)
  setCountdown(3)
  // カウントダウンのタイマーセット...
}

// 従来のスピンボタンはそのまま動く
const handleSpin = () => startSpin(participants.length)

// グループから即スピンするときは「members.length」を直接渡す
const handleSpinWithGroup = (id: string) => {
  const members = selectGroup(id)
  setParticipants(members)
  startSpin(members.length)   // ← state 更新を待たず、直接 members.length を渡す
}
```

**ポイント：** `startSpin` は `participants` state を読まない。
引数で渡された `participantCount` だけを使う。
これにより「state 更新後の再レンダリング」を待たずに正しい値でスピンできる。

---

## 考え方の整理

### setState の非同期性を意識する場面

```typescript
// ❌ よくある誤解：setした直後に読めると思っている
const [count, setCount] = useState(0)

const handleClick = () => {
  setCount(count + 1)
  console.log(count)  // まだ 0！次のレンダリング後に 1 になる
}
```

```typescript
// ✅ 「次のレンダリングで使われる値」として設定する、と考える
const handleClick = () => {
  const newCount = count + 1
  setCount(newCount)
  console.log(newCount)  // 正しく 1
}
```

「state に set した値を直後に使いたい」場合は、**state を経由せずローカル変数で持つ**のが基本パターン。

### React の再レンダリングと state のライフサイクル

```
1. setState() が呼ばれる
2. React が「次のレンダリングでこの値を使う」とキューに積む
3. 現在の処理が終わる
4. React がレンダリングをスケジュール
5. コンポーネントが再実行される
6. このときはじめて新しい state の値が参照できる
```

`setParticipants` と `startSpin` が同一の関数内で呼ばれるとき、
`startSpin` は step 5 の前（再レンダリング前）に実行される。
だから `participants` はまだ古い値。

---

## よくあるパターンと対処

| パターン | 問題 | 対処 |
|---------|------|------|
| `setState` した直後に読む | 古い値が返る | ローカル変数で持つ |
| 非同期処理の中で state を読む | レンダリング時の値が固まる（stale closure） | `useRef` に最新値を書き込む |
| `setState` の結果を元に次の `setState` | 更新が重なって意図しない値になる | 関数型更新 `setState(prev => ...)` を使う |

今回は「ローカル変数で持つ」パターンで解決した。
`members.length` という値は `selectGroup(id)` の返り値として手元にあるので、state を経由する必要がなかった。

---

## 学び

### 「state = 次のレンダリングへの約束」と覚える

`setState` は「次にこの値を使ってほしい」という React へのリクエスト。
リクエストを出した瞬間には反映されていない。

これを「非同期だから難しい」と感じるより、
「state は現在のレンダリングに属する。新しい値は次のレンダリングで使える」
と理解するとすっきりする。

### 関数の引数でデータを渡せるなら state を経由しない

今回の `startSpin(participantCount)` のように、
「state を更新してから読む」ではなく「値を直接引数で渡す」設計にすることで、
非同期性の問題をそもそも回避できる。

state は「コンポーネント全体で共有したいデータ」に使い、
「この呼び出しの中だけで使う値」はローカル変数で持つ、という分け方が自然。

---

## まとめ

| 問題 | 原因 | 解決 |
|------|------|------|
| グループ選択と同時スピンで参加者が反映されない | `setParticipants` 直後はまだ古い `participants` が参照される | `startSpin(count)` に参加者数を引数で渡し、state を経由しない |
| 2回目から正しく動く | 前回の `setParticipants` が初めて反映されたため | — |

`setState` した値を「その場で」読もうとすることは React でよくある間違い。
「state 更新を待つ」のではなく「引数で直接渡す」設計にするだけで解決することが多い。
