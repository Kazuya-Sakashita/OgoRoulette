# ISSUE-233: UX改善(P2) — ルーム作成画面「QRコードを作成」ボタン無効時のヒント不足

## ステータス
🔲 TODO

## 優先度
**P2 / Medium**

## カテゴリ
UX / Onboarding / Room Create

## 対象スコア
HEART-Task Success: +0.5 / AARRR-Activation: +0.5 → 総合 +0.5点

---

## Summary

`/room/create` ページで「QRコードを作成」ボタンが名前未入力時にデフォルト無効（disabled）になっているが、なぜ押せないかの説明がない。初見ユーザーがボタンをタップして何も起きないと感じて離脱するリスクがある。

---

## Background

gstackブラウザテスト（2026-04-15）で確認。snapshot結果：

```
@e6 [button] "QRコードを作成" [disabled]
```

「あなたの名前 *」フィールドが空の状態でボタンが押せない仕様は正しいが、ユーザーへのフィードバックがない。

---

## Current Behavior

- 名前未入力の状態でページを開くとボタンがすでに disabled
- ボタンをタップ/クリックしても何も起きない
- なぜ押せないかのメッセージなし

---

## Expected Behavior

以下いずれかで対応：

### 案A: ボタン直下に inline ヒント（推奨）
```
[QRコードを作成]  ← disabled
⚠ 名前を入力してください
```

### 案B: ボタン押下時にバリデーションメッセージ表示
```
名前を入力してください  ← toast or inline error
```

### 案C: 名前フィールドに autofocus + プレースホルダー強調
フォームを開いた瞬間に名前フィールドにfocusし、入力促進

---

## Scope

- `app/room/create/_components/create-room-form.tsx` — disabled状態のヒント追加
- ボタンのopacity + cursor変更は既存のまま維持

---

## Acceptance Criteria

- [ ] 名前未入力時、ボタンの近くに「名前を入力してください」が表示される
- [ ] 名前入力後はヒントが消え、ボタンがアクティブになる
- [ ] モバイル375pxでヒストが崩れない

## Priority
**P2**

## Impact
HEART-Task Success +0.5、AARRR-Activation +0.5 → 総合 +0.5点

## Risk / Notes
- バリデーション表示タイミング（常時 vs クリック後）はABテストが理想
