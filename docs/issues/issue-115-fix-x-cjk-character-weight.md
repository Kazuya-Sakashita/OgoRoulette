# ISSUE-115: X投稿文字数をCJK/emoji 2weightで正確に計算する

## 概要

X（Twitter）はCJK文字・絵文字を2文字分としてカウントするが、
`text.length` による単純な文字数カウントではこれが考慮されず、
実際の投稿可能文字数より多い文字が入力できてしまう問題を修正する。

---

## 背景

- Xの文字数制限は280 "weighted characters"
- ASCII/ラテン文字 = weight 1、CJK（日本語・中国語・韓国語）・絵文字 = weight 2
- `lib/share-service.ts` の `trimForX()` が `text.length` を使っていたため、
  日本語テキストで制限を超過してもトリムされない問題があった
- 実際に投稿すると「文字数オーバー」エラーになるケースがあった

---

## 修正内容

### `lib/share-service.ts`

```ts
/** Xの文字幅計算: CJK/絵文字は2、ASCII等は1 */
function xCharWeight(char: string): number {
  const cp = char.codePointAt(0) ?? 0
  return cp > 0x007E ? 2 : 1
}

function trimForX(text: string, maxWeight = 280): string {
  let weight = 0
  let result = ""
  for (const char of [...text]) {
    const w = xCharWeight(char)
    if (weight + w > maxWeight) break
    weight += w
    result += char
  }
  return result
}
```

- `for...of [...text]` でサロゲートペア（絵文字）を1文字として正しく反復
- コードポイント `> 0x007E`（基本ラテン文字以外）を weight 2 として扱う

---

## 影響範囲

- `lib/share-service.ts` の `trimForX` 関数
- Xシェア時の投稿テキストが正確に280 weighted characters以内に収まる
- 日本語メッセージを含む投稿でのエラー解消

---

## ステータス

✅ 完了（commit: 5a38f0c）
