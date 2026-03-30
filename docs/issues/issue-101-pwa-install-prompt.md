# issue-101: PWA インストールプロンプト — ホーム画面追加バナー

## 優先度
High (Retention +2)

## デプロイブロッカー
No

---

## 概要

`manifest.json` と `<link rel="manifest">` はすでに実装済み。
`beforeinstallprompt` イベントを capture してカスタムの「ホーム画面に追加」バナーを
適切なタイミングで表示することで、PWA としてのインストール率を高める。

---

## 既存状態

- `public/manifest.json`: name/short_name/icons/start_url など完備 ✅
- `app/layout.tsx:44`: `<link rel="manifest" href="/manifest.json" />` ✅
- `public/images/icon-192.png`, `icon-512.png`: 存在 ✅
- Service Worker: なし（今回は追加しない）

---

## 実装内容

### `lib/use-pwa-install.ts`

`beforeinstallprompt` をキャプチャし `promptInstall()` を公開するカスタムフック。

```typescript
export function usePWAInstall() {
  // beforeinstallprompt を capture & defer
  // promptInstall() → deferredPrompt.prompt() を呼ぶ
  // installed: display-mode: standalone で動作中は true
  return { canInstall, promptInstall, installed }
}
```

### バナー UI (`app/home/page.tsx`)

`canInstall` が true のとき、画面下部に固定バナーを表示:

```tsx
{canInstall && (
  <div className="fixed bottom-4 ...">
    <span>📱 ホーム画面に追加</span>
    <button onClick={promptInstall}>追加する</button>
  </div>
)}
```

---

## Platform 対応状況

| ブラウザ | beforeinstallprompt | 対応 |
|---------|---------------------|------|
| Chrome Android | ✅ | バナー表示 |
| Chrome Desktop | ✅ | バナー表示 |
| Safari iOS | ❌ | バナーなし（手動のみ） |
| Firefox | 一部 ✅ | バナー表示される場合あり |

---

## 受け入れ条件

- Chrome Android / Desktop でホーム画面への追加バナーが表示される
- バナータップ → ブラウザのネイティブインストールダイアログが表示される
- インストール済み or PWA として動作中はバナーを表示しない
- Safari iOS では何も変化なし（手動「ホーム画面に追加」のみ）
