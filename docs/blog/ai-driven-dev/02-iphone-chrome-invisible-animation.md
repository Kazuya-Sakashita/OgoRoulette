# 4回仮説を立てて、全部外れた。5回目でやっと気づいたこと
— iPhone Chrome でアニメーションが見えない、その本当の理由 —

---

## 事件の発端

ルーレットが止まった瞬間、画面に光が広がる。

プリズムが弾けるように複数の輝くリングが広がり、当選者を祝福するエフェクト——PrismBurst と呼んでいたその演出は、開発中から「これは映える」と感じていた機能だった。

PC ブラウザで動作確認する。完璧だ。iPhone Safari でも試す。問題なく表示される。

ところが、iPhone Chrome で開いたとき、何も起きなかった。

ルーレットが止まる。当選者のカードが表示される。でも光のエフェクトは一切ない。まるで最初からそんな機能など存在しないかのように、画面はただ静かだった。

同じコード。同じデプロイ。同じ iPhone。アプリだけが違う。

こんなにシンプルな「違い」が、4回の仮説と4回の失敗を生み出すことになるとは、このときはまだ思っていなかった。

---

## 容疑者リスト

まず状況を整理した。

- **PC（Chrome / Firefox / Safari）**: 正常
- **iPhone Safari**: 正常（のちに発覚する重要な事実）
- **iPhone Chrome**: 何も表示されない

iPhone Chrome は内部的に WKWebView を使っている。iOS 上のサードパーティブラウザはすべて、Apple の制約により WebKit ベースの WKWebView を使わなければならない。つまり「Chrome のエンジン」ではなく「Safari のエンジン」で動いているのに、挙動が違う。

これが謎を深くした最初の要因だった。

---

## 仮説A: `createPortal` のターゲット問題

*「ポータルの出口が間違っているのでは？」*

PrismBurst コンポーネントは `createPortal` を使って DOM の外部にレンダリングしていた。

```tsx
// Before
return createPortal(<div>...</div>, document.body)
```

`document.body` を指定することで、親コンポーネントの CSS 制約（特に `overflow: hidden` や `position` 関連）から逃げる意図だった。

調査を進めると、iOS WebKit には特有の制約があることがわかった。

> `position: fixed` は `overflow: hidden` を持つ祖先要素を基準にする

通常の仕様では `position: fixed` は viewport を基準にするはずだが、iOS WebKit では `overflow: hidden` の祖先要素が新しい基準になってしまう場合がある。これによって、`document.body` に追加した要素でも、意図した位置に固定表示できないことがある。

解決策として、ポータルのターゲットを `document.documentElement`（`<html>` 要素）に変更した。

```tsx
// After
return createPortal(<div>...</div>, document.documentElement)
```

デプロイ。iPhone Safari で確認。

……表示された。Safari では直った。

iPhone Chrome で確認。

……何も起きない。

仮説A は半分正解だった。でも iPhone Chrome の問題は別の場所にある。

---

## 仮説B: `conic-gradient` + `-webkit-mask-image` の組み合わせ問題

*「グラデーションとマスクの組み合わせが壊れているのでは？」*

PrismBurst のビジュアルは `conic-gradient`（円錐グラデーション）と `-webkit-mask-image` を組み合わせて実装していた。プリズムらしい虹色の輝きを出すための工夫だ。

しかし調査するうちに、WKWebView ではこの組み合わせが不安定になるケースがあることがわかってきた。`conic-gradient` は比較的新しい CSS プロパティであり、`-webkit-mask-image` との合成処理でレンダリングが壊れる環境がある。

「だったら `radial-gradient` だけにすれば確実だ」と判断し、マスクなしのシンプルな実装に書き換えた。

デプロイ。iPhone Chrome で確認。

……やはり何も表示されない。

見た目は変わっているはずなのに、「表示されない」という事実は変わらない。これはもはや CSS の問題ではないのかもしれない、と思い始めた。

---

## 仮説C: `will-change` の GPU コンポジション問題

*「GPU レイヤーの扱いが変わっているのでは？」*

Framer Motion でアニメーションを実装すると、デフォルトで `will-change: transform` が設定される。これはブラウザに「この要素はアニメーションする」と伝えることで、GPU コンポジション（独立したグラフィックレイヤーへの昇格）を促すヒントだ。

しかし WKWebView では、`will-change: transform` が GPU コンポジションのトリガーになったとき、`overflow` の扱いが変わることがある。要素が独立したレイヤーに昇格すると、親要素の `overflow: hidden` が効かなくなったり、逆に固定位置の基準がずれたりする。

`style` prop から `will-change` を削除することにした。

```tsx
// Before
<motion.div style={{ willChange: "transform" }} animate={...} />

// After
<motion.div animate={...} />
```

デプロイ。iPhone Chrome で確認。

……動かない。

落胆しながら、もう少しだけ Framer Motion のソースコードを調べることにした。

---

## 仮説D: Framer Motion の内部 `will-change`

*「ライブラリ自体が裏で設定しているのでは？」*

そこで衝撃的な事実を知った。

Framer Motion は、`style` prop に `willChange` を書かなくても、アニメーションが設定された要素に対して内部で自動的に `will-change: transform` を付与する。これはパフォーマンス最適化のためのデフォルト挙動だ。

つまり、いくら `style` prop から消しても意味がなかった。

「であれば、Framer Motion を完全に廃止するしかない」という結論に至った。

すべてのアニメーションを CSS `@keyframes` に移行する大規模な書き換えを実施した。

