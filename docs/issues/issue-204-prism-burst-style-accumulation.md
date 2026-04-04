# ISSUE-204: PrismBurst が @keyframes を DOM に蓄積する（潜在的メモリリーク）

## ステータス
🔴 未着手

## 優先度
**Major**

## カテゴリ
Bug / Performance / Memory

## 概要
`components/prism-burst.tsx` は毎インスタンスごとにランダムキー `k` を生成し、固有の `@keyframes pb-r${i}-${k}` を `dangerouslySetInnerHTML` で `<style>` タグとして注入する。コンポーネントが React ツリーから外れると style タグは削除されるが、portal 経由で DOM 外に注入された場合や、ブラウザのスタイルシート最大数制限に達した場合に問題になる。

## 問題のコード

```typescript
// components/prism-burst.tsx:28-44
@keyframes pb-r${i}-${k} { ... }
@keyframes pb-flash-${k} { ... }
@keyframes pb-aurora-${k} { ... }

// components/prism-burst.tsx:104
<style dangerouslySetInnerHTML={{ __html: buildKeyframes(k) }} />
```

毎スピン（当選演出）で PrismBurst がマウントされるため、スピン10回で 30+ の固有 @keyframes セットが生成される。

## 影響
- 長時間の連続使用でスタイルシートが肥大化する
- Chrome は CSSStyleSheet に最大 65,536 ルールの制限があるため、長時間使用で CSS 解析が遅くなる可能性
- iOS Chrome（WKWebView）で GPU コンポジション問題が報告されている

## 修正方針

### Option A: 固定キーを使う（推奨・工数小）
インスタンスごとのランダムキーをやめ、固定の keyframe 名を使う。
同時に複数の PrismBurst は起動しない前提（当選演出は同時1つのみ）。

```typescript
// k の生成を廃止し、固定文字列を使用
const buildKeyframes = () => `
  @keyframes pb-r0 { ... }
  @keyframes pb-flash { ... }
  @keyframes pb-aurora { ... }
`
```

### Option B: `document.adoptedStyleSheets` で共有シートを使う
`CSSStyleSheet` を一度だけ構築して `document.adoptedStyleSheets` に追加し、再利用する。
コンポーネントアンマウント時に削除する。

### Option C: Tailwind/CSS Modules で静的 keyframe を定義する
アニメーションを CSS ファイルに移動してビルド時に静的化する。

## 影響ファイル
- `components/prism-burst.tsx` — keyframe 生成・注入ロジック全体

## 参照
- ISSUE-200（第4回評価）で BUG-04 として特定
