# next/dynamic が引き起こした ChunkLoadError 無限ループ

## はじめに

「スマホでは問題ないけど、PC では『予期しないエラーが発生しました』が出る。」

この報告を受けたとき、最初は「PC 固有の何か」を疑った。
画面サイズ？ MediaRecorder の挙動の違い？ それとも Desktop Chrome 固有の問題？

しかし実際の原因は、**2日前に自分が書いたコード**だった。

---

## Lighthouse スコアを上げるために入れた変更

Lighthouse の Performance 評価で「Reduce unused JavaScript — Est savings of 92 KiB」という指摘が出ていた。

対策として、`app/page.tsx` の `RouletteWheel` コンポーネントを `next/dynamic` でレイジーロード化した。

```typescript
// 変更前
import { RouletteWheel } from "@/components/roulette-wheel"

// 変更後
import dynamic from "next/dynamic"
const RouletteWheel = dynamic(
  () => import("@/components/roulette-wheel").then((m) => ({ default: m.RouletteWheel })),
  { ssr: false, loading: () => <div style={{ width: 220, height: 220 }} /> }
)
```

ビルドしてデプロイした。Lighthouse スコアは改善した。

---

## 翌日に届いたエラー報告

数回デプロイを重ねた後、PC でエラーが再現するようになった。
コンソールには次のログが出ていた。

```
GET https://ogo-roulette.vercel.app/_next/static/chunks/ab8635c6e7470436.js
net::ERR_ABORTED 404 (Not Found)

ChunkLoadError: Failed to load chunk /_next/static/chunks/ab8635c6e7470436.js from module 53460
    at turbopack-c4287a02eb0aa28d.js:1:5952
    at async Promise.all (index 0)

[GlobalError] ChunkLoadError: Failed to load chunk /_next/static/chunks/ab8635c6e7470436.js
```

`ab8635c6e7470436.js` — これが `next/dynamic` で生成された `RouletteWheel` 専用チャンクだ。

---

## 何が起きていたか

`next/dynamic` を使うと、対象コンポーネントが **独立した JS チャンク** として切り出される。
チャンクファイル名には **コンテンツハッシュ** が含まれる。

```
デプロイ A → ab8635c6e7470436.js を生成
HTML に参照を埋め込む: /_next/static/chunks/ab8635c6e7470436.js

デプロイ B（コード変更あり）→ チャンクハッシュが変わる → ab8635c6e7470436.js は存在しない
```

ここで問題が発生する。

**ブラウザがデプロイ A の HTML をキャッシュしていた場合**、HTML は `ab8635c6e7470436.js` を参照し続ける。しかしサーバーにはもうそのファイルが存在しない。結果として 404 → `ChunkLoadError` になる。

PC でのみ発生する理由はシンプルだ。PC ユーザーはブラウザのタブを長時間開いたまま放置することが多い。スマホはアプリを閉じると再起動時に新しいページをロードするため、キャッシュした HTML が古くなる前にリフレッシュされやすい。

---

## 最初の修正が無限ループを生んだ

ChunkLoadError が出たとき、まず error boundary で検知してページをリロードする方針にした。

```typescript
useEffect(() => {
  if (isChunkLoadError(error)) {
    window.location.reload()  // これが問題
  }
}, [error])
```

一見正しそうに見える。しかし動作させると、スタックトレースに `uf`/`uc` が **50 回以上**繰り返された。

```
uf @ 4a7ba1279ffa7d21.js:1
uc @ 4a7ba1279ffa7d21.js:1
uf @ 4a7ba1279ffa7d21.js:1
uc @ 4a7ba1279ffa7d21.js:1
... (50回以上)
```

`window.location.reload()` は HTTP キャッシュをバイパスしない。
ブラウザは古い HTML をキャッシュから取得し、同じチャンクを再びリクエストする。
当然 404 → ChunkLoadError → reload → 同じ HTML → 404 → ... と無限ループになった。

---

## 正しい修正は2層構造

問題の根本と派生を分けて考えた。

### 層①: チャンク分割自体をやめる（根本対策）

`next/dynamic` による分割が stale chunk の根源だ。
92KB の削減推定値のために、アプリの信頼性を犠牲にする価値はない。

```typescript
// 静的 import に戻す
import { RouletteWheel } from "@/components/roulette-wheel"
```

