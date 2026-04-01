# ISSUE-137: ランディングページにソーシャルプルーフバッジを追加する

## 概要

`app/page.tsx` の「使い方を見る」リンク上部に、利用シーン・人気を示す
ソーシャルプルーフバッジを追加し、初訪問者の信頼感と興味を高める。

---

## 背景

- 初訪問ユーザーは「本当に使われているのか？」という不安を持つ
- ISSUE-140（プライバシー安心感）と合わせて、CTAクリック率の向上を狙う
- ヘビーな文章ではなく小さなバッジで、スキャン時に目に入る配置が効果的

---

## 修正内容

### `app/page.tsx`

「使い方を見る」リンクの直上に追加：

```tsx
<div className="flex items-center justify-center gap-4">
  <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
    <span>🎰</span>
    <span>飲み会・合コン・社内で人気</span>
  </div>
  <div className="w-px h-3 bg-white/10" />
  <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
    <span>🔒</span>
    <span>本名は公開されません</span>
  </div>
</div>
```

---

## ステータス

✅ 完了（commit: 0830173）
