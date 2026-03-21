# `5 + Math.random() * 2` のたった1行が、全員のルーレット結果をバラバラに壊していた

## はじめに

「winner の名前は全員同じ。でも、ルーレットの針が指している人が、オーナーとメンバーで違う。」

これを最初に報告されたとき、正直なところ信じられなかった。

なぜなら、コードを見ると何も問題がなさそうに見えたからだ。

winner を決めるのはサーバー。
`winnerIndex` は全クライアントに同じ値が届く。
ルーレットの描画ロジックも同じコンポーネントを使っている。

なのに、なぜポインターが指す位置が違うのか。

この記事は、その原因を追跡した話と、
そこから得た「**deterministic な描画設計**」という考え方についての記録だ。

---

## 問題の現象

複数人でルームを開き、ルーレットを回す。
結果テキストには全員「Alice さんが奢り確定！」と表示される。

しかし：

- **オーナー画面**: ポインターが「Alice」のセグメントを指している ✅
- **メンバー画面**: ポインターが「Bob」のセグメントを指している ❌

winner の *データ* は一致しているのに、
winner の *見た目（ルーレットの停止位置）* が一致しない。

これは単なる「演出のズレ」ではない。

「本当に公平な抽選が行われたのか？」という信頼を損なうバグだ。

---

## コードを読んでも問題が見えない

ルーレットの停止角度を計算する核心部分を見てほしい。

```typescript
// roulette-wheel.tsx
const targetEffectiveAngle = resolvedIdx * segmentAngle + segmentAngle / 2
const targetNormalized = (360 - targetEffectiveAngle % 360 + 360) % 360

const currentRotation = rotation.get()
const currentNormalized = ((currentRotation % 360) + 360) % 360
let angleDiff = targetNormalized - currentNormalized
if (angleDiff <= 0) angleDiff += 360

const minSpins = 5 + Math.random() * 2   // ← ここ
const targetRotation = currentRotation + (360 * minSpins) + angleDiff
```

`angleDiff` は、`targetNormalized`（正しい停止角度）に着地するための補正値として計算されている。
設計の意図はこうだ：

> 何回転か余分に回して（`360 * minSpins`）、最後に `angleDiff` だけ足せば、ポインターが目標のセグメントに止まる

理屈は正しそうに見える。しかしここに罠がある。

---

## 問題の核心: 非整数 × 角度計算

`minSpins = 5 + Math.random() * 2` は、たとえば **5.73** のような値になる。

`360 * 5.73 = 2062.8`

ここで重要な数学的事実がある：

```
2062.8 % 360 = 262.8
```

これは **0 ではない**。

最終的な停止角度を計算してみる：

```
targetRotation % 360
= (currentRotation + 360 * 5.73 + angleDiff) % 360
= (currentNormalized + 262.8 + angleDiff) % 360   ← 262.8 が混入！
= (targetNormalized + 262.8) % 360
```

`angleDiff` は「`currentNormalized + angleDiff ≡ targetNormalized (mod 360)`」になるよう設計されている。
しかし **`360 * minSpins` の余りが 0 でない** ため、最終位置が `targetNormalized + 262.8°` になってしまう。

### オーナーとメンバーで何が違うのか

それぞれのクライアントは **独立に** `Math.random()` を呼ぶ。

| クライアント | minSpins | 360 * minSpins % 360 | 実際の停止角度 |
|---|---|---|---|
| オーナー | 5.73 | 262.8° | targetNormalized + 262.8° |
| メンバー | 5.12 | 43.2° | targetNormalized + 43.2° |

両者の停止角度は、**最大 360° ずれる可能性がある**。

4人でルーレットを回せばセグメント幅は 90°。
262.8° ずれれば、3セグメント分違う場所を指す。

### なぜシングルユーザーテストで気づかないのか

1人で動作確認するとき、全員の「`minSpins`」は自分のブラウザで生成された同じ1つの値だ。
オーナーとメンバーの両方が **自分** なので、ズレようがない。

多人数環境で初めて露出するバグの典型例だ。

---

## 修正: 整数スピン数にする

解決策はシンプルだ。

