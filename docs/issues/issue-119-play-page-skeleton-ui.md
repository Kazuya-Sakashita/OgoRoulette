# ISSUE-119: playページのローディングをスケルトンUIに改善する

## 概要

`/room/[code]/play` ページのローディング中にスピナーのみが表示される問題を改善し、
コンテンツの形状を予感させるスケルトンUIに変更する。

---

## 背景

- ロード中は中央スピナーのみが表示され、何が来るか分からない
- スケルトンUIはコンテンツ構造を事前に見せることで体感ローディング時間を短縮する
- playページはゲームの「玄関」であり、期待感を高める設計が重要

---

## 修正内容

### `app/room/[code]/play/page.tsx`

スピナーを以下のスケルトンに置き換え:

**ヘッダースケルトン**
```tsx
<div className="animate-pulse">
  {/* 戻るボタン位置 */}
  <div className="w-9 h-9 rounded-xl bg-white/10" />
  {/* タイトル位置 */}
  <div className="flex-1 mx-4">
    <div className="h-5 w-32 bg-white/10 rounded-md mb-1" />
    <div className="h-3 w-20 bg-white/10 rounded-md" />
  </div>
  {/* バッジ位置 */}
  <div className="w-16 h-6 rounded-full bg-white/10" />
</div>
```

**ホイールスケルトン**
```tsx
<div className="animate-pulse flex flex-col items-center gap-6">
  {/* ルーレットホイール位置 */}
  <div className="w-[300px] h-[300px] rounded-full bg-white/10" />
  {/* SPINボタン位置 */}
  <div className="w-full h-14 rounded-2xl bg-white/10" />
</div>
```

---

## 影響範囲

- `app/room/[code]/play/page.tsx`
- ローディング体感時間の短縮
- コンテンツ構造の予告による期待感向上

---

## ステータス

✅ 完了（commit: 0653e21）
