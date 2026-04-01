# ISSUE-136: デモルーレットに割り勘金額とCTAを追加する

## 概要

`app/page.tsx` のデモルーレット結果表示に、当選者が支払う割り勘金額の内訳と
「グループを作って試す →」CTAを追加し、サービスの価値を即座に伝える。

---

## 背景

- デモルーレットは当選者名だけを表示していた
- 「割り勘決め」というユースケースが体験前に伝わらない
- 金額の内訳を見せることで「これがあれば飲み会の精算が楽になる」と直感的に理解できる

---

## 修正内容

### `app/page.tsx`

当選者カードに支払い内訳ブロックを追加：

```tsx
<div className="flex items-center justify-center gap-3 my-3 py-2 rounded-xl bg-white/5">
  <div className="text-center">
    <p className="text-xs text-muted-foreground">合計</p>
    <p className="text-lg font-bold text-foreground">¥4,500</p>
  </div>
  <div className="w-px h-8 bg-white/10" />
  <div className="text-center">
    <p className="text-xs text-muted-foreground">割り勘（3人）</p>
    <p className="text-lg font-bold text-primary">¥1,500</p>
  </div>
</div>
```

CTAボタンのテキストを変更：
- Before: `"ルームを作って試す →"`
- After: `"グループを作って試す →"`

---

## ステータス

✅ 完了（commit: 0830173）
