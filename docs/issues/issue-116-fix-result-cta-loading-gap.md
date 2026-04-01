# ISSUE-116: result CTAをroomCode有時は即表示する（loading非表示を廃止）

## 概要

結果ページ（`/result`）でCTAボタンが1〜2秒間表示されない「空白」期間があった問題を修正する。
SNSからのリンク流入ユーザーが最初の数秒でアクションできない状態を解消する。

---

## 背景

- `roomActive` ステートが `"loading"` の間、CTA全体が非表示になっていた
- ルーム状態確認API（`/api/rooms/:code`）のレスポンスを待つ1〜2秒間、ユーザーはCTAを見られない
- SNSシェアから来訪したユーザーにとって最初の印象が空白画面になる
- `roomCode` がURLパラメータに存在する時点で「参加する」CTAは表示できる

---

## 修正内容

### `app/result/_result-content.tsx`

```tsx
// Before: loading中はCTA非表示
{roomActive === "active" && roomCode && (
  <Button>参加する</Button>
)}
{roomActive === "inactive" && (
  <Button>試してみる</Button>
)}
{/* roomActive === "loading" → 何も表示されない */}

// After: roomCode有時は即表示、loading/activeを統合
{roomActive !== "inactive" && roomCode ? (
  <Button>参加する</Button>
) : (
  <Button>試してみる</Button>
)}
```

- `roomCode` が存在する場合は即座に「参加する」を表示
- ルームが実際にinactiveと確認された時のみ「試してみる」に切り替わる

---

## 影響範囲

- `app/result/_result-content.tsx`
- SNSリンクからの流入ユーザーのCVR改善（CTA空白期間の解消）

---

## ステータス

✅ 完了（commit: 56ddc8a）
