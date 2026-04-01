# ISSUE-138: ホーム画面のプロフィール取得中にスケルトンを表示する

## 概要

`app/home/page.tsx` でプロフィール情報（公開名）の取得中、
レイアウトシフトや空白表示を防ぐためのスケルトンUIを追加する。

---

## 背景

- ログイン後、Supabase からユーザー情報 (`user`) はすぐ取れるが
  APIで取得する `profile`（公開名）は少し遅れる
- その間「こんにちは、」と表示されたり、空文字になるレイアウトシフトが起きていた
- `user && !profile` の状態をスケルトンで補完することで視覚的安定感が上がる

---

## 修正内容

### `app/home/page.tsx`

```tsx
// Before
<p className="text-sm text-muted-foreground">
  {profile ? <>こんにちは、{getDisplayName(profile, user)}さん！</> : "今日もルーレット回しますか？"}
</p>

// After
{user && !profile ? (
  <div className="animate-pulse flex items-center gap-2">
    <div className="w-28 h-4 rounded bg-white/10" />
  </div>
) : (
  <p className="text-sm text-muted-foreground">
    {profile ? <>こんにちは、{getDisplayName(profile, user)}さん！</> : "今日もルーレット回しますか？"}
  </p>
)}
```

**注意**: `loading` 状態変数は home/page.tsx に存在しないため `user && !profile` を条件に使用。
`loading` は play/page.tsx にのみ存在する。

---

## ステータス

✅ 完了（commit: 0830173）
