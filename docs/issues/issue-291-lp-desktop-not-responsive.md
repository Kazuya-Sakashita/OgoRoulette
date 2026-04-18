---
name: ISSUE-291
type: ux
priority: Medium
status: 🔲 未対応
---

# ISSUE-291: Medium — LPページがデスクトップ幅で未対応（480px 固定でサイドに空白が広がる）

## ステータス
🔲 未対応 — デスクトップ（1280px+）で確認。`.container { max-width: 480px }` の固定により、1200px幅では画面の左右に巨大な黒い余白が広がり「作りかけ感」が出る。

## 優先度
**Medium / UX / 第一印象**

## カテゴリ
Design / Responsive / LP / Desktop

---

## 問題

`app/lp/styles.css`:
```css
.container { max-width: 480px; margin: 0 auto; padding: 0 20px; }
```

デスクトップ（1280px）では両サイドに 400px ずつ真っ黒な空白が生じる。
LP はマーケティングページであり、SNS や検索で流入したデスクトップユーザーが最初に見るページ。
「未完成のサイト」という印象を与え、信頼性を下げる。

---

## 影響

- デスクトップからの流入コンバージョン低下
- 信頼性・ブランド品質の低下
- 検索エンジン経由（デスクトップ）ユーザーの離脱

---

## 修正方針

### LP の `.container` にデスクトップ対応を追加

```css
/* 現状 */
.container { max-width: 480px; margin: 0 auto; padding: 0 20px; }

/* 修正案: モバイル中心のままで、デスクトップでは2カラムに展開 */
@media (min-width: 1024px) {
  .lp-hero {
    max-width: 960px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 64px;
    align-items: center;
  }
  .container {
    max-width: 680px;
  }
}
```

または、モバイルファースト設計を維持しつつ背景を活かすアプローチ：

```css
/* 中央カラムは狭いままだが、背景にグラデーションや装飾を追加して
   「意図的なデザイン」として見せる */
.lp-wrapper {
  background: radial-gradient(ellipse at 20% 50%, rgba(249,115,22,0.08) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 20%, rgba(236,72,153,0.06) 0%, transparent 50%),
              #080F1C;
}
```

---

## 受け入れ条件

- [ ] デスクトップ（1280px）で LP が「意図的なデザイン」に見えること
- [ ] モバイル（375px）の見た目が変わらないこと
- [ ] `npm run build` 成功

## 関連ファイル

- `app/lp/page.tsx`
- `app/lp/styles.css`
