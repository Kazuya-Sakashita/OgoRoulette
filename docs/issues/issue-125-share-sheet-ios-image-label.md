# ISSUE-125: iOS PNG fallback時に「画像シェア」ラベルと説明を表示する

## 概要

iOSで動画録画ができない場合（PNG fallback）、シェアシートのボタンラベルが
「動画をシェア」のままになっている問題を修正する。
実態に合わせて「画像をシェア」に変更し、補足説明も追加する。

---

## 背景

- iOS Safari は `captureStream()` 非対応のため、動画の代わりにPNG画像を生成する（iOS PNG fallback）
- `ShareSheet` コンポーネントのメインボタンが常に「動画をシェア」になっていた
- ユーザーが「動画を共有した」と思ってXを開くと静止画になっており、期待と異なる
- ISSUE-108 で調査した「誤認UX」の延長問題

---

## 修正内容

### `components/share-sheet.tsx`

```tsx
// videoBlob がimage/で始まるならPNG fallback
const isImageBlob = videoBlob?.type.startsWith("image/")

// メインボタンラベルを切り替え
<Button>
  {isImageBlob ? "画像をシェア" : "動画をシェア"}
</Button>

// iOS説明テキストを追加
{isImageBlob && (
  <p className="text-xs text-muted-foreground text-center">
    iPhoneでは静止画で保存されます
  </p>
)}
```

---

## 影響範囲

- `components/share-sheet.tsx`
- iOS ユーザーのシェア体験の正直化
- 「動画と思って開いたら静止画だった」誤認の解消

---

## ステータス

✅ 完了（commit: 949f0a9）
