# ISSUE-123: 動画イントロで参加者名を順番にフェードインする

## 概要

動画の参加者イントロ（ルーレット回転前）で全員の名前が一斉に表示される現状を改善し、
名前が順番に（スタッガー）フェードインするアニメーションに変更する。

---

## 背景

- 現状: 全参加者名が同時にフェードイン → 情報量が多く視線が定まらない
- 改善: 名前が0.1秒ずつずれてフェードイン → 一人ずつ「登場する」演出になる
- プレゼン・スポーツ中継での選手紹介演出を参考にした体験

---

## 修正内容

### `components/recording-canvas.tsx`

`drawParticipantsIntro` 関数内:

```ts
participants.forEach((name, i) => {
  // 各参加者のフェードイン開始タイミングをずらす
  const startDelay = 0.08 + i * 0.10  // i=0: 80ms, i=1: 180ms, ...

  if (elapsed < startDelay) return  // まだ表示しない

  const nameAlpha = Math.min((elapsed - startDelay) / 0.12, 1)  // 120msでフェードイン

  ctx.globalAlpha = alpha * nameAlpha
  ctx.fillText(name, x, y)
})
```

- 各名前が `i * 100ms` の遅延でフェードイン開始
- フェードイン自体は120msで完了（短めで歯切れよく）
- `globalAlpha` を `alpha * nameAlpha` として全体フェードと個別フェードを合成

---

## 影響範囲

- `components/recording-canvas.tsx`
- 動画録画のイントロアニメーション
- 参加者数が多いほど効果が顕著

---

## ステータス

✅ 完了（commit: 7c23704）
