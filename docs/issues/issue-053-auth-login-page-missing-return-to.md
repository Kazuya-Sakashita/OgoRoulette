# ISSUE-053: `/auth/login` 経由のログインで returnTo が機能しない

## ステータス
✅ 完了

## 概要
`app/page.tsx`（ウェルカムページ）の Google ログインは `?next=` を callback URL に渡すが、`app/auth/login/page.tsx`（ログインページ）の Google ログインはこれを行っていなかった。また LINE ログインも `?returnTo=` を LINE start に渡していなかった。

## 背景
WinnerCard の「登録する」ボタン（ISSUE-044）で、ゲストがログイン後に元のルームに戻る仕組みを実装した。URL パラメータ `?returnTo=/room/ABCDEF/play` を介してログイン後のリダイレクト先を制御する。

ウェルカムページ（`/`）ではこの仕組みが動くが、ログインページ（`/auth/login`）経由ではルームコンテキストが失われていた。

## 問題点

### Google（`login/page.tsx`）
```typescript
// Before — returnTo を渡さない
const { error } = await supabase.auth.signInWithOAuth({
  provider,
  options: { redirectTo: `${window.location.origin}/auth/callback` },
})

// After — ?next= を付与
await startSupabaseOAuth(provider, returnTo) // returnTo = searchParams.get("returnTo")
```

### LINE（`login/page.tsx`）
```typescript
// Before — returnTo なし
window.location.href = "/api/auth/line/start"

// After — returnTo 付き
startLineAuth(returnTo)
```

## 修正内容
- `lib/auth.ts` に `buildOAuthRedirectUrl(returnTo?)` を実装
- `app/auth/login/page.tsx` で `useSearchParams` を使い `returnTo` を読み取り
- Google / LINE / X すべてに `returnTo` を伝播

## 副次修正: LINE callback の `line_oauth_return_to` cookie 削除漏れ
LINE callback 完了後に `line_oauth_return_to` cookie を削除していなかった。次のリクエストでも古い returnTo が残る可能性があった。

```typescript
// app/api/auth/line/callback/route.ts
redirectResponse.cookies.delete("line_oauth_state")
redirectResponse.cookies.delete("line_oauth_return_to")  // ← 追加
```

## 優先度
🔴 Critical — ルームコンテキストを持つ招待リンクからのログインで毎回 /home に飛ばされる UX 崩壊

## 影響範囲
- `lib/auth.ts`: 新規 `buildOAuthRedirectUrl`, `startLineAuth`, `startSupabaseOAuth`
- `app/auth/login/page.tsx`: `returnTo` 対応
- `app/api/auth/line/callback/route.ts`: cookie 削除漏れ修正
