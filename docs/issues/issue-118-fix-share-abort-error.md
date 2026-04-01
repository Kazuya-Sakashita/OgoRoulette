# ISSUE-118: navigator.share() キャンセル時のエラーをサイレント処理する

## 概要

`navigator.share()` でユーザーがシェアシートをキャンセルした際に `AbortError` が発生し、
エラーログが出力される問題を修正する。キャンセルは正常な操作フローとして扱う。

---

## 背景

- `navigator.share()` はユーザーがシェアシートを閉じると `AbortError` を throw する
- この `AbortError` はユーザーの意図的なキャンセルであり、エラーではない
- `.catch(() => {})` による無音処理も問題（ISSUE-110参照）だが、AbortError は特別扱いが適切

---

## 修正内容

### `app/result/_result-content.tsx`（およびシェア呼び出し箇所）

```ts
// Before
navigator.share(shareData).catch(() => {})

// After
navigator.share(shareData).catch((e) => {
  if (e.name !== "AbortError") {
    console.warn("[OgoRoulette] share failed:", e)
  }
})
```

- `AbortError`（ユーザーキャンセル）は完全にサイレント
- その他の予期しないエラー（`NotAllowedError` など）は `console.warn` で記録

---

## 影響範囲

- `app/result/_result-content.tsx`
- シェアキャンセル時の不要なエラーログ解消
- 予期しないシェアエラーの把握能力は維持

---

## ステータス

✅ 完了（commit: c6813e1）
