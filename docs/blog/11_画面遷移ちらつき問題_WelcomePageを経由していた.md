# 画面遷移ちらつき問題：WelcomePage を経由していた

## 導入

「結果画面からホームへ戻るとき、一瞬白くなる / 別の画面が見える」という問題が発生した。
操作としては「ホームへ戻る」ボタンを押すだけ。なぜちらつくのか。

---

## 問題

WinnerCard や COMPLETED 状態の「ホームへ戻る」ボタンを押すと、
ホーム画面に到達するまでに一瞬だけ別画面が見えた。

- play 画面 → 暗い画面が一瞬見える → ホーム画面
- 特にアニメーションが入る感じがして不自然
- モバイルだと余計に目立つ

---

## 原因

### ホームへ戻るボタンが `/` に遷移していた

```tsx
// winner-card.tsx
<Link href="/" onClick={onClose}>
  ホームへ戻る
</Link>

// play/page.tsx（COMPLETED）
<Link href="/">ホームへ戻る</Link>

// play/page.tsx（ヘッダー ← ボタン）
<Link href="/">
  <ArrowLeft className="w-5 h-5" />
</Link>
```

`/` は `WelcomePage`（ログイン画面・オンボーディング）。
実際の「ホーム」は `/home`。

### WelcomePage が経由地になっていた

`app/page.tsx`（WelcomePage）の処理：

```ts
useEffect(() => {
  setMounted(true)  // ← CSS が opacity-0 → 100 で描画される

  const checkUserOrVisited = async () => {
    const hasVisited = localStorage.getItem('ogoroulette_visited')
    const { data: { user } } = await supabase.auth.getUser()

    if (user || hasVisited) {
      router.push('/home')  // ← 非同期で /home へ
    }
  }
  checkUserOrVisited()
}, [router])
```

### ちらつきのタイムライン

```
[0ms]    / に到達
         WelcomePage が描画開始
         background (暗い画面) が見える
         mounted=false → content は opacity-0

[~16ms]  setMounted(true) → content が opacity-100 へアニメーション開始
         （transition-all duration-700）

[~300ms] auth + localStorage チェック完了
         router.push('/home') → /home に遷移
```

このわずか 300ms の間に：
1. WelcomePage の暗いバックグラウンドが見える
2. content のフェードインが始まる
3. /home に切り替わる

計2ホップ（`/ → /home`）の描画コストが「ちらつき」になっていた。

### なぜ `/` に向けていたのか

「ホームへ戻る」の `href="/"` は設計当初から存在していた。
`/` がオンボーディング兼ホームだった時期の名残で、
後から `app/home/page.tsx` が作られたが、リンク先が更新されていなかった。

---

## 解決方法

### `href="/"` → `href="/home"` に変更する（4箇所）

```tsx
// winner-card.tsx
<Link href="/home" onClick={onClose}>ホームへ戻る</Link>

// play/page.tsx（COMPLETED）
<Link href="/home">ホームへ戻る</Link>

// play/page.tsx（ヘッダー ← ボタン）
<Link href="/home"><ArrowLeft className="w-5 h-5" /></Link>

// play/page.tsx（エラー画面 ← ボタン）
<Link href="/home"><ArrowLeft className="w-5 h-5" /></Link>
```

### なぜ `/home` で問題ないか

`/home` は認証不要でアクセスできる。
play 画面にいる時点でユーザーは何らかの方法でルームに参加しているため、
`ogoroulette_visited` も設定済みであり、`/` に戻っても `/home` に転送されるだけだった。

直接 `/home` に行くことで：
- WelcomePage の描画がゼロになる
- auth チェックの非同期待ちがゼロになる
- ブラウザ履歴も `/ → /home` の2エントリではなく `/home` の1エントリになる

---

## 学び

### 1. 遷移先の URL と「実際のホーム」がズレていた

アプリが成長する過程で「ホーム = `/`」から「ホーム = `/home`」に変わったが、
リンク先が追従していなかった。

ルーティング設計が変わったときは、既存のリンクを全探索して更新する必要がある。

### 2. 経由画面の描画コストを意識する

`href="/"` から `/home` へのリダイレクトはわずか数百ms だが、
その間に WelcomePage が描画され始める（CSS アニメーションも含めて）。
これがユーザーには「ちらつき」として知覚される。

「リダイレクトするから問題ない」ではなく、「経由画面を描画させない」が正解。

### 3. 最小差分で直せた

4箇所の `href="/"` → `href="/home"` だけ。
ロジック変更ゼロ、新しい state も不要。

ちらつきの原因は複雑なアニメーション設定や state 管理ではなく、
単純なリンク先の誤りだった。

---

## まとめ

| 問題 | 原因 | 解決 |
|------|------|------|
| ホームへ戻るときにちらつく | `href="/"` → WelcomePage 経由 → `/home` の2ホップ | `href="/home"` に直接変更（4箇所） |

「画面遷移のちらつき」はアニメーションや state が原因だと思いがちだが、
今回は単純なリンク先の問題だった。
コードを複雑にする前に、遷移先 URL が正しいかを確認するのが先決。
