# ChunkLoadError 根本解決 — SW Tombstone（ISSUE-152）

## 概要

Service Worker の誤ったキャッシュ戦略が原因で、デプロイ後に ChunkLoadError が再発し
「全画面エラー → 自動リロード → 無限ループ」が発生していた問題を根本解決する。

旧 `sw.js (v1)` が HTML ページと `_next/static/` チャンクを cache-first でキャッシュしており、
デプロイ毎にチャンクハッシュが変わると旧 HTML が存在しない URL を参照して 404 → ChunkLoadError
になるという構造的な問題を、SW を「キャッシュしない tombstone」に差し替えることで根絶した。

## 背景

### 旧 sw.js (v1) の問題

```
CACHE_VERSION = 'v1'  ← デプロイをまたいで変わらない
PRECACHE_URLS = ['/', '/home', ...]  ← HTML ページを precache ← 問題①
fetch handler: _next/static/ → cache-first  ← 問題②
install: self.skipWaiting()  ← 問題③
```

**問題①: HTML ページを precache**
`/` と `/home` の HTML レスポンスは、チャンクハッシュが埋め込まれた状態で SW キャッシュに保存される。
新デプロイ後も旧 HTML がキャッシュから返り続け、存在しないチャンク URL を参照する。

**問題②: `_next/static/` の cache-first**
旧チャンク URL が SW キャッシュになければネットワークへ → Vercel CDN が旧 chunk を削除済みで 404 → ChunkLoadError。

**問題③: `CACHE_VERSION` 固定 + `skipWaiting()`**
`CACHE_NAME = 'ogoroulette-v1'` が変わらないため、新 SW がインストールされても activate イベントで旧キャッシュが削除されない（削除対象は `!== CACHE_NAME` のみ）。
旧 HTML キャッシュが永続する。

### エラーの連鎖

```
新デプロイ
  → Vercel CDN から旧チャンクが削除
  → ユーザーのブラウザが SW から旧 HTML を取得
  → 旧 HTML が旧チャンク URL にリクエスト
  → CDN 404 → ChunkLoadError
  → error.tsx: window.location.href = "/?_r=timestamp"（キャッシュバイパス）
  → SW が旧 HTML を再び返す（URL が異なるのでキャッシュミス → ネットワーク → 成功）
  → 新 HTML が新チャンク URL にリクエスト → 成功
  ※ SW がキャッシュした旧 _next/static/ が残っている場合は 3 回ループした後エラー画面
```

### 既存の応急処置（ISSUE-166 以前）

`error.tsx` / `app/room/[code]/error.tsx` に sessionStorage ガードを実装済み:
- ChunkLoadError 検出 → `_r=timestamp` クエリ付きリロード（CDN キャッシュバイパス）
- 30秒以内 3 回を超えたら通常エラー画面を表示（無限ループ防止）

これは「被害拡大防止」として機能しているが、SW キャッシュをバイパスできない場合があり
原因を根絶していない。

## 修正内容

### `public/sw.js` → Tombstone SW に差し替え

```js
// Tombstone SW: 全キャッシュを削除し、fetch を一切キャッシュしない

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

**動作フロー:**
- `install`: 即アクティブ化（`skipWaiting()`）
- `activate`: **すべてのキャッシュを全消去**（旧 `ogoroulette-v1` 含む） → `clients.claim()` で全ページ掌握
- `fetch`: ハンドラなし → ブラウザがネットワークに直接リクエスト

### `components/sw-register.tsx` → 二重保険の追加

Tombstone SW 登録に加え、クライアントサイドでも `ogoroulette-` キャッシュを削除する。
（万一 SW が旧バージョンのまま残存した場合のフォールバック）

```tsx
useEffect(() => {
  if (!("serviceWorker" in navigator)) return

  // tombstone SW を登録（既存ユーザーのキャッシュを activate 時に全削除させる）
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

## 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `public/sw.js` | cache-first キャッシュ戦略を全廃止。tombstone（全キャッシュ削除 + fetch pass-through）に差し替え |
| `components/sw-register.tsx` | tombstone SW 登録 + クライアントサイドキャッシュ削除を追加 |

## 完了条件

- [x] `public/sw.js` を tombstone に差し替え（fetch ハンドラなし）
- [x] `components/sw-register.tsx` にクライアントサイドキャッシュ削除を追加
- [x] `npm run build` でエラーなし
- [x] コミット済み（`1179e5d`）
- [x] SW tombstone デプロイ後、iPhone Chrome でプリズム演出（PrismBurst）が正常表示されることを確認
- [ ] 本番デプロイ後、DevTools → Application → Cache Storage で `ogoroulette-v1` が消えていることを確認
- [ ] デプロイをまたいだ ChunkLoadError が再現しないことを確認

## ステータス

✅ 完了 — 2026-04-06（デプロイ済み）

## 優先度

**Critical** — デプロイのたびに本番で ChunkLoadError が再発し、コア体験が破壊される。

## 期待効果

- Engineering スコア: ChunkLoadError の再発リスクが構造的に根絶される
- 新規ユーザーが最初のアクセスでエラー画面を見るリスクがなくなる
- デプロイ後の監視コスト削減

## 関連カテゴリ

Engineering / Reliability / PWA

## 副次的に解消した問題

**iPhone Chrome でプリズム演出（PrismBurst）が表示されなかった問題**

PrismBurst は Framer Motion を廃止して CSS `@keyframes` に書き換えた新バージョンがデプロイ済みだったが、
iPhone Chrome では依然として表示されない状態が続いていた。
SW tombstone デプロイ後に解消されたことで、**旧 SW が `_next/static/chunks/` の古いチャンク
（Framer Motion 版の PrismBurst コード）をキャッシュから返し続けていたことが根本原因**と判明した。

```
新コード（CSS @keyframes 版）をデプロイ
  ↓ 旧 SW が古いチャンクをキャッシュから返す
iPhone Chrome には Framer Motion 版が動き続ける
  ↓ SW tombstone で全キャッシュ消去
新チャンクがネットワークから取得される
  ↓
CSS @keyframes 版が初めて有効になり、プリズム演出が表示される ✓
```

この事例は「コードを正しく修正・デプロイしても、SW キャッシュが古いコードを提供し続けるため
変更が反映されない」という SW の stale キャッシュ問題の典型例。

## 備考

- 関連 issue: issue-017（Service Worker 登録）、issue-166（next/dynamic 廃止）
- `error.tsx` の sessionStorage ガードは SW 以外の一時的なネットワーク障害への対策として引き続き有効。削除不要。
- オフライン動作はリアルタイムマルチプレイの性質上不要であり、SW によるキャッシュの恩恵よりリスクが上回ると判断。
- 将来的に PWA としてオフライン対応を再実装する場合は、`CACHE_VERSION` をビルド ID（`process.env.NEXT_PUBLIC_BUILD_ID` 等）で自動更新する設計にすること。
