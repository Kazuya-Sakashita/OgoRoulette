# ISSUE-055: `/auth/error` がレートリミットエラーを一般エラーとして表示する

## ステータス
✅ 完了

## 概要
LINE start ルート（`/api/auth/line/start`）はレートリミット超過時に `?reason=rate_limit&retry_after=N` 付きで `/auth/error` にリダイレクトするが、`/auth/error` ページはこれらのパラメータを一切読まず「認証中にエラーが発生しました。もう一度お試しください」と表示していた。

## 背景
ISSUE-026 でレートリミットを実装。超過時に `reason=rate_limit` と `retry_after` を URL パラメータで伝達する設計になっていたが、受け取り側の UI が未実装のまま放置されていた。

## 問題点
```typescript
// app/api/auth/line/start/route.ts
const errorUrl = new URL(`${origin}/auth/error`)
errorUrl.searchParams.set("reason", "rate_limit")
errorUrl.searchParams.set("retry_after", String(retryAfter))
return NextResponse.redirect(errorUrl.toString())

// app/auth/error/page.tsx（修正前）— パラメータを読まない
export default function AuthErrorPage() {
  return (
    <p>認証中にエラーが発生しました。</p>  // 常にこのメッセージ
  )
}
```

ユーザーはレートリミットかどうか分からず、何度もログインを試みて悪化させる可能性がある。

## 修正内容
```tsx
// After — useSearchParams でパラメータを読む
const reason = searchParams.get("reason")
const isRateLimit = reason === "rate_limit"

// isRateLimit の場合: 時計アイコン + "しばらくお待ちください" + 残り時間
// それ以外: AlertCircle + "ログインエラー"
```

## 優先度
🟡 Medium — ユーザー体験（原因不明のエラー vs 明確な案内）

## 影響範囲
- `app/auth/error/page.tsx`: `useSearchParams` 追加、条件分岐 UI 実装
