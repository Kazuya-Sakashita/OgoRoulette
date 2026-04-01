# ISSUE-117: onAuthStateChangeでログイン後のプロフィール再取得を確実にする

## 概要

ホームページでログイン直後にプロフィール情報（公開名・アバター）が反映されない場合がある問題を修正する。
`supabase.auth.onAuthStateChange` リスナーを追加し、認証状態の変化に確実に追従する。

---

## 背景

- OAuth ログイン後にホームページへリダイレクトされた際、`fetchUserData` が古いキャッシュを使うことがあった
- `SIGNED_IN` イベントが発火しても `localStorage` キャッシュが優先され、新しいプロフィールが表示されないケース
- `SIGNED_OUT` 時にユーザー状態がクリアされない場合があった

---

## 修正内容

### `app/home/page.tsx`

```ts
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        // キャッシュを無視して最新プロフィールを再取得
        await fetchUserData(true)
      } else if (event === "SIGNED_OUT") {
        setCurrentUser(null)
        setProfile(null)
        localStorage.removeItem("ogo_user_cache")
      }
    }
  )
  return () => subscription.unsubscribe()
}, [])
```

- `SIGNED_IN`: `fetchUserData(forceRefresh: true)` でキャッシュをバイパスしてプロフィール再取得
- `SIGNED_OUT`: ユーザー/プロフィールステートをクリアし、`localStorage` キャッシュも削除
- クリーンアップ関数で `subscription.unsubscribe()` を呼び、メモリリーク防止

---

## 影響範囲

- `app/home/page.tsx`
- OAuth ログイン直後のプロフィール表示確実性向上
- ログアウト時のUI状態クリアの確実化

---

## ステータス

✅ 完了（commit: a8c21d8）
