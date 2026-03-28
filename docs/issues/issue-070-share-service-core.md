# ISSUE-070: lib/share-service.ts — シェアサービス中核実装

## ステータス
✅ 完了

## 優先度
**High**

## カテゴリ
Engineering / Share

## 概要
シェア機能の中核ロジックを `lib/share-service.ts` に集約する。
各コンポーネントに散在していた URL 生成・テキスト生成・プラットフォーム呼び出しを一元管理。

## 実装した関数

### buildShareUrl(payload: SharePayload): string
`/result?winner=...&color=...` 形式の OGP URL を生成。
winner-card.tsx / share-sheet.tsx の独自実装を廃止。

### buildShareText(template, payload): string
テンプレートと payload からシェアテキストを生成。

### trimForX(text: string): string
URL を含めて 280 字に収まるよう自動トリム。
X の URL は t.co 短縮後に固定 23 字として計算。

### shareToX(text, url): void
`twitter.com/intent/tweet?text=...&url=...` を `noopener,noreferrer` 付きで開く。

### shareToLine(text, url): void
`social-plugins.line.me/lineit/share?url=...&text=...` を開く。

### shareWithFile(payload, text, url): Promise<ShareWithFileResult>
Web Share API による優先順位付きシェア:
1. `navigator.share({ files })` — 動画ファイル込み（iOS 15+ / Android Chrome）
2. `navigator.share({ text, url })` — URL + テキスト fallback
3. `navigator.clipboard.writeText` — コピー fallback

返り値: `"success" | "fallback_url" | "fallback_clipboard" | "cancelled"`

### downloadVideo(blob, winner): void
Blob URL からダウンロードリンクを生成してクリック。
拡張子は blob.type から自動判定（mp4 / webm）。

## 実装ファイル
- `lib/share-service.ts` — 新規作成

## 削除した重複実装
- `share-sheet.tsx` の `getVideoFile()`, `handleDownload()`, `shareToX()`, `shareToLine()`, `shareText` 計算
- `winner-card.tsx` の `buildShareUrl()`, `buildShareText()`, `handleShare()` 内のプラットフォーム呼び出し
