# 「ページを閉じた」を検知する：sendBeacon でルーレット途中離脱問題を解決した

## 目次

1. [どんな問題だったか](#どんな問題だったか)
2. [なぜ普通の fetch では解決できないのか](#なぜ普通の-fetch-では解決できないのか)
3. [sendBeacon とは何か](#sendbeacon-とは何か)
4. [実装コード](#実装コード)
5. [sendBeacon の制限とゲストトークン問題](#sendbeacon-の制限)
6. [学び](#学び)

---

## どんな問題だったか

ルーレットアプリで、オーナー（ルームを作った人）がルーレットのアニメーション中（約10秒）にブラウザを閉じると、**ルームが永久に「スピン中」のまま固まる**という問題があった。

```
スピン開始 → アニメーション中に閉じる → ルームが IN_SESSION で停止

→ 以後、誰も「スピン」ボタンを押せない（409: 進行中と言われ続ける）
```

特に「常設グループ」（有効期限のない繰り返し使うルーム）では、このまま永久に使えなくなる深刻な問題だった。

---

## なぜ普通の fetch では解決できないのか

「ページを閉じるとき、クリーンアップのリクエストを送ればいい」と考える。

```javascript
window.addEventListener("beforeunload", () => {
  fetch("/api/rooms/reset", { method: "POST" })  // ← これでは動かない
})
```

**これはほとんどのブラウザで動作しない。**

`beforeunload` イベントが発火したとき、ブラウザはページを破棄しようとしている。非同期の `fetch` は完了を待たずにキャンセルされてしまう。

「ページを閉じるときにリクエストを送る」は、ブラウザの制約上とても難しい問題だ。

---

## sendBeacon とは何か

`navigator.sendBeacon()` はこの問題のために存在するブラウザ API だ。

```javascript
navigator.sendBeacon(url, data)
```

通常の `fetch` との違い：

| | fetch | sendBeacon |
|---|---|---|
| 非同期完了の保証 | ページ閉じると中断される | **ページを閉じても送信を保証** |
| レスポンスの取得 | できる | できない（一方通行） |
| リクエストのキャンセル | できる | **できない**（送ったら止められない） |
| カスタムヘッダー | 自由に設定可能 | **制限あり**（後述） |
| メソッド | 自由 | **POST 固定** |

`sendBeacon` はレスポンスを受け取れない「撃ちっぱなし」のリクエストだ。「送ったことだけ保証する」ために設計されており、ページ破棄後もブラウザがバックグラウンドでリクエストを完了させる。

---

## 実装コード

### `play/page.tsx` — スピン中のみ pagehide で sendBeacon を送る

```typescript
useEffect(() => {
  // スピン中またはスピン準備中、かつオーナーのみ
  if (phase !== "spinning" && phase !== "preparing") return
  if (!isOwner) return

  const handlePageHide = () => {
    // ページが閉じられたとき /reset にビーコンを送る
    navigator.sendBeacon(`/api/rooms/${code}/reset`)
  }

  // pagehide イベントで検知（beforeunload より信頼性が高い）
  window.addEventListener("pagehide", handlePageHide)
  return () => window.removeEventListener("pagehide", handlePageHide)
}, [phase, isOwner, code])
```

**`beforeunload` ではなく `pagehide` を使う理由：**

`beforeunload` はキャンセルできる（`preventDefault()` でダイアログを出せる）。一方 `pagehide` はページが実際に非表示になるタイミングで必ず発火する。モバイルのタブ切り替えなどでも `pagehide` は発火するため、信頼性が高い。

### `phase !== "spinning"` の条件が重要

ビーコンはスピン中にだけ送る。通常のページ離脱（スピン後や待機中）でリセットを送ると、正常な操作が妨害される。

`useEffect` の依存配列に `phase` を入れることで、フェーズが変わるたびに effect が再実行され、リスナーが付け直される。スピンが終われば `phase` が変わり、リスナーが外れる。

---

## sendBeacon の制限

### カスタムヘッダーが送れない

`sendBeacon` はシンプルな POST リクエストしか送れない。認証ヘッダー（`Authorization: Bearer ...`）などのカスタムヘッダーを付けられない。

このアプリではゲストユーザーの認証に「ゲストトークン（Cookie ではなくカスタムヘッダーで送っていた）」を使っていた。

```typescript
// 通常の fetch では送れていたヘッダー
fetch("/api/rooms/reset", {
  headers: {
    "x-guest-token": guestToken  // ← sendBeacon では送れない
  }
})
```

**解決策：ゲストトークンを JSON body に含める**

```typescript
// ゲストトークンを body の JSON に含める
const payload = JSON.stringify({ guestToken })
navigator.sendBeacon(`/api/rooms/${code}/reset`, new Blob([payload], { type: "application/json" }))
```

サーバー側でもヘッダーだけでなく、body からもゲストトークンを読むように修正した：

```typescript
// app/api/rooms/[code]/reset/route.ts
export async function POST(request: NextRequest) {
  // ヘッダーから（通常の fetch の場合）
  let guestToken = request.headers.get("x-guest-token")

  // body から（sendBeacon の場合）
  if (!guestToken) {
    try {
      const body = await request.json()
      guestToken = body?.guestToken ?? null
    } catch {
      // body なしの場合は null のまま
    }
  }
  ...
}
```

---

## 学び

### 1. ページ離脱時のリクエストには `sendBeacon` を使う

`beforeunload` での `fetch` は動かないと思っていい。「ページを閉じるときに何かをサーバーに通知したい」場合は `sendBeacon` を使う。

使いどころ：
- アナリティクス（「ここまで読んだ」の記録）
- セッション終了の通知
- 今回のような「処理中断のクリーンアップ」

### 2. `pagehide` は `beforeunload` より信頼性が高い

`pagehide` はページが実際に非表示になるタイミングで発火する。モバイルブラウザのバックグラウンド移行でも動作する。ページ離脱の検知には `pagehide` が推奨される。

### 3. sendBeacon はレスポンスを受け取れない

「送ったことは保証するが、結果は分からない」という設計だ。リトライや失敗時の処理が書けないため、サーバー側で冪等（何度実行しても同じ結果）な API を作る必要がある。

今回の `/reset` は「WAITING 状態に戻す」だけの操作なので、何度呼ばれても問題ない。

### 4. クライアント側の対策だけでは完全ではない

`sendBeacon` はあくまで「ベストエフォート」だ。ネットワークが切断されていたり、ブラウザがクラッシュしたりすると届かない。

完全な解決策はサーバー側の定期クリーンアップ（Cron ジョブ）と組み合わせることだ。「スピン開始から60秒以上 IN_SESSION のルームを自動リセットする」Cron を追加すれば、クライアント側の対策が失敗しても1分以内に自動回収できる。

---

## まとめ

「ページを閉じた」を確実に検知してサーバーにリクエストを送るには：

- `beforeunload` での `fetch` は動かない
- `pagehide` + `navigator.sendBeacon()` が正しい選択
- カスタムヘッダーが送れないので、トークンなどは body に含める
- sendBeacon はレスポンスが取れないので、API は冪等にする
- 完全な信頼性が必要なら、サーバー側の定期クリーンアップとセットにする

---

## タイトル案

1. ページを閉じた瞬間にサーバーへ通知する：sendBeacon の使い方と落とし穴
2. beforeunload の fetch は動かない：sendBeacon でページ離脱を確実に検知する
3. ルーレット途中にタブを閉じたら壊れた：pagehide + sendBeacon で解決
4. 「撃ちっぱなし」のリクエスト：sendBeacon の設計思想と実装上の注意点
5. アニメーション中にページを閉じると IN_SESSION で固まる問題を直した

---

## SNS 投稿文

```
ルーレットのアニメーション中にブラウザを閉じると、ルームが永久に固まるバグがあった。

解決策: pagehide + sendBeacon

window.addEventListener("pagehide", () => {
  navigator.sendBeacon("/api/rooms/reset")
})

beforeunload での fetch はブラウザに強制終了される。
sendBeacon はページ破棄後もブラウザが送信を完了させてくれる。

落とし穴: カスタムヘッダーが送れないので、トークンは body に入れる必要があった。
```