これにより `ab8635c6e7470436.js` に相当するチャンクが生成されなくなる。
分割されないチャンクはデプロイをまたいでも 404 にならない。

### 層②: 万が一のフェイルセーフ（future-proof な防衛策）

他の場所で `dynamic()` を使うコードが将来追加されないとも限らない。
ChunkLoadError を完全に封じ込めるために、error boundary 側も改善した。

問題は2つあった。
1. `window.location.reload()` はキャッシュをバイパスしない
2. 無限ループを止める仕組みがない

修正後のコード：

```typescript
useEffect(() => {
  if (!isChunkLoadError(error)) return

  const RELOAD_KEY = "chunk-error-reload-count"
  const RELOAD_WINDOW_MS = 30_000  // 30秒のウィンドウ
  const MAX_RELOADS = 3

  try {
    const raw = sessionStorage.getItem(RELOAD_KEY)
    const data = raw
      ? JSON.parse(raw)
      : { count: 0, since: Date.now() }

    const isExpired = Date.now() - data.since > RELOAD_WINDOW_MS
    const nextCount = isExpired ? 1 : data.count + 1

    if (isExpired || data.count < MAX_RELOADS) {
      sessionStorage.setItem(RELOAD_KEY, JSON.stringify({
        count: nextCount,
        since: isExpired ? Date.now() : data.since,
      }))

      // クエリパラメータでブラウザ/CDN キャッシュをバイパス
      window.location.href =
        window.location.pathname +
        (window.location.search ? window.location.search + "&" : "?") +
        "_r=" + Date.now()
    }
    // 3回を超えたら通常のエラー画面を表示して停止
  } catch {
    // sessionStorage が使えない場合は何もしない
  }
}, [error])
```

2つの改善点がある。

**キャッシュバイパス**: `window.location.reload()` の代わりに `window.location.href` にクエリパラメータ (`_r=timestamp`) を付与する。新しい URL になるのでブラウザと CDN のキャッシュが効かなくなり、必ずサーバーから最新の HTML を取得する。

**無限ループ防止**: sessionStorage でリロード回数と時刻を記録する。30 秒以内に 3 回を超えたらリロードを停止し、通常のエラー画面を表示する。3 回試してもダメなら「そのデプロイが根本的に壊れている」か「別の原因がある」と判断できる。

---

## `next/dynamic` を使う際に注意すべきこと

今回の問題を経て、`next/dynamic` の使い所を整理した。

**適している場面**:
- ページ遷移後にのみ必要なコンポーネント（モーダル、重いエディタ等）
- `ssr: false` が必須なブラウザ専用ライブラリ
- 初期ページロードには絶対に不要なコード

**注意が必要な場面**:
- 「パフォーマンス改善のため」という曖昧な動機での分割
- ページの主要機能を担うコンポーネント（今回の RouletteWheel がこれ）
- デプロイ頻度が高いプロダクション環境

チャンク分割は「初回ロードを速くする」効果がある。しかし **stale deployment 問題** というトレードオフが存在する。デプロイのたびにチャンクハッシュが変わり、古い HTML との不一致が発生しうる。

Lighthouse の「Est savings of 92 KiB」は推定値であり、実測ではない。信頼性を犠牲にする価値のある数字かどうかを判断する必要があった。

---

## まとめ

今回のバグの本質はこうだ：

```
next/dynamic を追加（デプロイ A）
  ↓
チャンク ab8635c6e7470436.js が生成される
  ↓
再デプロイ（デプロイ B）でハッシュが変わる
  ↓
デプロイ A の HTML をキャッシュしている PC のブラウザが
存在しないチャンクを要求 → 404 → ChunkLoadError
  ↓
window.location.reload() でリカバリーしようとしたが
キャッシュをバイパスせず同じ HTML を取得 → 無限ループ
```

修正の核心は2つ。

1. チャンク分割の原因を除去する（`next/dynamic` を静的 import に戻す）
2. 再発時のフェイルセーフをキャッシュバイパス + ループ上限付きで実装する

「Lighthouse スコアを上げたい」という動機は正しい。
しかし「推定値」を信じて信頼性を削るのは本末転倒だ。

スコアと安定性のどちらを優先するかは常に判断が必要だが、
ユーザーに「予期しないエラーが発生しました」を見せないことの方が、
92KB のバンドル削減より重要だった。
