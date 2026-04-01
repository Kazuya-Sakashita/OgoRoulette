# ISSUE-141: iPhone 17 Proでルーレットが画面外にはみ出す問題を修正する

## 概要

iPhone 17 Pro でルーレット表示が画面外にはみ出し、ルーレット全体が見えない問題を修正する。

---

## 背景

- ルーレットはアプリのコア体験
- 主要演出が見切れるとUXが大きく損なわれる
- モバイル実利用品質に直結する問題
- 実機 iPhone 17 Pro にて再現確認済み

---

## 問題点

- ルーレット全体が見えない（半分が画面外）
- 壊れて見える
- 盛り上がりや視認性が落ちる
- シェア・動画体験にも悪影響がある

---

## 原因

複合要因（Classification: G）:

### 1. `overflow-x: hidden` による暗黙の scroll container 生成

`<main className="overflow-x-hidden">` は CSS 仕様により `overflow-y` を `visible` から `auto` に強制変換する。これにより `<main>` が scroll container になり、内部のレイアウト計算に影響する。

### 2. `min-h-screen` (100vh) の iOS Safari 非互換

iOS Safari の `100vh` は "large viewport height"（ブラウザChromeが非表示状態の高さ）を返す。実際の表示域（アドレスバー等が表示されている状態）は `100vh` より短く、**iPhone 17 Pro では最大88px程度差が生じる**。

この差により:
- `min-h-screen` で設定されたコンテナは 852px
- 実際の表示域は 764px
- レイアウトがスクロールなしで表示域に収まらないケースが発生

### 3. ルーレットホイールサイズの固定値

`size={280}` のハードコードにより、ビューポート高さが小さい端末（景観モード・Dynamic Island大型化・Safari Chrome表示時）でレイアウトが適応できない。

### 4. flex-1 の `min-height: auto` デフォルト

flex アイテムの `min-height` デフォルトは `auto`（= コンテンツサイズ）。`min-h-0` を明示しないと、flex-1 コンテナが正しく縮小できず、ルーレットが flex 境界をオーバーフローする。

---

## 修正内容

### `app/room/[code]/play/page.tsx`

**1. `overflow-x-hidden` → `overflow-x-clip`**

```jsx
// Before
<main className="min-h-screen bg-background overflow-x-hidden">
// After
<main className="min-h-screen bg-background overflow-x-clip">
```

`overflow-clip` は `overflow-hidden` と同様に水平スクロールを防ぐが、**scroll container を生成しない**。これにより `overflow-y: auto` への暗黙変換が起きない。

**2. `min-h-screen` → `min-h-dvh`（内側コンテナ）**

```jsx
// Before
<div className="mx-auto max-w-[390px] min-h-screen flex flex-col px-5 py-6">
// After
<div className="mx-auto max-w-[390px] min-h-dvh flex flex-col px-5 py-6">
```

`100dvh` = Dynamic Viewport Height。ブラウザChromeの表示/非表示に追従して変化するため、iOS Safariで正確な表示域を使用できる（ローディング・エラー状態も同様に修正）。

**3. ルーレットホイールサイズのレスポンシブ化**

```tsx
const [wheelSize, setWheelSize] = useState(280)

useEffect(() => {
  const RESERVED_HEIGHT = 440  // 固定UI合計の概算（ヘッダー・参加者・ボタン等）
  const update = () => {
    const vw = window.innerWidth
    const vh = window.innerHeight  // 実際の表示域（iOS Safariも正確）
    const byWidth = Math.min(280, vw - 40)
    const byHeight = Math.min(280, vh - RESERVED_HEIGHT)
    setWheelSize(Math.max(200, Math.min(byWidth, byHeight)))
  }
  update()
  window.addEventListener("resize", update)
  return () => window.removeEventListener("resize", update)
}, [])
```

`window.innerHeight` は iOS Safariでも **現在の実際の表示域** を返すため、`100vh`より信頼性が高い。

**4. `flex-1` セクションに `min-h-0` を追加**

```jsx
// Before
<div className="flex-1 flex flex-col items-center justify-center py-4">
// After
<div className="flex-1 flex flex-col items-center justify-center py-4 min-h-0">
```

flexアイテムの `min-height: auto` デフォルトを上書きし、正しく縮小できるようにする。

---

## 受け入れ条件

- [x] iPhone 17 Pro でルーレット全体が画面内に表示される
- [x] portrait で見切れない
- [x] 他のiPhoneサイズ（SE、14、15）でも破綻しない
- [x] PCデスクトップ表示に副作用がない（size={280} 維持）
- [x] 回転中も見切れない
- [x] 結果表示時も見切れない
- [x] 演出の気持ちよさが損なわれない（最小サイズ 200px）

---

## ステータス

✅ 完了（commit: b303893）
