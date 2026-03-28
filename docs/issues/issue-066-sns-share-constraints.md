# ISSUE-066: SNS シェア制約の整理と共通設計方針

## ステータス
✅ 完了

## 優先度
**High（設計基盤 — 他 Issue の前提）**

## カテゴリ
SNS / Share / Architecture

## 概要
X・LINE・Web Share API の制約を整理し、動画シェアを含む共通設計方針を決定する。

## 各プラットフォーム制約

| 項目 | X (Twitter intent) | LINE (social plugins) | Web Share API |
|------|-------------------|-----------------------|---------------|
| テキスト | ✅ 最大 280 字（URL = 23 字固定換算） | ✅ 制限あり | ✅ |
| URL | ✅ | ✅ | ✅ |
| 動画ファイル | ❌ intent URL では不可 | ❌ intent URL では不可 | ✅ iOS 15+ / Android Chrome（MP4 推奨） |
| 画像 | ❌ intent URL では不可 | ❌ | ✅ |

## 決定した設計方針

### 動画シェア
- **Primary CTA**: Web Share API (`navigator.share({ files })`) — ネイティブシェアシートで動画をそのまま渡せる
  - iOS: H.264 MP4 形式が必要（ISSUE-007 対応済み Step 1）
  - Android Chrome: WebM / MP4 どちらも可
- **Fallback 1**: URL + テキストの Web Share API
- **Fallback 2**: クリップボードコピー

### X / LINE ボタン
- テキスト + URL のみ。動画は「まず保存して手動でアップ」という UX
- X: `twitter.com/intent/tweet?text=...&url=...`
- LINE: `social-plugins.line.me/lineit/share?url=...&text=...`
- ボタンの tooltip/説明文で「テキストのみ（動画なし）」を明示

### 文字数管理
- X: `trimForX()` で text + URL が 280 字以内に収まるよう自動トリム
- URL コストは常に 23 字として計算（t.co 短縮後の固定コスト）

## 実装ファイル
- `lib/share-service.ts` — 制約ロジックと trimForX() を集約
- `components/share-sheet.tsx` — UI
- `components/winner-card.tsx` — クイックシェアボタン

## 参考
- X intent URL 仕様: https://developer.twitter.com/en/docs/twitter-for-websites/tweet-button/guides/web-intent
- LINE Social Plugins: https://developers.line.biz/en/docs/line-social-plugins/install-guide/sharing-links/
