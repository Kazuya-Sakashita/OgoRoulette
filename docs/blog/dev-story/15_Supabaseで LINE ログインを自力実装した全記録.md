# Supabase で LINE ログインを自力実装した全記録：`generateLink + verifyOtp` という公式ドキュメントに書いていない手順

## 目次

1. [はじめに：LINE は Supabase の組み込みプロバイダーではない](#はじめに)
2. [全体フローの設計](#全体フローの設計)
3. [Step 1: OAuth フロー開始（CSRF 対策）](#step-1-oauth-フロー開始)
4. [Step 2: LINE からアクセストークンとプロフィールを取得](#step-2-line-プロフィール取得)
5. [Step 3: Supabase Admin でユーザーを upsert する](#step-3-supabase-admin-upsert)
6. [Step 4: 最大の罠 — generateLink + verifyOtp でセッションを確立する](#step-4-セッション確立)
7. [Step 5: Prisma でプロフィールを同期する](#step-5-prisma-sync)
8. [バグ：ニックネームが認証IDになった話](#バグ-ニックネーム問題)
9. [レート制限の追加](#レート制限)
10. [学び](#学び)
11. [まとめ](#まとめ)

---

## はじめに

Supabase で「LINE でログイン」ボタンを実装しようとしたとき、最初につまずく事実がある。

**LINE は Supabase の OAuth プロバイダー一覧に存在しない。**

Google や GitHub なら Supabase のダッシュボードで設定を入れるだけで動く。しかし LINE は、日本でもっとも使われている SNS にもかかわらず、Supabase の組み込みプロバイダーではない。

自前で OAuth フローを実装し、Supabase のセッションと繋ぎ込む必要がある。
そして、その「繋ぎ込み方」は公式ドキュメントに直接書かれていない。

この記事は、実際に動くところまで持っていくのに何をやったか、どこで詰まったかをすべて書いた実装記録だ。

---

## 全体フローの設計

実装前に全体の流れを設計した。Supabase の Admin API と LINE の OAuth 2.0 を組み合わせる 7 ステップになる。

```
ユーザーが「LINE でログイン」をクリック
  ↓
① state 生成 → httpOnly Cookie に保存
  ↓
② LINE 認可 URL にリダイレクト
  ↓
  [LINE 認可画面]
  ↓
③ コールバック: code + state を受け取る（CSRF 検証）
  ↓
④ code → アクセストークン取得 → LINE プロフィール取得
  ↓
⑤ Supabase Admin で仮想メール付きユーザーを upsert
  ↓
⑥ generateLink → verifyOtp でセッション Cookie を確立
  ↓
⑦ Prisma で profile テーブルを同期 → /home にリダイレクト
```

API ルートは 2 つ：

| ルート | 役割 |
| --- | --- |
| `GET /api/auth/line/start` | state 生成 + LINE 認可 URL へリダイレクト |
| `GET /api/auth/line/callback` | コールバック処理全体（④〜⑦） |

---

## Step 1: OAuth フロー開始

`/api/auth/line/start` は state を生成して Cookie に保存し、LINE の認可 URL へリダイレクトする。

```typescript
// app/api/auth/line/start/route.ts
import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"

export async function GET(request: NextRequest) {
  const state = randomBytes(16).toString("hex")

  const lineAuthUrl = new URL("https://access.line.me/oauth2/v2.1/authorize")
  lineAuthUrl.searchParams.set("response_type", "code")
  lineAuthUrl.searchParams.set("client_id", process.env.LINE_CHANNEL_ID!)
  lineAuthUrl.searchParams.set("redirect_uri", process.env.LINE_CALLBACK_URL!)
  lineAuthUrl.searchParams.set("state", state)
  lineAuthUrl.searchParams.set("scope", "profile openid")

  const response = NextResponse.redirect(lineAuthUrl.toString())
  response.cookies.set("line_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10分
    path: "/",
  })
  return response
}
```

**ポイント**：
- `state` を URL パラメーターと Cookie の両方に持たせることで CSRF を防止する
- `sameSite: "lax"` は OAuth のリダイレクトフローに必要（`strict` だとコールバック時に Cookie が消える）
- `scope: "profile openid"` で displayName と pictureUrl が取れる

---

## Step 2: LINE プロフィール取得

コールバックでまず state を検証し、アクセストークンとプロフィールを取得する。

```typescript
// app/api/auth/line/callback/route.ts（一部）

// ① state 検証（CSRF 対策）
const storedState = request.cookies.get("line_oauth_state")?.value
if (!code || !state || !storedState || state !== storedState) {
  return NextResponse.redirect(`${origin}/auth/error`)
}

// ② アクセストークン取得
const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.LINE_CALLBACK_URL!,
    client_id: process.env.LINE_CHANNEL_ID!,
    client_secret: process.env.LINE_CHANNEL_SECRET!,
  }),
})
const lineToken = await tokenRes.json()

// ③ プロフィール取得
const profileRes = await fetch("https://api.line.me/v2/profile", {
  headers: { Authorization: `Bearer ${lineToken.access_token}` },
})
const lineProfile = await profileRes.json()
// → { userId: "Uxxxxxxx", displayName: "山田太郎", pictureUrl: "https://..." }
```

この時点で `lineProfile.userId`（LINE UID）と `lineProfile.displayName`（表示名）が手に入る。

---

## Step 3: Supabase Admin でユーザーを upsert する

**最初の設計判断**：LINE はメールアドレスを公開しない。しかし Supabase Auth はメールアドレスでユーザーを識別する設計になっている。

解決策は「仮想メールアドレス」だ。

```typescript
const lineEmail = `line_${lineProfile.userId}@line.ogoroulette.app`
```

LINE UID が一意なので、このメールアドレスも一意になる。実際には存在しないドメインだが、Supabase Auth 側のユーザー識別に使うだけなので問題ない。

```typescript
const supabaseAdmin = createAdminClient() // service role key を使う

// 既存ユーザーか確認（Prisma で profile テーブルを引く）
const existingProfile = await prisma.profile.findUnique({
  where: { email: lineEmail },
  select: { id: true },
})

if (existingProfile) {
  // 既存ユーザー: メタデータだけ更新（displayName は変わりうる）
  await supabaseAdmin.auth.admin.updateUserById(existingProfile.id, {
    user_metadata: {
      provider: "line",
      full_name: lineProfile.displayName,   // ← ここ重要（後述）
      avatar_url: lineProfile.pictureUrl ?? null,
      line_user_id: lineProfile.userId,
    },
  })
} else {
  // 新規ユーザー: 作成
  const { data: { user } } = await supabaseAdmin.auth.admin.createUser({
    email: lineEmail,
    email_confirm: true, // メール確認不要にする
    user_metadata: {
      provider: "line",
      full_name: lineProfile.displayName,
      avatar_url: lineProfile.pictureUrl ?? null,
      line_user_id: lineProfile.userId,
    },
  })
  supabaseUserId = user.id
}
```

**ポイント**：
- `service role key` は Admin API に必要。anon key では `createUser` が呼べない
- `email_confirm: true` を指定しないとメール確認待ち状態になってログインできない
- `user_metadata` のキー名として `full_name` を選んだ（Google の `name` とは異なるが後述）

---

## Step 4: 最大の罠 — generateLink + verifyOtp でセッションを確立する

ここが一番詰まった箇所だ。

Supabase でユーザーを作成／更新しただけでは、クライアント側にセッション Cookie は設定されない。ユーザーは「存在するが、ログインしていない」状態のままだ。

**どうやってセッションを作るか？**

Supabase Admin API には `generateLink` という関数があり、magic link のトークンを生成できる。これと `verifyOtp` を組み合わせることでサーバーサイドからセッションを確立できる。

```typescript
// magic link のトークンを生成
const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
  type: "magiclink",
  email: lineEmail,
})

// verifyOtp でセッション Cookie を設定
const { error: verifyError } = await supabase.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: "email",  // ← ここが罠！ "magiclink" ではなく "email"
})
```

**落とし穴 1：`type: "email"` を指定する**

`generateLink({ type: "magiclink" })` で生成したトークンを `verifyOtp` で検証するとき、`type: "magiclink"` と書きたくなるが、これは間違いだ。`type: "email"` を指定しないと検証が通らない。

**落とし穴 2：Cookie の `setAll` が複数回呼ばれる**

リダイレクトレスポンスに Cookie を設定するとき、`supabase.auth.verifyOtp` が内部で `setAll` を複数回呼ぶ場合がある。素直に実装すると後から上書きされて Cookie が消える。

解決策は「pending 配列に蓄積して最後にまとめて適用する」パターン：

```typescript
const redirectResponse = NextResponse.redirect(`${origin}/home`)
const pendingCookies: Array<...> = []

const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        // すぐに適用せず、配列に蓄積する
        cookiesToSet.forEach((c) => pendingCookies.push(c))
      },
    },
  }
)

await supabase.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: "email",
})

// 最後にまとめて適用する
pendingCookies.forEach(({ name, value, options }) =>
  redirectResponse.cookies.set(name, value, options)
)
```

このパターンで Cookie が正しく設定され、リダイレクト後もセッションが維持される。

---

## Step 5: Prisma でプロフィールを同期する

セッション確立後、Prisma でアプリ側の `profiles` テーブルを更新する。これはログインのたびに displayName と avatar を最新化するためだ。

```typescript
await prisma.profile.upsert({
  where: { id: supabaseUserId },
  update: {
    name: lineProfile.displayName,
    avatarUrl: lineProfile.pictureUrl ?? null,
  },
  create: {
    id: supabaseUserId,
    email: lineEmail,
    name: lineProfile.displayName,
    avatarUrl: lineProfile.pictureUrl ?? null,
  },
}).catch((err) => {
  // プロフィール同期失敗はログのみ。ログイン自体は継続する。
  console.error("[LINE callback] profile_upsert FAILED (non-blocking)", err)
})

redirectResponse.cookies.delete("line_oauth_state")
return redirectResponse
```

**ポイント**：
- プロフィール同期は「失敗してもログイン自体は継続する」non-blocking にする
- state Cookie をここで削除する

---

## バグ：ニックネームが認証IDになった話

実装後に発見したバグがある。

LINE でログインしてルームを作ると、メンバー一覧に表示される名前が
`line_ue1df22de375546d0731cee2843b18a55`
のような文字列になっていた。

**原因**：

LINE コールバックは表示名を `user_metadata.full_name` に保存している。
しかし、ルーム作成 API は `user_metadata.name` しか見ていなかった。

```typescript
// NG（修正前）
nickname: user.user_metadata?.name || user.email?.split('@')[0]
//                             ^^^^
// LINE では undefined → フォールバックで email の prefix が使われる
// email = "line_ue1df22de...@line.ogoroulette.app"
// → email.split('@')[0] = "line_ue1df22de..."
```

```typescript
// OK（修正後）
const resolvedNickname =
  user.user_metadata?.name ||
  user.user_metadata?.full_name ||    // LINE はここに入れている
  user.user_metadata?.display_name || // 念のため
  "LINEユーザー"

nickname: resolvedNickname
```

**教訓**：`user_metadata` のキー名はプロバイダーによって違う。

| プロバイダー | 表示名のキー |
| --- | --- |
| Google | `name` |
| LINE（今回の実装） | `full_name` |
| GitHub | `name` |

コールバックで `user_metadata` に保存するキー名と、参照側が期待するキー名を統一しておくか、複数キーを fallback チェーンで引くかが必要だ。

---

## レート制限

LINE の Admin API 呼び出しはコストがかかる（外部 API を叩く）。悪意ある連打に備えてレート制限を追加した。

```typescript
// app/api/auth/line/start/route.ts
const ip = getClientIp(request.headers)
const { allowed, resetAt } = checkRateLimit(ip, "line-start", 5, 10 * 60_000)
// 同一 IP から 10 分間に 5 回まで

if (!allowed) {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
  const errorUrl = new URL(`${origin}/auth/error`)
  errorUrl.searchParams.set("reason", "rate_limit")
  errorUrl.searchParams.set("retry_after", String(retryAfter))
  return NextResponse.redirect(errorUrl.toString())
}
```

`checkRateLimit` はインメモリの Map ベースで実装した。Redis は個人開発に重すぎるので、シングルサーバー前提での割り切り。

---

## 学び

### 1. Supabase 組み込み外プロバイダーの実装パターンは「仮想メール + Admin upsert + generateLink + verifyOtp」

この組み合わせを使えば LINE 以外のプロバイダーにも応用できる。Discord、WeChat、Kakao Talk など、Supabase が対応していないプロバイダーで同じフローが使える。

### 2. `generateLink(type: "magiclink")` のトークンは `verifyOtp(type: "email")` で検証する

直感に反するが、これが正しい。ドキュメントを読み込まないと気づかないポイントだ。

### 3. Cookie の `setAll` は「最後にまとめて適用する」

リダイレクトレスポンスとセッション Cookie の設定が絡むとき、setAll の呼び出し順が問題になる。pending 配列パターンで解決できる。

### 4. `user_metadata` のキー名はプロバイダーごとに異なる

保存時と参照時のキー名を揃えるか、fallback チェーンを書くかのどちらかが必要。特に LINE は Google と違うキーを使うため、後からバグになりやすい。

### 5. セッション確立失敗は「/auth/error にリダイレクト」で安全に処理する

`generateLink` や `verifyOtp` が失敗したとき、console.error + redirect で処理する。エラーの詳細をクライアントに返さないことがセキュリティ上重要。

---

## まとめ

Supabase で LINE ログインを実装するときの流れをまとめると：

```
① LINE 認可 URL に state パラメーター付きでリダイレクト（CSRF 対策）
② コールバックで state 検証 → アクセストークン取得 → プロフィール取得
③ 仮想メール（line_{userId}@...）でユーザーを Admin upsert
④ generateLink(type: "magiclink") でトークン生成
⑤ verifyOtp(type: "email", token_hash: ...) でセッション Cookie を確立
⑥ pending 配列で Cookie をリダイレクトレスポンスに適用
⑦ Prisma でプロフィール同期
```

最大の学びは「ステップ④⑤の組み合わせ」だ。これを知っているかどうかで詰まる時間が大きく変わる。

LINE ログインは日本のアプリで需要が高い。Supabase を使っていて LINE 対応を検討しているなら、このパターンをそのまま使える。

---

## タイトル案

1. Supabase で LINE ログインを自力実装した全記録：`generateLink + verifyOtp` という公式ドキュメントに書いていない手順
2. LINE は Supabase の組み込みプロバイダーじゃなかった：自前 OAuth 実装の全工程
3. Supabase + LINE OAuth：仮想メール・Admin API・Cookie 問題を1本で解決する
4. `type: "email"` を指定しないと詰まる：Supabase で LINE ログインを繋ぎ込む方法
5. 個人開発アプリに「LINE でログイン」を実装した話：7 ステップで Supabase と繋ぐ

---

## サムネ用コピー

1. LINE は Supabase に対応していなかった
2. generateLink + verifyOtp = LINE ログインの正解
3. 仮想メールで乗り越えた Supabase × LINE
4. 公式に書いてない手順で LINE ログインを実装した
5. ニックネームが認証IDになる謎のバグも解説

---

## SNS 投稿文

### X（Twitter）

```
Supabase で LINE ログインを実装した。

LINE は組み込みプロバイダーではないので自前で OAuth を書く必要がある。
詰まった点：
- generateLink(type: "magiclink") のトークンは verifyOtp(type: "email") で検証する
- Cookie の setAll は pending 配列にためてまとめて適用する
- user_metadata.full_name（LINE）と name（Google）は別キー

これ知っているかどうかで半日変わる。
```

### Zenn

```
Supabase に組み込まれていない LINE ログインを自前で実装したときの全記録です。

仮想メール・Admin API upsert・generateLink + verifyOtp によるセッション確立・Cookie の setAll 問題・user_metadata のキー名不一致バグまで、ハマった順に書きました。
```

### Qiita

```
【Supabase】LINE ログインを自前で実装する：generateLink + verifyOtp でセッションを確立する方法

LINE は Supabase の組み込みプロバイダーではないため、カスタム OAuth フローが必要です。
仮想メールでのユーザー管理、Admin API を使ったセッション確立、Cookie の扱い方など、
実際に動いたコードとともに全工程を解説します。
```
