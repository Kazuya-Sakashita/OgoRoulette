# ISSUE-111: 演出タイムアウト定数をconstants.tsに集約する

## 概要

play ページや recording canvas に散在していた演出タイミング定数（マジックナンバー）を
`lib/constants.ts` に集約し、一元管理できるようにする。

---

## 背景

- 録画タイミング・アニメーション時間が複数ファイルにハードコードされていた
- 例: `1500`, `3000`, `500` などのマジックナンバーが意図不明
- 変更時に複数箇所を修正する必要があり、不整合が生じやすい

---

## 修正内容

### `lib/constants.ts` に追加

```ts
/** ホイール回転前のイントロ演出の長さ（秒） */
export const INTRO_DURATION_S = 1.5

/** カウントダウン演出の長さ（秒） */
export const COUNTDOWN_DURATION_S = 3.0

/** 当選者発表後のバウンスアニメーション時間（ms） */
export const BOUNCE_DURATION_MS = 500

/** 当選者名フェードイン前の無音の溜め（ms） */
export const SILENCE_BEFORE_REVEAL_MS = 500

/** 紙吹雪エフェクトの表示時間（ms） */
export const CONFETTI_DURATION_MS = 4000
```

---

## 影響範囲

- `components/recording-canvas.tsx` — `SILENCE_BEFORE_REVEAL_MS` を参照（ISSUE-122）
- 今後の演出調整が定数変更1箇所で完結する

---

## ステータス

✅ 完了（commit: 1c68e2e）
