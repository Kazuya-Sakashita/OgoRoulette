# 本番が壊れ続けた理由は、直したつもりのコードではなかった
— ChunkLoadError と Service Worker キャッシュの落とし穴 —

---

本番でルーレットが止まった瞬間、エラー画面に飛んだ。

「また出た」と思いながら DevTools を開くと、コンソールにはこう書いてある。

```
ChunkLoadError: Loading chunk ab8635c6e7470436 failed.
(missing: https://ogo-roulette.vercel.app/_next/static/chunks/ab8635c6e7470436.js)
```

`_next/static/chunks/` 配下の JS ファイルが 404 になっている。Vercel にはちゃんとデプロイしたのに、なぜ。

しかも `window.location.reload()` が自動的に走るが、直後にまったく同じエラーが出る。無限ループだ。

「localStorage を消したら直りました」というユーザー報告も届いた。

何が起きているのか、最初はまったく分からなかった。

---

## 最初の勘違い — dynamic import を疑った

コードを見ると、`home/page.tsx` で `next/dynamic` を使っていた。

```tsx
const Confetti = dynamic(() => import("@/components/confetti"))
const WinnerCard = dynamic(() => import("@/components/winner-card"))
```

「これだ。dynamic import でチャンクが分割されて、デプロイ後にハッシュが変わった旧チャンクが 404 になっている」と判断した。

ISSUE-166 として、`next/dynamic` を全部 static import に戻した。ビルドも通った。デプロイした。

— しかし、次のデプロイでまた発生した。

なぜ？ dynamic import を消したのに、なぜ再発するのか。

> **気づき:** 「原因らしきもの」を消しても再発するなら、それは原因ではない。

---

## 応急処置という名の隠蔽

並行して `error.tsx` に「賢い」リロード機構を実装していた。

```tsx
useEffect(() => {
  if (!isChunkLoadError(error)) return
  const RELOAD_KEY = "chunk-error-reload-count"
  const RELOAD_WINDOW_MS = 30_000
  const MAX_RELOADS = 3
  try {
    const raw = sessionStorage.getItem(RELOAD_KEY)
    const data = raw ? JSON.parse(raw) : { count: 0, since: Date.now() }
    const isExpired = Date.now() - data.since > RELOAD_WINDOW_MS
    const nextCount = isExpired ? 1 : data.count + 1
    if (isExpired || data.count < MAX_RELOADS) {
      sessionStorage.setItem(
        RELOAD_KEY,
        JSON.stringify({ count: nextCount, since: isExpired ? Date.now() : data.since })
      )
      window.location.href = window.location.pathname + "?_r=" + Date.now()
    }
  } catch {}
}, [error])
```

ChunkLoadError を検出したら `?_r=タイムスタンプ` を付けてリロードする。これでブラウザのキャッシュをバイパスして新しいチャンクを取得する作戦だ。3回以上のループは止める。

これが動いて、「3回以内にリカバリできるようになった」と満足してしまった。

— でも次のデプロイでまた無限ループが出た。

このとき初めて気づくべきだった。「応急処置が、原因を見えなくしていた」と。タイムスタンプ付きリロードが「たまたま」成功することで、根本に何があるかを確認しなくてよくなっていた。

> **気づき:** 応急処置は症状を隠すことがある。直ったように見えても、原因が消えたわけではない。

---

## gstack で構造的に分解した

「なんとなく直す」のをやめて、問題を Product / UX / Engineering / Risk の4軸で整理した。

**Engineering 軸**を掘り下げていくと、見落としていた観点に気づいた。

「`_r=timestamp` でキャッシュをバイパスしているつもりだが、**何のキャッシュ**をバイパスしているのか？」

ブラウザキャッシュ？ CDN キャッシュ？ — それとも、**Service Worker のキャッシュ**？

そこで初めて `public/sw.js` をちゃんと読んだ。

---

## sw.js を、初めてちゃんと読んだ

コードはこうなっていた。

```js
const CACHE_VERSION = 'v1'
const CACHE_NAME = `ogoroulette-${CACHE_VERSION}`

const PRECACHE_URLS = [
  '/',
  '/home',
  '/manifest.json',
  // ...
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('ogoroulette-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response.ok && url.pathname.startsWith('/_next/static/')) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
      })
    )
  }
})
```

3つの爆弾が仕掛けられていた。

---

## 根本原因の発見 — 3つの構造的欠陥

### 爆弾①: HTML ページを precache している

