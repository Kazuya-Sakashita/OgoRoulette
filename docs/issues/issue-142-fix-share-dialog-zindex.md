# ISSUE-142: シェア確認ダイアログがシェアシートの裏に隠れる問題を修正する

## 概要

`components/share-sheet.tsx` の公開名確認ダイアログが `z-10` のため、`z-80` のシェアシート本体の裏に隠れてしまい、初回シェア時にダイアログが表示されずボタンが反応しないように見える問題を修正する。

---

## 背景

- 初回シェア時、`displayNameConfirmedAt === null` のユーザーには公開名確認ダイアログを表示する（ISSUE-078 実装）
- しかしダイアログが `z-10`、シェアシート本体が `z-80` であり、z-10 < z-80 のためダイアログが常にシート背面に隠れる
- 結果として、ログイン済みの初回シェアユーザーは X・LINE ボタンを押しても何も起きないように見える

---

## 原因

### スタッキングコンテキストの誤り

```tsx
{/* シェアシート本体：fixed + z-80 — スタッキングコンテキストを生成 */}
<motion.div className="fixed inset-0 z-80 flex flex-col items-center justify-end">

{/* 確認ダイアログ：absolute + z-10 — z-10 < z-80 のため背面に隠れる */}
<motion.div className="absolute inset-0 z-10 flex items-end justify-center">
```

`absolute` 配置の要素は親要素のスタッキングコンテキストに依存する。`z-10` はシェアシート（z-80）より小さいため、常に背面に隠れる。

---

## 修正内容

### `components/share-sheet.tsx`

```tsx
// Before（line 413）:
className="absolute inset-0 z-10 flex items-end justify-center"

// After:
className="fixed inset-0 z-[90] flex items-end justify-center"
```

**変更点：**

1. `absolute` → `fixed`：画面全体を基準に配置し、親要素のスタッキングコンテキストに依存しなくなる
2. `z-10` → `z-[90]`：シェアシート（z-80）より確実に手前に来る値に変更

---

## 受け入れ条件

- [x] 初回ログイン済みユーザーが X ボタンを押したとき確認ダイアログが表示される
- [x] 初回ログイン済みユーザーが LINE ボタンを押したとき確認ダイアログが表示される
- [x] 未ログインユーザー・確認済みユーザーのシェア動作に影響がない
- [x] ダイアログのキャンセル・確認ボタンが正常に機能する

---

## ステータス

✅ 完了
