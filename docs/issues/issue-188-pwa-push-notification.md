# PWAプッシュ通知（飲み会リマインダー）

## 背景

HEART Retention（14/20）・AARRR Retention（14/20）の最大ボトルネックが「再訪トリガーの欠落」。ISSUE-182 でグループ再開CTAを実装したが、ユーザーが自発的にアプリを開くきっかけがない。PWAプッシュ通知により「次の飲み会前に思い出してもらう」体験を実現する。

## 問題

- Service Worker は tombstone（最小化）版のため、プッシュ通知は未対応
- オプトインUI 未実装
- 「次の飲み会の日程」を設定する手段がない
- 週次リマインダーの配信基盤がない

## 目的

- HEART Retention を 14 → 18 (+4) に改善
- AARRR Retention を 14 → 18 (+4) に改善
- NSM（週次完走ルーム数）を向上させる

## 対応内容

### Step 1: Service Worker 分割設計

既存の `public/sw.js`（tombstone版）はそのまま維持し、プッシュ通知専用SWを別エントリーポイントとして追加する。

```javascript
// public/push-sw.js（新規）
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? "OgoRoulette", {
      body: data.body ?? "今週は誰が奢る？",
      icon: "/images/logo-icon.png",
      badge: "/images/logo-icon.png",
      data: { url: data.url ?? "/home" },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data.url))
})
```

### Step 2: クライアント側オプトインUI

```typescript
// lib/use-push-notification.ts（新規）
export function usePushNotification() {
  const subscribe = async (): Promise<PushSubscription | null> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null

    const registration = await navigator.serviceWorker.register("/push-sw.js")
    const permission = await Notification.requestPermission()
    if (permission !== "granted") return null

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    })
    return subscription
  }
  return { subscribe }
}
```

```typescript
// components/winner-card.tsx のグループ保存後
// 「次の飲み会前に通知しますか？」というPromptを表示
// → オプトイン → /api/push/subscribe に subscription を送信
```

### Step 3: バックエンド

```typescript
// app/api/push/subscribe/route.ts（新規）
// PushSubscription を DB に保存

// app/api/push/send/route.ts（新規）
// Vercel Cron / 手動トリガーで通知送信
// web-push ライブラリを使用
```

### Step 4: Vercel Cron 設定

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/push/send",
      "schedule": "0 9 * * 5"  // 毎週金曜9時
    }
  ]
}
```

### Step 5: VAPID鍵の生成

```bash
# ローカルで1回だけ実行
npx web-push generate-vapid-keys

# Vercel環境変数に設定
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
```

## 完了条件

- [ ] PWAインストール後にプッシュ通知許可ダイアログが表示される
- [ ] グループ保存後に「通知を受け取る」プロンプトが表示される
- [ ] オプトインしたユーザーに週次通知が届く（金曜朝）
- [ ] 通知タップでホーム画面が開く
- [ ] iOS Safari（16.4+）・Android Chrome で動作確認済み
- [ ] `npm run build` でエラーなし

## 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `public/push-sw.js` | 新規作成（プッシュ通知専用SW） |
| `lib/use-push-notification.ts` | 新規作成 |
| `app/api/push/subscribe/route.ts` | 新規作成 |
| `app/api/push/send/route.ts` | 新規作成 |
| `vercel.json` | Cron設定追加 |
| `components/winner-card.tsx` | オプトインUI追加 |
| `prisma/schema.prisma` | PushSubscription モデル追加 |

## リスク

**中**。
- Service Worker 二重登録に注意（tombstone との共存設計が必要）
- iOS Safari は iOS 16.4+ のみ対応（対象ユーザーの一部はiOS 16未満で使えない）
- VAPID鍵の管理（環境変数の厳重管理が必要）
- Vercel Cron は Pro プランのみ（無料プランではCron数に制限あり）

## ステータス

**未着手** — 2026-04-04

## 優先度

**Recommended** — Retention の最大改善施策。実装コストが高い（推定8〜12時間）ため、ISSUE-186/187/190 の後に着手。

## 期待効果

- HEART Retention: 14 → 18 (+4)
- AARRR Retention: 14 → 18 (+4)
- 総合スコア: 71 → 74 (+3)

## 関連ISSUE

- issue-016（PWAプッシュ通知 初期設計）
- issue-101（PWAインストールプロンプト）
- issue-182（リテンション再開CTA）
