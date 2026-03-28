# issue-044: WinnerCard ゲスト CTA — ログイン後にルームコンテキストが失われる

## 概要

プレイページ（`/room/[code]/play`）でゲストが WinnerCard の「Googleで登録」「LINEで登録」ボタンを押すと `/` または `/api/auth/line/start` にナビゲートされる。ログイン完了後は `/home` にリダイレクトされ、もといたルームに戻る手段がない。

## 背景

ISSUE-043 実装（ゲスト→ログイン転換 CTA）で WinnerCard に登録ボタンを追加した。バイラル・グロース施策として正しい方向だが、ルームセッション中にログインを促す場合、ログイン後のリターン先を考慮していなかった。

## 問題点

`components/winner-card.tsx` の CTA ボタン（Phase B 詳細シート内）：

```tsx
// line 733
onClick={() => { window.location.href = "/" }}

// line 745
onClick={() => { window.location.href = "/api/auth/line/start" }}
```

- Google ログイン: `/` (WelcomePage) に遷移 → Google OAuth → `/auth/callback?next=/home` → `/home`
- LINE ログイン: `/api/auth/line/start` → LINE OAuth → `/api/auth/line/callback` → `/home`

どちらも `/home` にリダイレクトされ、元のルーム (`/room/[code]/play`) に戻らない。

## 原因

CTA の onClick が返却先パスを指定せず、各 OAuth フローのデフォルトリダイレクト先（`/home`）に任せている。ルームコードを引き継ぐ仕組みがない。

## ユーザー影響

- ルーレット直後の高揚感の中で「登録して次回も使う」という動機が最大になるタイミングでログインを促しているにもかかわらず、ログイン後にルームを見失う
- ゲストとして参加していたルームメンバー権限が引き継がれない（ログイン後は新規メンバーとして join が必要）
- 「登録したのに何もできない」という印象を与え、逆効果になる可能性がある

## 技術的リスク

- LINE コールバック (`/api/auth/line/callback`) は現在ハードコードで `/home` にリダイレクト（`route.ts:185`）
- Google OAuth は `?next=` パラメータで制御可能（`supabase.auth.signInWithOAuth` の `redirectTo`）
- LINE コールバックに `returnTo` パラメータを追加するには `state` パラメータかクッキーを利用する必要がある

## 修正方針

### Phase 1（最小対応）
CTA ボタンの飛び先を `/` ではなく `/?from=/room/[code]/play` に変更。WelcomePage でログイン後に `/home` ではなく `from` の値にリダイレクトする。

```typescript
// winner-card.tsx
const returnPath = typeof window !== "undefined" ? window.location.pathname : "/"
window.location.href = `/?returnTo=${encodeURIComponent(returnPath)}`
```

`app/page.tsx` の `checkUserOrVisited` で：
```typescript
const returnTo = new URLSearchParams(window.location.search).get("returnTo")
if (user || hasVisited) {
  router.push(returnTo || "/home")
}
```

### Phase 2
LINE ログインの場合、`/api/auth/line/start` に `returnTo` を渡し、`state` パラメータまたはクッキーに保存、コールバックで復元する。

## タスク

- [ ] `components/winner-card.tsx` の Google CTA を `/?returnTo=...` 形式に変更
- [ ] `app/page.tsx` の認証後リダイレクトで `returnTo` パラメータを反映
- [ ] LINE ログイン CTA にも同様の `returnTo` を適用（Phase 2）
- [ ] ログイン後にルームが存在しない/期限切れの場合のフォールバックを `/home` にする

## 受け入れ条件

- ゲストが WinnerCard CTA からログインすると、ログイン後に元のルームに戻る
- ルームが期限切れ・存在しない場合は `/home` にフォールバックする
- 副作用として既存のログインフローが壊れない

## 優先度

Medium

## デプロイブロッカー

No
