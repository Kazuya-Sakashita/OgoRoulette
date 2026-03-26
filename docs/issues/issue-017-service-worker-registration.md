# issue-017: Service Worker の実装と登録

## 概要

PWA プッシュ通知の前提となる Service Worker (`public/sw.js`) を実装し、Next.js アプリに登録する。

## 背景

Web Push 通知を受け取るにはブラウザが Service Worker を登録している必要がある。現在 `manifest.json` は存在するが SW がないため、インストールは可能でも通知受信は不可能な状態。

## 問題

- `public/sw.js` が存在しない
- Next.js は Service Worker を自動登録しないため、クライアントサイドで明示的に登録処理が必要
- `push` イベント・`notificationclick` イベントのハンドラが未実装

## 対応内容

- [ ] `public/sw.js` を作成し `push` / `notificationclick` イベントを実装
- [ ] `app/layout.tsx` または専用フックで `navigator.serviceWorker.register('/sw.js')` を呼ぶ
- [ ] SW の更新戦略（skipWaiting / clients.claim）を設定する
- [ ] 開発環境での SW デバッグ手順をコメントで記載する

```js
// public/sw.js（最小構成）
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'OgoRoulette', {
      body: data.body,
      icon: '/images/logo-icon.png',
      badge: '/images/logo-icon.png',
      data: { url: data.url ?? '/home' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data.url))
})
```

## 優先度

High

## 理由

ISSUE-020（購読 API）・ISSUE-021（フック）はすべて SW の存在を前提にする。SW がなければ push 通知全体が機能しない。依存関係の最上流。

## 影響範囲

- 対象ファイル: `public/sw.js`（新規）、`app/layout.tsx`
- 対象機能: PWA 全体・プッシュ通知受信

## 依存関係

なし（ISSUE-016 Step 1 の manifest.json 実装済みが前提）

## 完了条件

- Chrome DevTools → Application → Service Workers で SW が `activated` 状態になる
- `push` イベントを DevTools から手動送信したとき端末に通知が表示される
- ページリロード後も SW が維持される
