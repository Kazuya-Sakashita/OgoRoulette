# `const` 宣言より前に使ったら壊れた：TDZ エラーの話

## 導入

「コードは書けた。型エラーも出ていない。なのにブラウザを開くと真っ白になる」。

そのとき開発者ツールには：

```
ReferenceError: Cannot access 'participants' before initialization
```

と表示されていた。`participants` は確かにファイル内に存在する。なぜ「初期化前」と言われるのか。

---

## 問題

OgoRoulette のプレイページ（`app/room/[code]/play/page.tsx`）で、ページを開くと画面が真っ白になるケースが発生した。

コンソールを見ると：

```
ReferenceError: Cannot access 'participants' before initialization
```

`participants` は `useMemo` で定義した変数だが、それを使う処理がファイル内の「より上の行」に書かれていた。

---

## 原因

### JavaScript の `const` は「巻き上げられるが、初期化されない」

`var` は宣言が先頭に巻き上げられ、`undefined` で初期化される。
しかし `const` と `let` は **TDZ（Temporal Dead Zone：一時的なデッドゾーン）** という状態になる。

TDZ とは：
- 宣言はスコープの先頭に巻き上げられる
- しかし実際の `const` 行に到達するまで「初期化されていない」扱いになる
- その間にアクセスすると `ReferenceError` が発生する

```javascript
// これはエラーになる
console.log(x)       // ReferenceError: Cannot access 'x' before initialization
const x = "hello"
```

### コード上で何が起きていたか

```typescript
// ❌ 問題のあったコード（簡略化）
const { groups: savedGroups, saveGroup } = useGroups(currentUser)

// participants を使って計算しているが...
const isCurrentGroupSaved = savedGroups.some(
  (g) => g.participants.length === participants.length  // ← ここで participants を使っている！
)
const handleSaveGroup = async (name: string) => {
  await saveGroup(name, participants)  // ← こちらも
}

// --- ここより下で participants が定義されている ---
const participants = useMemo(() => {
  return membersKey ? membersKey.split("\0") : []
}, [membersKey])
```

`participants` の `useMemo` 定義よりも上の行で `participants` を参照していた。
JavaScript はこのファイルを実行するとき、`const participants = useMemo(...)` の行に到達する前に `isCurrentGroupSaved` の計算を試みる。そのとき `participants` は TDZ 状態にあるため、`ReferenceError` が発生する。

### なぜ TypeScript がエラーを出さなかったか

TypeScript の型チェックはコードの「見た目の順序」ではなく「スコープ内に宣言があるか」を確認する。
同一スコープ内に `participants` の宣言があるため、型エラーとしては検出されない。
TDZ エラーは **実行時にのみ** 発生する。

```
TypeScript の型チェック：「participants は宣言されている → OK」
JavaScript の実行時：「participants はまだ初期化されていない → エラー」
```

---

## 解決方法

**`participants` の `useMemo` 定義より後ろに移動する。**

```typescript
// ✅ 修正後
const { groups: savedGroups, saveGroup } = useGroups(currentUser)
// isCurrentGroupSaved と handleSaveGroup はここには書かない

// --- participants の定義 ---
const participants = useMemo(() => {
  return membersKey ? membersKey.split("\0") : []
}, [membersKey])

// --- participants 定義より後ろに移動 ---
const isCurrentGroupSaved = savedGroups.some(
  (g) => g.participants.length === participants.length
)
const handleSaveGroup = async (name: string) => {
  await saveGroup(name, participants)
}
```

変更は「コードの順序を入れ替えるだけ」。1行も書き換えていない。

---

## 学び

### 1. `const` / `let` は「書いた順番に意味がある」

`var` と違い、`const` や `let` は宣言より前に使うとエラーになる。
コンポーネントの中で「この値はこれに依存する」という順序を守ることが重要。

```
// 良い順序の例
const rawData = useMemo(...)       // 1. 元データ
const derivedValue = useMemo(...)  // 2. 元データから派生
const handler = () => { use(derivedValue) }  // 3. 派生値を使う処理
```

### 2. TypeScript は TDZ エラーを事前に検出しない

型チェックが通っていても実行時エラーになることがある。
特に「同一スコープ内での参照順序」は型チェックでは検出されない。

「型エラーがない ≠ バグがない」という事実の具体例。

### 3. React のカスタムフック・`useMemo`・`useCallback` は上から順に定義する

フック類は React のルールとして「毎回同じ順序で呼ぶ」必要がある。
加えて、依存関係を考えて「使う前に定義する」順序を意識するとバグが減る。

```typescript
// 依存関係を意識した順序
const [phase, setPhase] = useState("waiting")       // 1. 基本 state
const participants = useMemo(...)                    // 2. state から派生
const isCurrentGroupSaved = savedGroups.some(...)   // 3. participants から派生
```

---

## まとめ

| 問題 | 原因 | 解決 |
|------|------|------|
| ページが真っ白になる | `participants` を定義前に参照していた（TDZ エラー） | `participants` の定義より後ろにコードを移動 |
| TypeScript がエラーを出さない | TDZ は実行時エラー。型チェックでは検出されない | コードの順序を「依存関係の順」に整理する習慣をつける |

コードの「見た目の順序」がそのまま実行順序になる。
依存関係のある変数は、依存される側を先に書く。

地味なルールだが、守らないと「型エラーゼロなのに画面が真っ白」という状況に陥る。
