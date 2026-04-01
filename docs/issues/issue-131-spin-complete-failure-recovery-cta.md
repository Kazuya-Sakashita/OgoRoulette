# ISSUE-131: spin-complete全失敗後のユーザー向けエラー通知とリカバリCTA

## 概要

spin-complete APIがretry全滅後に `console.error` + `setSpinError` で止まっていたが、
エラーメッセージに「ページを再読み込みする」ボタンを追加し、ユーザーが自力で復旧できるようにする。

---

## 背景

- ISSUE-005でretry付きspin-completeを実装済み
- 全retry失敗時は `setSpinError("結果の保存に失敗しました。ページを再読み込みしてください")` を呼ぶ
- しかしエラーテキストだけでは、モバイルユーザーが「どうすれば再読み込みできるか」が分からない
- 明示的なボタンでワンタップ復旧を可能にする

---

## 修正内容

### `app/room/[code]/play/page.tsx`

```tsx
{spinError && (
  <div className="flex flex-col items-center gap-2 mb-3 px-4">
    <p className="text-sm text-red-400 text-center">{spinError}</p>
    {spinError.includes("再読み込み") && (
      <button
        onClick={() => window.location.reload()}
        className="text-xs text-primary hover:underline"
      >
        ページを再読み込みする →
      </button>
    )}
  </div>
)}
```

---

## ステータス

✅ 完了（commit: 0830173）
