# Routing — OgoRoulette ルーティング設計

## ページ構成

```
/                    → ウェルカム（デモルーレット + OAuth）
/home                → ホーム（グループ一覧・履歴）
/lp                  → ランディングページ（SEO）
/how-to-use          → 使い方
/room/create         → ルーム作成
/room/[code]         → ロビー（QR表示・メンバー待機）
/room/[code]/play    → プレイ（ルーレット・スピン）
/join                → QRスキャン後の参加フロー
/scan                → QRスキャナー
/result              → 結果シェアページ
/history             → スピン履歴
/auth/login          → ログイン
/auth/callback       → OAuth コールバック
/privacy /terms      → 法的ページ
```

## エラーバウンダリ

- `app/error.tsx` — グローバル（ChunkLoadError 自動リロード）
- `app/room/[code]/error.tsx` — ルーム専用（同様の処理）
- それ以下のページにはバウンダリなし

## ChunkLoadError 対応（解決済み）

```ts
// app/error.tsx
const isChunkLoadError = (e: Error) =>
  e.name === "ChunkLoadError" ||
  e.message?.includes("Failed to load chunk") ||
  e.message?.includes("dynamically imported module")

// sessionStorage でリロード回数制限（30秒以内3回まで）
// SW Tombstone で古いキャッシュを全削除
```

## セーフリダイレクト

```ts
// lib/safe-redirect.ts — ISSUE-180 実装済み
// 許可パス: /home, /room/, /how-to-use, /lp のみ
// プロトコル相対URL・JavaScriptスキームはブロック
```

## Middleware

- `/protected` 配下の未認証アクセスを `/auth/login` にリダイレクト
- Supabase セッション Cookie を毎リクエスト更新（Fluid Compute 対応）