```tsx
function buildKeyframes(k: number): string {
  const rings = RINGS.map((r, i) => `
    @keyframes pb-r${i}-${k} {
      0%   { transform: translate(-50%,-50%) scale(.20); opacity: 0; }
      32%  { opacity: ${r.peakOpacity}; }
      100% { transform: translate(-50%,-50%) scale(${r.scaleEnd}); opacity: 0; }
    }
  `).join("")
  return rings + flash + aurora
}

// コンポーネント内
<div style={{
  animation: `pb-r${i}-${k} ${ring.duration}s ${ring.delay}s cubic-bezier(.08,.65,.22,1) both`,
}} />
```

Framer Motion 由来の `will-change` は完全に消えた。CSS ネイティブの `@keyframes` アニメーションはシンプルで制御しやすく、「これで動くはずだ」という確信もあった。

デプロイ。iPhone Chrome で確認。

……何も表示されない。

4回目の失敗だった。

ここで初めて「コードの問題ではないかもしれない」という考えが頭をよぎった。

---

## 謎解き

しばらく別の作業をしていた。

アプリには `ChunkLoadError` という別のバグがあり、それを根本解決するために Service Worker を「tombstone（墓石）」と呼ばれる形式に差し替えた。

```js
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})
// fetch ハンドラなし
```

このコードは単純だ。起動時にすべてのキャッシュを消去し、fetch イベントを一切ハンドルしない。旧 Service Worker が蓄積していたキャッシュをすべて削除するための「自壊型 SW」だ。

これをデプロイしたのは PrismBurst とは無関係の作業として。翌日、いつものように iPhone Chrome でアプリを開いた。

ルーレットが止まった。

光が広がった。

プリズムのリングがはじけるように輝いた。

PrismBurst が、初めて iPhone Chrome で表示された。

---

## 真犯人

整理すると、こういうことだった。

仮説D の修正——Framer Motion を廃止して CSS `@keyframes` に書き換えたこと——は正しかった。コードは正しく修正されていた。

しかし iPhone Chrome にインストールされていた旧 Service Worker は、`_next/static/chunks/` 以下のキャッシュを持ち続けていた。Next.js がビルドした JS チャンクファイルだ。

デプロイするたびに新しいファイルが生成される。しかし旧 SW は「自分が知っているファイル名のものはキャッシュから返す」という挙動をしていた。旧来の Framer Motion 版のコードが、キャッシュの中で生き続けていたのだ。

つまり：

1. コードを直した（正しい）
2. デプロイした（正しい）
3. でもユーザーの端末では旧コードが動いていた（キャッシュが原因）

「コードを直す」と「直したコードがユーザーに届く」は、別の問題だった。

---

## iOS Chrome (WKWebView) の制約まとめ

今回の調査で明らかになった iOS Chrome 固有の挙動を整理しておく。

| 制約 | 内容 |
|------|------|
| `position: fixed` の基準 | `overflow: hidden` を持つ祖先要素が基準になる（通常は viewport） |
| `conic-gradient` + `-webkit-mask-image` | 組み合わせが不安定になるケースがある |
| `will-change: transform` | GPU コンポジション昇格により `overflow` の扱いが変わることがある |
| Framer Motion | `style` prop に書かなくても内部で `will-change` を自動設定する |

iOS 上のすべてのサードパーティブラウザは WKWebView を使用しているため、「Chrome だから」ではなく「iOS だから」という視点でデバッグするとよい。ただし今回のように、Safari と Chrome で挙動が異なるケースもある——その場合は SW キャッシュの差分を疑うことが重要だ。

---

## 学びのまとめ

**1. ブラウザとエンジンを混同しない**

iOS 上の Chrome は Blink ではなく WebKit（WKWebView）で動いている。「Chrome だから PC と同じ挙動」という前提は iOS では成立しない。

**2. `will-change` はライブラリ内部でも設定される**

Framer Motion のような UI ライブラリは、パフォーマンス最適化のために `will-change` を自動設定することがある。実装者が「書いていない」と思っていても、DOM には存在する場合がある。

**3. デプロイとキャッシュ無効化は別問題**

Service Worker がキャッシュを持っている場合、デプロイしても旧コードがユーザーに届き続ける。「コードを直した」と「ユーザーが直ったコードを受け取った」の間には SW キャッシュという壁がある。

**4. デバッグの「確認」も設計が必要**

「修正後に確認する」だけでは不十分で、「キャッシュがない状態で確認する」「複数端末で確認する」「SW を強制更新した状態で確認する」という設計が要る。特にモバイル実機でのデバッグは、キャッシュの状態を意識しないと「直ったのか直っていないのか」すらわからなくなる。

---

## 次に活かす視点

- **モバイルデバッグ時は SW を tombstone にしてから確認する** という手順を標準にする
- **Framer Motion の `will-change` 挙動** は公式ドキュメントに明記されていないことが多い。モバイル WKWebView で問題が出たときは疑ってみる
- **「Safari は動く、Chrome は動かない（iOS）」** という差異が出たときは、SW キャッシュの状態を最初に確認する

---

## 読者への問い

あなたはデプロイ後に「直ったかどうか」をどうやって確認しているか。

シークレットモードで開く、DevTools でキャッシュを無効化する、アプリを強制終了して再起動する——それぞれ「キャッシュをクリアしている」ように見えて、SW キャッシュが残っているケースがある。

「コードが正しい」と「ユーザーに届いている」の間に何があるか。一度、その経路全体を疑ってみると、今まで謎だったバグの輪郭が見えてくるかもしれない。
