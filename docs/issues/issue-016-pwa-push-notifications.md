# [ISSUE-016] PWA 対応とプッシュ通知によるリエンゲージメント基盤の構築

## 🧩 概要

OgoRoulette には現在、ホーム画面追加（PWA）対応とプッシュ通知機能がない。「飲み会の後にアプリを閉じたらそれっきり」というサイクルになっており、リエンゲージメントの手段がない。PWA + プッシュ通知により、ユーザーが再訪問するきっかけを作る。

## 🚨 背景 / なぜ問題か

**現状の問題:**
- ブラウザアプリのためホーム画面アイコンがなく、再訪問の障壁が高い
- 「また今度使おう」と思ってもアプリを見つけられない
- 競合アプリがあれば次回は別のアプリを選ぶ可能性がある
- プッシュ通知ができないため、以下の通知が不可能:
  - 「友達があなたをルームに招待しました」
  - 「今週の飲み会の幹事さんへ: OgoRoulette を使いましょう！」
  - 「〇〇さんが 10 回目の奢りになりました！」

## 🎯 目的

Web Push 対応 PWA を実装し、ユーザーがホーム画面に追加した後もプッシュ通知で呼び戻せるリエンゲージメント基盤を作る。

## 🔍 影響範囲

- **対象機能:** アプリのインストール導線・通知基盤
- **新規ファイル:** `public/manifest.json`、`public/sw.js`（Service Worker）、`app/api/push/route.ts`

## 🛠 修正方針

**Step 1: PWA manifest.json の追加**

```json
// public/manifest.json
{
  "name": "OgoRoulette",
  "short_name": "OgoRoulette",
  "description": "おごりをルーレットで決めよう",
  "start_url": "/home",
  "display": "standalone",
  "background_color": "#0B1B2B",
  "theme_color": "#F97316",
  "icons": [
    { "src": "/images/logo-icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/images/logo-icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Step 2: Web Push の実装**

```tsx
// hooks/usePushNotification.ts
export function usePushNotification() {
  const subscribe = async () => {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    })
    // サーバーに subscription を保存
    await fetch("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify(subscription),
    })
  }

  return { subscribe }
}
```

**通知タイミング候補（優先度順）:**
1. ルームへの招待（「〇〇さんがルームに招待しました」）
2. スピン完了（非オーナーへの結果通知）
3. 週次リマインダー（「今週も飲み会はありますか？」）

## ⚠️ リスク / 副作用

- iOS Safari の Web Push は iOS 16.4 以降のみサポート（ホーム画面追加が必要）
- 通知許可ダイアログは一度拒否されると再表示が困難。適切なタイミング（スピン完了後等）に表示する
- VAPID キー（`web-push` ライブラリで生成）の管理が必要

## ✅ 確認項目

- [ ] Android Chrome でホーム画面への追加プロンプトが表示される
- [ ] PWA としてインストール後、スタンドアロンモードで起動する
- [ ] プッシュ通知の許可を求めるダイアログが表示される
- [ ] テスト通知が端末に届く

## 🧪 テスト観点

**手動確認:**
1. Android Chrome でサイトを開く → 「ホーム画面に追加」プロンプトが表示される
2. iOS Safari（16.4+）でホーム画面追加 → スタンドアロンモードで起動
3. 通知許可 → テスト通知送信 → 端末に届く

## 📌 受け入れ条件（Acceptance Criteria）

- [ ] `public/manifest.json` が配置され、PWA のホーム画面追加が機能する
- [ ] プッシュ通知の購読・送信の基盤 API が実装される
- [ ] 少なくとも 1 種類の通知（ルーム招待またはスピン完了）が実際に送られる

## 🏷 優先度

**Low**（重要だが Critical・High・Medium を優先）

## 📅 実装順序

**16番目**（収益化フェーズ前に実装）

## 🔗 関連Issue

- [ISSUE-014] 常設グループ機能（通知との相乗効果）
