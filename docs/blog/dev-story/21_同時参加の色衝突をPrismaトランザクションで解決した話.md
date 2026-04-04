# 同時参加の色衝突を Prisma トランザクションで解決した話

## 目次

1. [どんな問題だったか](#どんな問題だったか)
2. [なぜ起きるのか：レースコンディション](#なぜ起きるのか)
3. [図解：何が起きているか](#図解)
4. [修正：トランザクションで解決する](#修正)
5. [定員超過の同時参加も同じ問題だった](#定員超過も同じ問題)
6. [学び](#学び)

---

## どんな問題だったか

ルーレットアプリで「QR コードを全員に見せて、一斉にスキャン → 参加」という使い方をしたとき、**複数人のセグメントが同じ色になる**という問題があった。

ルーレットでは各メンバーを色で区別している。同じ色が2つあると、どちらが当たったか分からなくなる。

また、定員が設定されているルームに複数人が同時に参加しようとすると、**定員を超えてメンバーが追加される**という問題も同時に存在していた。

---

## なぜ起きるのか

### 色の決め方

参加時の色は「今いるメンバー数 % 色の総数」で決める。

```typescript
const colorIndex = room._count.members % SEGMENT_COLORS.length
// メンバーが3人なら colorIndex = 3 → 4番目の色
```

シンプルで分かりやすい。しかしこの計算には問題がある。

### レースコンディション（Race Condition）とは

**同時に複数のリクエストが同じデータを読み書きするとき、タイミングによって結果が変わる問題**のことをレースコンディション（競合状態）という。

今回のケースで何が起きているかを見てみる。

---

## 図解

```
時刻  ユーザーA の処理         ユーザーB の処理
────────────────────────────────────────────────
t=1   メンバー数を取得 → 3
t=2                           メンバー数を取得 → 3
t=3   colorIndex = 3 % 12 = 3
t=4                           colorIndex = 3 % 12 = 3  ← 同じ！
t=5   色[3] でメンバー作成
t=6                           色[3] でメンバー作成  ← 衝突！
```

両者が「メンバー数 = 3」を読んだ時点では、まだ誰も INSERT していない。そのため両者が同じ `colorIndex` を計算し、同じ色でメンバーが作られる。

データベースへの読み取りと書き込みの間に「隙間」があることが原因だ。

---

## 修正

### 解決策：トランザクションで「読み取り → 書き込み」をひとまとめにする

**トランザクション**とは、複数のデータベース操作を「1つの塊」として扱う仕組みだ。

トランザクション内では：
- 他のトランザクションの中間状態は見えない
- 処理が完全に成功するか、全部取り消されるかのどちらか

Prisma では `$transaction()` でトランザクションを使う。

```typescript
// 修正前：読み取りと書き込みが別々
const colorIndex = room._count.members % SEGMENT_COLORS.length  // ← この値が古い可能性がある
const newMember = await prisma.roomMember.create({
  data: { ..., color: SEGMENT_COLORS[colorIndex] }
})
```

```typescript
// 修正後：トランザクション内でカウントを取り直す
const newMember = await prisma.$transaction(async (tx) => {
  // トランザクション内でカウントを取得（この値は最新かつ排他的）
  const count = await tx.roomMember.count({
    where: { roomId: room.id }
  })
  const colorIndex = count % SEGMENT_COLORS.length

  return tx.roomMember.create({
    data: { ..., color: SEGMENT_COLORS[colorIndex] }
  })
})
```

`tx.roomMember.count()` でカウントを取り直すことで、トランザクション外で取得した古い値ではなく、**この時点での確実なカウント**を使える。

ユーザーAのトランザクションが完了するまで、ユーザーBのトランザクションはカウントを取得できない（ロック待ちになる）ため、色が衝突しなくなる。

```
時刻  ユーザーA の処理         ユーザーB の処理
────────────────────────────────────────────────────
t=1   トランザクション開始
t=2   メンバー数を取得 → 3
t=3   colorIndex = 3
                              （ロック待ち）
t=4   色[3] でメンバー作成
t=5   コミット（完了）
t=6                           トランザクション開始
t=7                           メンバー数を取得 → 4  ← 最新！
t=8                           colorIndex = 4
t=9                           色[4] でメンバー作成  ← 別の色！
t=10                          コミット（完了）
```

---

## 定員超過も同じ問題

同時に定員チェックをすると、定員を超えてメンバーが追加される問題も同じ原因だった。

```typescript
// 問題のあるコード
const memberCount = room._count.members   // ← 古い可能性がある
if (memberCount >= room.maxMembers) {
  return Response.json({ error: "満員です" }, { status: 400 })
}
// ↓ この間に別リクエストが参加を完了させると...
await prisma.roomMember.create(...)  // ← 定員超過で追加される
```

```typescript
// 修正後：トランザクション内でカウントを確認してから INSERT
await prisma.$transaction(async (tx) => {
  const currentCount = await tx.roomMember.count({
    where: { roomId: room.id }
  })

  if (currentCount >= room.maxMembers) {
    throw new Error("ROOM_FULL")  // エラーを throw するとトランザクションが自動ロールバック
  }

  const colorIndex = currentCount % SEGMENT_COLORS.length
  return tx.roomMember.create({
    data: { ..., color: SEGMENT_COLORS[colorIndex] }
  })
})
```

トランザクション内で `throw` すると、それまでの操作が**すべてロールバック**（なかったことに）される。定員チェックと INSERT が一体になるため、チェックをすり抜けることができなくなる。

---

## 学び

### 1. レースコンディションは「確率的なバグ」

通常の使い方（1人ずつ参加）では絶対に発生しない。「QR コードを一斉スキャン」という使い方で初めて顕在化する。

**負荷テストや同時リクエストテストをしないと発見できない**タイプのバグだ。本番で数十人が使い始めてから気づくことが多い。

### 2. DB ロックなしの「読んでから書く」は危険

```typescript
// このパターンは危険
const current = await read()
const next = calculate(current)  // この間に他のリクエストが current を変えるかもしれない
await write(next)
```

「読んでから計算して書く」という流れは、並行リクエストがある環境では安全ではない。カウンターのインクリメント、在庫の減算、枠の確保など、「現在の値を使って次の値を決める」操作は要注意だ。

### 3. Prisma のトランザクションは `$transaction()` で簡単に使える

```typescript
await prisma.$transaction(async (tx) => {
  // tx を使った操作はすべて同一トランザクション内
  const count = await tx.someTable.count(...)
  return tx.someTable.create(...)
})
```

トランザクションが必要かどうかの判断基準：**「読み取った値を使って書き込む」操作** は基本的にトランザクションにする。

### 4. 事前チェックは「パフォーマンス最適化」として残す

トランザクションを使うと排他制御が入るため、少しパフォーマンスが下がる。よくある対応は「事前に軽いチェックを行い、明らかにはじく」+「トランザクション内で確実にチェックする」の2段構えだ。

```typescript
// 事前チェック（トランザクション外、高速）
if (room._count.members >= room.maxMembers) {
  return Response.json({ error: "満員です" }, { status: 400 })
}

// 確実なチェック（トランザクション内）
await prisma.$transaction(async (tx) => {
  const currentCount = await tx.roomMember.count(...)
  if (currentCount >= room.maxMembers) throw new Error("ROOM_FULL")
  ...
})
```

事前チェックで大半のリクエストを早めに返し、通り抜けた際はトランザクション内で安全に処理する。

---

## まとめ

同時リクエストによる色衝突・定員超過は、**「読んでから書く」という操作がアトミックでない**ことが原因だった。

Prisma の `$transaction()` を使い、カウントの読み取りと INSERT を1つのトランザクションにまとめることで解決した。

「同時に複数人がアクセスする」ことを想定しないと気づきにくいバグだが、Web アプリでは常に並行リクエストが発生しうる。DB を更新する処理では「これは並行して実行されても安全か？」を意識する習慣が重要だ。

---

## タイトル案

1. 同時参加でルーレットの色が被る：Prisma トランザクションでレースコンディションを解決
2. QR コード一斉スキャンで壊れた：並行リクエストと DB の競合問題
3. 「読んでから書く」は危険：Prisma トランザクションで同時参加の衝突を防ぐ
4. レースコンディションを知らずに作ると本番で壊れる：Prisma で安全なカウントインクリメント
5. 定員チェックをすり抜けた：トランザクションなしの SELECT + INSERT が引き起こす問題

---

## SNS 投稿文

```
「QR を同時にスキャンしたら同じ色になった」というバグを直した。

原因：メンバー数の読み取りと INSERT の間に、別リクエストが割り込める（レースコンディション）

// 問題のあるコード
const count = room._count.members  // 古い可能性がある
const colorIndex = count % colors.length
await prisma.roomMember.create(...)

// 修正
await prisma.$transaction(async (tx) => {
  const count = await tx.roomMember.count(...)  // トランザクション内で取り直す
  return tx.roomMember.create(...)
})

「読んでから書く」操作はトランザクションにする、が基本。
```
