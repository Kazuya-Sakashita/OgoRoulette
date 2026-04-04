# ログイン後に元のページに戻す：returnTo パターンの実装

## 目次

1. [どんな問題だったか](#どんな問題だったか)
2. [returnTo パターンとは](#returnto-パターンとは)
3. [Google ログインへの実装](#google-ログインへの実装)
4. [LINE ログインへの実装](#line-ログインへの実装)
5. [open redirect 対策](#open-redirect-対策)
6. [ログインページへの適用](#ログインページへの適用)
7. [学び](#学び)

---

## どんな問題だったか

ゲストとしてルーレットに参加し、結果画面（WinnerCard）に「Googleで登録」ボタンがあった。

このボタンを押すと Google ログイン画面へ遷移し、ログイン後は `/home` に戻る。**元のルーム（`/room/abc123/play`）には戻れない。**

ゲストがルームに参加中に「このアプリ良いな、登録しよう」という動機が最大になる瞬間に、登録を完了したら元の場所を見失う——という最悪のユーザー体験になっていた。

同様に、未ログインユーザーが直接 `/create` などにアクセスした際、ログイン後に目的のページではなく `/home` に連れて行かれるという問題も存在していた。

---

## returnTo パターンとは

「ログインが必要な操作を途中で中断してログインし、ログイン後に元の操作を再開する」という UI パターンを **returnTo パターン**（または redirect-after-login）と呼ぶ。

実装の流れは単純だ：

```
① ページ A でログインが必要な操作を試みる
    ↓
② ログインページに遷移する（このとき、戻り先のパスを URL パラメーターとして持つ）
   例：/auth/login?returnTo=/room/abc123/play
    ↓
③ ログイン完了
    ↓
④ returnTo の値（/room/abc123/play）にリダイレクトする
```

---

## Google ログインへの実装

### 仕組みの概要

Supabase の `signInWithOAuth` には `redirectTo` オプションがある。OAuth の認証後、Supabase がコールバック URL にリダイレクトするとき、この URL にクエリパラメーターを付与しておくことで「どこに戻るか」を伝えられる。

```
サインインフロー：
アプリ → Google 認証 → Supabase コールバック → アプリのコールバック → 元のページ
                                              ↑ ここで next= を渡す
```

### コード

```typescript
// lib/auth.ts
export function buildOAuthRedirectUrl(returnTo?: string | null): string {
  const base = `${window.location.origin}/auth/callback`

  // returnTo が "/" から始まり、"//" から始まらない（open redirect 対策）
  const safeNext =
    returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : null

  return safeNext ? `${base}?next=${encodeURIComponent(safeNext)}` : base
}

export async function startSupabaseOAuth(
  provider: "google" | "x",
  returnTo?: string | null
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: buildOAuthRedirectUrl(returnTo),  // returnTo を渡す
    },
  })
  if (error) throw error
}
```

### コールバックで next パラメーターを使う

```typescript
// app/auth/callback/route.ts
const next = request.nextUrl.searchParams.get("next") ?? "/home"

// next が安全なパスかチェック（open redirect 対策）
const safeNext =
  next.startsWith("/") && !next.startsWith("//") ? next : "/home"

return NextResponse.redirect(`${origin}${safeNext}`)
```

### WinnerCard での使い方

```typescript
// components/winner-card.tsx
const returnPath = window.location.pathname  // 今いるページのパス
await startSupabaseOAuth("google", returnPath)
```

`window.location.pathname` で現在いるルームのパス（`/room/abc123/play`）を取得して渡す。

---

## LINE ログインへの実装

LINE は Supabase 組み込みの OAuth プロバイダーではないため、自前でコールバックを実装している。`redirectTo` オプションが使えないので、別の方法で `returnTo` を引き継ぐ。

### Cookie で引き継ぐ

```typescript
// app/api/auth/line/start/route.ts
export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("returnTo")

  const state = randomBytes(16).toString("hex")
  const lineAuthUrl = buildLineAuthUrl(state)
  const response = NextResponse.redirect(lineAuthUrl)

  // state Cookie（既存）
  response.cookies.set("line_oauth_state", state, { httpOnly: true, ... })

  // returnTo を Cookie に保存して LINE 認証中も保持
  if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    response.cookies.set("line_oauth_return_to", returnTo, {
      httpOnly: true,
      maxAge: 600,  // 10分
    })
  }

  return response
}
```

```typescript
// app/api/auth/line/callback/route.ts
// Cookie から returnTo を取り出してリダイレクト先にする
const returnTo = request.cookies.get("line_oauth_return_to")?.value
const redirectTo =
  returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
    ? returnTo
    : "/home"

const redirectResponse = NextResponse.redirect(`${origin}${redirectTo}`)
redirectResponse.cookies.delete("line_oauth_return_to")  // 使い終わったら削除
```

### Cookie を使う理由

LINE の OAuth フローでは：

```
アプリ → LINE 認証ページ → LINE のサーバー → アプリのコールバック
```

「LINE のサーバー → アプリのコールバック」のリダイレクトには `state` パラメーターしか乗せられない。`state` に returnTo を入れることもできるが、`state` は CSRF トークンとして使っているため、別途 Cookie に保存する方法を選んだ。

---

## open redirect 対策

returnTo パラメーターは URL の一部として外部から渡せる。悪意ある人が以下のような URL を作れる：

```
/auth/login?returnTo=https://evil.com
```

ログイン後に `https://evil.com` に飛ばされてしまう（open redirect 脆弱性）。

### 対策：絶対 URL を拒否する

```typescript
// ✅ 安全なパスの条件
// 1. "/" で始まる（絶対パス）
// 2. "//" で始まらない（"//evil.com" は "https://evil.com" と同義）

const safeNext =
  next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/home"  // 安全でなければデフォルトへ
```

| 入力 | 判定 | 理由 |
|------|------|------|
| `/room/abc123/play` | ✅ 安全 | `/` 始まり、`//` なし |
| `https://evil.com` | ❌ 危険 | `/` 始まりでない |
| `//evil.com/phishing` | ❌ 危険 | `//` 始まり |
| `/home` | ✅ 安全 | `/` 始まり、`//` なし |

---

## ログインページへの適用

ログインページ自体にも returnTo を適用した。

```typescript
// app/auth/login/page.tsx
"use client"
import { useSearchParams } from "next/navigation"

export default function LoginPage() {
  const searchParams = useSearchParams()
  const returnTo = searchParams.get("returnTo")  // URL パラメーターから取得

  const handleSocialLogin = async (provider: "google" | "x" | "line") => {
    if (provider === "line") {
      startLineAuth(returnTo)  // LINE ログインに returnTo を渡す
    } else {
      await startSupabaseOAuth(provider, returnTo)  // Google/X に returnTo を渡す
    }
  }

  // ...
}
```

未ログインユーザーをログインページに誘導するとき、returnTo を付けて遷移する：

```typescript
// 認証が必要なページで
router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`)
```

---

## 学び

### 1. returnTo は「ログイン体験の損失」を防ぐ

ログインが必要で途中で中断されたユーザーは、ログイン後に「何をしようとしていたか」を忘れることがある。元のページに戻すことで離脱を防ぎ、ログイン後の行動をスムーズにつなげられる。

### 2. OAuth の場合は `redirectTo` に含める

Supabase の `signInWithOAuth` の `redirectTo` にクエリパラメーターを付けておくと、コールバック URL 経由で引き継げる。仕組みを理解すると実装が簡単だ。

### 3. サードパーティ OAuth（LINE など）は Cookie を使う

自前でコールバックを実装する場合、OAuth の中継サーバー（LINE など）を経由するため URL パラメーターを引き継げない。httpOnly Cookie で保持し、コールバックで取り出す。

### 4. open redirect 対策は必ず入れる

returnTo はユーザーが外から操作できる値だ。`startsWith("/") && !startsWith("//")` のシンプルなチェックだが、これがないと任意の外部サイトに誘導できてしまう。

---

## まとめ

returnTo パターンの実装ポイント：

| ケース | 方法 |
|--------|------|
| Google / X ログイン | `signInWithOAuth` の `redirectTo` に `?next=` を付ける |
| LINE ログイン（自前実装） | httpOnly Cookie で引き継ぐ |
| open redirect 対策 | `/` 始まり・`//` 始まりでないことを検証 |
| ログインページ | `useSearchParams` で `returnTo` を読む |

どのプロバイダーでも「ログイン後に元のページに戻る」体験は同じように実現できる。プロバイダーごとの制約に応じて、URL パラメーターか Cookie を使い分けるのがポイントだ。

---

## タイトル案

1. ログイン後に元のページに戻す：returnTo パターンを Google・LINE・X の全プロバイダーで実装
2. 「登録したら場所を見失った」を防ぐ：OAuth フローで returnTo を引き継ぐ実装
3. Supabase × LINE × X のログイン後リダイレクト：returnTo パターン完全実装ガイド
4. open redirect に注意しながら returnTo を実装する：Next.js + Supabase の実例
5. ゲストがログインしたら元のルームに戻す：OAuth の returnTo 実装とセキュリティ対策

---

## SNS 投稿文

```
「ゲストが登録ボタンを押してログイン → ホーム画面に飛ばされてルームを見失う」問題を直した。

returnTo パターンの実装：

Google/X → signInWithOAuth の redirectTo に ?next=/room/abc を付ける
LINE（自前実装）→ httpOnly Cookie で引き継いでコールバックで復元

open redirect 対策も忘れずに：
✅ returnTo.startsWith("/") && !returnTo.startsWith("//")

3つのプロバイダーで同じUX にそろえるのが思ったより手間だった。
```
