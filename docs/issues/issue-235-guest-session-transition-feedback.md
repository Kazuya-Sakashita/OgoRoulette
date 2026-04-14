# ISSUE-235: UX改善(P2) — 「まず試してみる」ボタン押下時のローディングフィードバック追加

## ステータス
🔲 TODO

## 優先度
**P2 / Medium**

## カテゴリ
UX / Onboarding / Loading State

## 対象スコア
HEART-Task Success: +0.3 / AARRR-Activation: +0.3 → 総合 +0.3点

---

## Summary

トップページ（`/`）の「まず試してみる」ボタンを押すと、バックグラウンドでゲストセッションを作成してから `/home` に遷移する。この処理中（推定200〜500ms）に視覚フィードバックがなく、ユーザーが「押せた？」と不安になる。ボタンにローディング状態を追加する。

---

## Background

gstackテスト（2026-04-15）で確認。ネットワークログより：

```
GET https://ogo-roulette.vercel.app/home?_rsc=vusbg → 200 (145ms)
```

クリック後 /home への遷移まで145〜300ms のラグがある。この間、ボタンの見た目が変わらない。

---

## Current Behavior

1. 「まず試してみる」ボタンをタップ
2. 見た目変化なし（約200ms）
3. `/home` に遷移

---

## Expected Behavior

1. 「まず試してみる」ボタンをタップ
2. ボタンがローディング状態に変化（スピナー or テキスト変更）
   ```
   [⏳ 準備中...]  or  [● ● ●（ドット点滅）]
   ```
3. `/home` に遷移

---

## Scope

- `app/(top)/_components/guest-start-button.tsx`（または相当するコンポーネント）
- ボタン押下時に `isPending` state を立て、disabled + ローディング表示

---

## Acceptance Criteria

- [ ] ボタン押下後、テキストまたはアイコンがローディング状態を示す
- [ ] ローディング中はボタンが二重クリック不可（disabled）
- [ ] `/home` 遷移後はボタンのローディング状態が解除される
- [ ] モバイル・デスクトップ両方で確認

## Priority
**P2**

## Impact
HEART-Task Success +0.3、AARRR-Activation +0.3 → 総合 +0.3点

## Risk / Notes
- 処理が速すぎてローディングが一瞬で消える場合は最低200msのディレイを設ける