`PRECACHE_URLS` に `/` と `/home` が入っている。これは HTML ページだ。

Next.js の HTML には、そのビルド時点のチャンクハッシュが埋め込まれている。

```html
<script src="/_next/static/chunks/ab8635c6e7470436.js"></script>
```

この HTML を SW がキャッシュした瞬間、「`ab8635c6e7470436.js` が必要な HTML」が永続する。

### 爆弾②: `_next/static/` を cache-first でキャッシュしている

fetch ハンドラでは `_next/static/` への GET リクエストを cache-first で処理する。つまり、一度キャッシュされたチャンクは、次回以降 **ネットワークに触れずに** キャッシュから返される。

### 爆弾③: `CACHE_VERSION` が固定されている

`CACHE_NAME = 'ogoroulette-v1'` は、デプロイをまたいで変わらない。

activate イベントは「古いキャッシュ名のものを削除する」が、`'ogoroulette-v1'` は古くも新しくも同じ名前なので **削除されない**。

---

## エラーの連鎖、完全版

3つの爆弾が組み合わさると、こうなる。

```
1. 初回アクセス
   └─ SW が / と /home の HTML をキャッシュ
   └─ HTML には "ab8635c6e7470436.js" が埋め込まれている

2. 新しいデプロイ（ハッシュが変わる）
   └─ Vercel CDN から ab8635c6e7470436.js が削除される
   └─ 新しい HTML は "cd91f2a3b4e50678.js" を参照する

3. ユーザーがページを開く
   └─ SW が旧 HTML（ab8635c6e7470436.js を参照）をキャッシュから返す
   └─ ブラウザが ab8635c6e7470436.js を要求する
   └─ CDN に存在しない → 404 → ChunkLoadError 💥

4. error.tsx が _r=timestamp 付きでリロード
   └─ SW は URL が変わったのでキャッシュミス → ネットワークへ
   └─ 新しい HTML（cd91f2a3b4e50678.js を参照）が届く
   └─ ただし SW が古いチャンクをキャッシュしていればそちらが返る
   └─ 運が悪ければまたエラー
```

「直ったように見えた」のは、タイムスタンプ付きリロードで SW がキャッシュミスを起こし、たまたま新しい HTML を取得できたからだった。次のデプロイで確実に再発する構造は、何も変わっていなかった。

---

## なぜ localStorage を削除すると直るのか

ユーザー報告にあった「localStorage を消したら直る」は、直接の因果関係ではない。

localStorage を消したあと、ユーザーは手動でページをリロードする。そのリロードのタイミングで `?_r=timestamp` 相当の条件が揃い、SW がキャッシュミスして新しい HTML を取得できた — というのが実際のところだろう。

あるいは、SW の update チェックサイクルと重なって新しい SW が起動するタイミングだったかもしれない。

「局所的に直る」と「根本が直る」は、まったく別の話だ。

> **気づき:** ユーザーの「こうしたら直った」報告は、原因の特定に使えないことがある。再現条件と根本原因を混同しないこと。

---

## 根本解決 — Tombstone SW

解決策はシンプルだった。

Service Worker を「何もしない」ものに差し替える。名前を「Tombstone（墓石）SW」と呼んだ。

```js
// OgoRoulette Service Worker — Tombstone (ISSUE-152)
//
// 旧 sw.js (v1) は HTML ページと _next/static/ チャンクを
// cache-first でキャッシュしていた。デプロイ毎にチャンクハッシュが変わるため、
// 旧 HTML が古いチャンク URL を参照 → CDN から 404 → ChunkLoadError の根本原因。
//
// この tombstone SW はすべての旧キャッシュを削除し、
// 以降の fetch を一切キャッシュしない（ネットワーク直通）。

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

// fetch ハンドラなし — すべてのリクエストはネットワーク直通
```

わずか16行。fetch ハンドラが一切ない。

動作フローはこうなる。

1. **install** — `skipWaiting()` で即座にアクティブ化を開始
2. **activate** — `caches.keys()` で **全キャッシュ名を列挙し、全て削除**。`ogoroulette-v1` も含めて一掃する。その後 `clients.claim()` で全ページを掌握
3. **fetch** — ハンドラなし。ブラウザがネットワークに直接リクエストする

既存ユーザーは次回サイトを開いたとき、ブラウザがバックグラウンドで新しい SW を検出し、インストール・アクティベートする。その瞬間に全キャッシュが消える。

