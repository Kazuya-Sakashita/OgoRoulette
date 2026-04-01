# ISSUE-110: sessions sync の無音エラーをconsole.warnに変更する

## 概要

`app/home/page.tsx` の sessions fetch で `.catch(() => {})` による無音エラーハンドリングがあり、
失敗しても気づけない状態を修正する。

---

## 背景

- `fetchUserData` 内の sessions 取得で `.catch(() => {})` が使われていた
- セッション同期が失敗してもサイレントに無視され、デバッグ不可
- 本番でのエラー把握・改善が困難

---

## 修正内容

### `app/home/page.tsx`

```ts
// Before
.catch(() => {})

// After
.catch((e) => { console.warn("[OgoRoulette] sessions sync failed:", e) })
```

---

## 影響範囲

- ホームページの sessions 取得失敗時にコンソールへ警告が出力される
- ユーザー体験には変化なし（エラー時は既存の graceful fallback）
- デバッグ・監視の改善

---

## ステータス

✅ 完了（commit: 59fe532）
