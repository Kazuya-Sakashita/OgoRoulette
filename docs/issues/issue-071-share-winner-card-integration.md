# ISSUE-071: WinnerCard クイックシェアボタンを share-service に統合

## ステータス
✅ 完了

## 優先度
**Medium**

## カテゴリ
Engineering / Share / Refactor

## 概要
WinnerCard の Phase B（詳細シート）にある X / LINE クイックシェアボタンを
`lib/share-service.ts` に統合し、重複実装を排除する。

## 変更前の問題

WinnerCard は独自に以下を実装していた:
- `buildShareUrl()` — share-sheet.tsx とは異なる URL パラメータ（`treater`, `amount` など余分なキーが混在）
- `buildShareText()` — ローカルの `reaction` 変数を使ったワンオフ実装
- X intent URL を直接 `window.open()` で開く
- LINE intent URL を直接 `window.open()` で開く

## 実装した変更

```typescript
// winner-card.tsx — Before
const buildShareUrl = () => { ... }
const buildShareText = () => { ... }
const handleShare = (platform) => {
  window.open(`https://twitter.com/intent/tweet?text=...`)
}

// winner-card.tsx — After
import { SHARE_TEMPLATES, buildShareUrl, buildShareText, shareToX, shareToLine } from "@/lib/share-service"

const sharePayload = { winner, winnerColor: color, participants, totalBill, treatAmount }
const shareUrl = buildShareUrl(sharePayload)
const defaultTemplate = hasBillInfo
  ? SHARE_TEMPLATES.find((t) => t.id === "bill")!
  : SHARE_TEMPLATES[0]
const shareTextValue = buildShareText(defaultTemplate, sharePayload)

const handleShare = (platform: "x" | "line") => {
  if (platform === "x") shareToX(shareTextValue, shareUrl)
  else shareToLine(shareTextValue, shareUrl)
}
```

## 効果
- URL 生成が share-service に統一され、パラメータの一貫性が保たれる
- X への trimForX() 適用が自動化される（winner-card 経由でも超過しない）
- 金額情報があるときは自動で "金額付き" テンプレートを選択

## 影響範囲
- `components/winner-card.tsx`