さらに二重保険として、`sw-register.tsx` のクライアントサイドでも明示的にキャッシュを削除した。

```tsx
useEffect(() => {
  if (!("serviceWorker" in navigator)) return

  navigator.serviceWorker.register("/sw.js").catch(() => {})

  // クライアントサイドでも ogoroulette- キャッシュを削除（二重保険）
  if ("caches" in window) {
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("ogoroulette-"))
          .map((key) => caches.delete(key))
      )
    ).catch(() => {})
  }
}, [])
```

万一 SW の更新が遅延しても、JS が動いた時点でキャッシュが消える。

---

## 副産物として判明したこと

Tombstone SW をデプロイした後、別の報告が解消した。

「iPhone Chrome でプリズム演出が表示されない」という問題だ。コードを書き直してデプロイしたはずなのに、iPhone では古い挙動のままだった。

原因は同じだった。旧 SW が `_next/static/chunks/` の古いチャンク（Framer Motion を使った旧バージョン）をキャッシュから返し続けていたのだ。CSS `@keyframes` で書き直した新バージョンは、SW キャッシュの壁を越えられなかった。

Tombstone SW で全キャッシュが消えた瞬間、新チャンクがネットワークから取得され、プリズム演出が初めて動くようになった。

「コードを直してデプロイしたのに、ユーザーに届いていない」— これも SW キャッシュの典型的な症状だった。

> **気づき:** SW はコードよりも長生きする。デプロイしても、SW キャッシュが生きている限りユーザーには旧コードが届く。

---

## 学びのまとめ

**1. ChunkLoadError は「チャンクが存在しない」ことを意味する**

Next.js はビルドごとにチャンクファイルのハッシュを変える。旧ハッシュのチャンクは、新デプロイで CDN から消える。古い HTML を持つブラウザが旧ハッシュを要求すると 404 になる。

**2. Service Worker の cache-first 戦略は、デプロイを無効化できる**

SW がキャッシュした HTML はデプロイをまたいで生き続ける。その HTML が参照するチャンクハッシュは旧バージョンのままなので、新しいチャンクが存在しても旧チャンクへのリクエストが発生し続ける。

**3. `CACHE_VERSION` を固定すると、新旧のキャッシュが区別できない**

`ogoroulette-v1` が変わらない限り、activate イベントは「古いキャッシュ」を見つけられない。旧キャッシュは永続する。

**4. 応急処置は原因を隠すことがある**

タイムスタンプ付きリロードは「たまたま成功する」ことがある。成功が続くと「直った」と勘違いし、根本原因の調査が止まる。

**5. 「直ったように見える」は最も危険なバグの状態**

次のデプロイで確実に再発する。しかも「また発生した」タイミングで、前回の応急処置が「なぜ効かなかったのか」を一から調べ直すことになる。

---

## 次に活かす視点

**SW を使うなら、キャッシュ戦略を慎重に設計する**

- HTML ページ（`/`, `/home`）は precache しない。HTML にはチャンクハッシュが埋め込まれており、デプロイをまたぐと必ず問題が起きる
- `_next/static/` は cache-first にしてよいが、`CACHE_VERSION` はビルド ID（`process.env.NEXT_PUBLIC_BUILD_ID` など）で自動更新すること
- PWA のオフライン対応が不要なら、そもそも SW でキャッシュしないのが最もシンプルで安全

**SW の更新フローを意識する**

新しい SW ファイルをデプロイしても、既存ユーザーへの反映には時間がかかる。`skipWaiting()` と `clients.claim()` の挙動を理解した上で、「既存ユーザーがどのタイミングで新しい SW を受け取るか」を設計に含める。

**応急処置を実装したら、「これは何を隠しているか」を問う**

リトライ機構やキャッシュバイパスを実装したとき、「これが成功するということは、何が起きていたのか」を必ず考える。成功の仕組みを理解しないまま「直った」と判断すると、根本原因を見逃す。

---

## 読者への問い

あなたのプロジェクトの `public/sw.js`（または Service Worker として登録されているファイル）を、最後にちゃんと読んだのはいつですか？

「PWA 対応のためにとりあえず入れた」「どこかのボイラープレートをそのまま使った」— そういう SW が、デプロイのたびにユーザーに旧コードを届け続けているかもしれません。

今すぐ DevTools を開いて、Application → Cache Storage を確認してみてください。思いがけないものがキャッシュされているかもしれません。
