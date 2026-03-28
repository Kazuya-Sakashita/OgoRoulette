# ISSUE-067: SharePayload — 共通シェアデータ構造の設計

## ステータス
✅ 完了

## 優先度
**High（他 Issue の前提）**

## カテゴリ
Architecture / Share

## 概要
シェア機能全体で使う共通データ構造 `SharePayload` を設計・実装する。
プラットフォームごとに散在していた URL 生成・テキスト生成ロジックを `lib/share-service.ts` に集約。

## 実装した構造

```typescript
// lib/share-service.ts

export interface SharePayload {
  winner: string          // 当選者名
  winnerColor?: string    // セグメントカラー（OG URL 用）
  participants?: string[] // メンバー一覧（"グループ" テンプレート用）
  totalBill?: number      // 合計金額（"金額付き" テンプレート用）
  treatAmount?: number    // 奢り金額
  roomName?: string       // ルーム名（将来の拡張用）
  videoBlob?: Blob | null // 録画動画（Web Share API でファイル共有）
}
```

## buildShareUrl の統一

`winner-card.tsx` の独自 `buildShareUrl()` と `share-sheet.tsx` の独自 URL 生成を廃止。
`lib/share-service.ts` の `buildShareUrl(payload)` に一本化した。

生成 URL: `${origin}/result?winner=...&color=...&participants=...&total=...&treat=...`

## 影響範囲
- `lib/share-service.ts` — 新規作成（SharePayload, buildShareUrl, buildShareText, shareToX, shareToLine, shareWithFile, downloadVideo）
- `components/share-sheet.tsx` — share-service を import、独自実装を削除
- `components/winner-card.tsx` — share-service を import、独自実装を削除