```typescript
// 修正前
const minSpins = 5 + Math.random() * 2       // 非整数 → 余剰角度が混入

// 修正後
const minSpins = 5 + Math.floor(Math.random() * 3)  // 5 | 6 | 7 の整数
```

整数 `n` に対して `360 * n % 360 = 0` が必ず成り立つ。

```
targetRotation % 360
= (currentNormalized + 0 + angleDiff) % 360
= targetNormalized  ✅
```

オーナーが `minSpins = 5`、メンバーが `minSpins = 7` を引いても、
両者の最終停止角度は同じ `targetNormalized` になる。

演出（何回転するか）はバラバラで構わない。
**最終位置だけが deterministic であればいい。**

---

## より深い学び: deterministic な描画設計

このバグを通じて得た設計原則がある。

**「共有された結果データから、描画が一意に決まること」**

ルーレットに限らず、複数クライアントが同じ UI を見るとき、
「何を共有するか」と「何を各クライアントに任せるか」の分離が重要になる。

```
Shared State（全員共通）
  ├── winnerIndex     ← サーバーが決定
  ├── targetNormalized ← winnerIndex から deterministic に計算可能
  └── participants[]  ← サーバーから同一順序で配布

Local State（各端末で異なっていい）
  ├── minSpins        ← 演出のバリエーション（今回の修正ポイント）
  ├── duration        ← アニメーション速度
  └── bounceAmount    ← 停止後の跳ね返り量
```

`minSpins` は **Local State** に属するので、各クライアントで違う値でいい。
ただし、**Local State が Shared State の最終結果を壊してはいけない**。

整数化によって「`minSpins` がどんな値でも停止角度は変わらない」という不変条件が成立する。
これが **「Local State が Shared State を壊さない」** 設計の具体例だ。

---

## もう1つの落とし穴: participants の順序

似たような問題が `participants` 配列の順序にも潜む。

`winnerIndex = 1` という情報だけ渡しても、
「誰の配列の index 1 か」が一致していなければ、別の人を指してしまう。

```typescript
// オーナーが送った participants（サーバーはこれの index 1 = "Bob" を選ぶ）
["Alice", "Bob", "Charlie"]

// メンバーの participants（キャッシュや別フェッチで順序が違うと…）
["Bob", "Alice", "Charlie"]  // index 1 = "Alice" になってしまう！
```

今回のコードでは、サーバーが `joinedAt: 'asc'` で順序を固定し、
全クライアントが同じ API エンドポイントから取得することで防いでいる。

**ルール: `winnerIndex` は「誰が用意した配列のインデックスか」を明示せよ**

サーバーが `participants` の順序を確定し、
その順序で `winnerIndex` を返すことで、全員が同じ人物を指せる。

---

## チェックリスト: 多クライアント描画設計の確認

```
□ ランダム値が最終描画状態（停止位置・停止セグメント）に影響していないか
□ winner の特定に使うインデックスは「誰の配列」のインデックスか明示されているか
□ participants の配列順序がサーバー由来の固定ルールで決まっているか
□ クライアントで独立に乱数生成しているものが、最終的な「一致させるべき値」を変えていないか
□ シングルクライアントだけでなく、複数クライアント同時接続でテストしたか
```

---

## まとめ

問題の1行はこれだった：

```typescript
const minSpins = 5 + Math.random() * 2  // 非整数 → 各クライアントで停止角度がズレる
```

原因は「非整数 × 360° の余り」が最終停止角度に混入することだった。

修正は1行：

```typescript
const minSpins = 5 + Math.floor(Math.random() * 3)  // 整数化で余りがゼロになる
```

しかしこのバグが教えてくれた本質的な学びは、修正より大きい。

**「動いているように見えるコードが、多クライアント環境では信頼できない」**

shared state と local state の区別、
deterministic な描画設計、
「演出のランダム性が結果の一意性を壊してはいけない」というルール。

これらは、UI の複雑さが増すほど重要になる原則だ。

自分の実装を振り返ったとき、
「この乱数、最終的な描画状態に影響してないか？」
と疑う習慣が、このバグを防いでくれる。
