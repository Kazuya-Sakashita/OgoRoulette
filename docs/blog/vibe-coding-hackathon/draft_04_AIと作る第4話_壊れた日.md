# AIと作る ── 第4話「壊れた日」

## ある朝、何も動かなかった

その日は普通の朝だった。

コーヒーを淹れて、ターミナルを開いた。
昨日まで動いていたはずの本番環境を確認した。

「ルーレットの結果が表示されない。」

スピンボタンを押す。ルーレットが回る。止まる。
画面は何も変わらない。当選者が出てこない。もう一度押す。同じ。

ローカルでは動いている。本番だけ動かない。

「また例のやつか」と思った。
ただ、この日の原因はいつもとは違った。

---

## ログを読んだ

Vercel のログを開いた。

エラーはない。API は 200 を返している。
データベースにはちゃんと書き込まれている。

「動いているのに動いていない。」

次にブラウザのコンソールを開いた。

```
[OgoRoulette] handleSpinComplete fired
[OgoRoulette] pendingMemberWinner: null
```

`pendingMemberWinner` が null だった。

これはルーレットが止まったとき、サーバーから受け取るはずの「当選者情報」だ。
それが null のままだった。

---

## 原因を追いかけた

コードを読んだ。

```typescript
// ルーレットが止まったとき
const handleSpinComplete = useCallback(() => {
  const winner = pendingMemberWinnerRef.current  // ← ここが null
  if (winner) {
    setWinner(winner)
  }
}, [])
```

`pendingMemberWinnerRef` はどこで設定されるのか。

```typescript
// サーバーから結果を受信したとき
channel.on('broadcast', { event: 'spin-result' }, ({ payload }) => {
  pendingMemberWinnerRef.current = payload.winner  // ← ここで設定
})
```

順序の問題だった。

ルーレットアニメーションが終わるのと、サーバーから結果が届くのが**競合**していた。

アニメーションが先に終わった → `handleSpinComplete` が呼ばれる → `pendingMemberWinner` がまだ null → 結果が表示されない。

ネットワーク遅延が大きいとき、または処理が重なったとき、この順序逆転が起きる。

ローカルでは起きない。本番の遅延がある環境でだけ起きる。

---

## Claude に投げた

「こういう競合が起きている。どう直す？」と投げた。

Claude が提案してきたのはシンプルだった。

「アニメーション完了時に winner がなければ、winner が来るまで待つ」

```typescript
const handleSpinComplete = useCallback(() => {
  const winner = pendingMemberWinnerRef.current
  if (winner) {
    // すでに結果が届いていたらすぐ表示
    setWinner(winner)
    pendingMemberWinnerRef.current = null
  } else {
    // まだ届いていなければ、届いたタイミングで表示する
    setWaitingForWinner(true)  // フラグを立てる
  }
}, [])

// 結果受信側
channel.on('broadcast', { event: 'spin-result' }, ({ payload }) => {
  pendingMemberWinnerRef.current = payload.winner
  if (waitingForWinnerRef.current) {
    // アニメーションがすでに終わっていたら即表示
    setWinner(payload.winner)
    setWaitingForWinner(false)
  }
})
```

どちらが先に来ても対応できる。競合しない。

---

## でも、これで終わりじゃなかった

修正をデプロイした。動いた。

3日後に別のバグが出た。

今度は「当選者が2回表示される」というものだった。
コードを読んだ。修正のために入れたフラグ管理に漏れがあった。

直した。1週間後、また別のバグが出た。

「直してまた壊れる」サイクルが続いた。

---

## 「これは自分のコードなのか？」

この時期に思ったのは、「このコードを本当に理解しているのか？」という問いだった。

Claude が書いたコードを、自分がレビューして、「良さそう」と判断してデプロイしている。
でも「良さそう」は「理解した」と同じではない。

バグが出たとき、すぐに原因が見えない。
自分で書いたコードなら、書いたときの思考経路があるから「あそこかもしれない」と当たりがつく。

Claude が書いたコードにはその経路がない。

デバッグのたびに初めて読むような感覚があった。

---

## 「壊れた日」の本当の意味

その日のバグは修正できた。

でも「壊れた日」の本当の意味は、バグではなかった。

**「自分がこのコードのオーナーではないかもしれない」という感覚**が壊れた日だった。

Claude にコードを書かせて、自分はレビューするだけ。
自分が理解していないコードが動いている。
バグが出たとき、自分では直せないかもしれない。

その不安が、この日に明確になった。

---

## 方針を変えた

そこから少し変えた。

コードを出してもらったとき、「なぜこう書いたのか説明して」と聞くようにした。
理解できないコードはマージしないことにした。
複雑な実装は「まず方針だけ話して、実装は自分でやる」を選ぶことも増えた。

Claude がパートナーなら、パートナーの判断を丸ごと受け入れるのではなく、
判断の根拠を共有して、自分が納得できるものを採用する。

それが「コードのオーナーでいる」ということだと思った。

*続く*

---

> **次の話**: 第5話「楽しくなってきた瞬間」── 壊れながらも、何かが変わり始めた日。
