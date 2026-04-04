# X ログインで詰まった全記録：`provider: "twitter"` は罠だった

## 目次

1. [はじめに：エラー1行に何時間も溶けた話](#はじめに)
2. [最初に出たエラー](#最初に出たエラー)
3. [Supabase の設定をしたのに「無効」と言われる謎](#supabase-の設定をしたのに無効と言われる謎)
4. [Twitter Developer Console の罠](#twitter-developer-console-の罠)
5. [根本原因の発見：`"twitter"` と `"x"` は別物だった](#根本原因の発見)
6. [正しい設定手順まとめ](#正しい設定手順まとめ)
7. [学び](#学び)
8. [まとめ](#まとめ)

---

## はじめに

Google ログインの実装が 30 分で終わったので、X ログインも同じくらいで終わると思っていた。

結論から言うと、丸一日以上かかった。

原因はコードではなかった。**「provider の文字列が2種類あること」を知らなかっただけ**だ。

この記事は、同じ罠にはまる人を一人でも減らすために書いた。

---

## 最初に出たエラー

X ログインボタンをクリックすると、画面にこのエラーが出た。

```json
{
  "code": 400,
  "error_code": "validation_failed",
  "msg": "Unsupported provider: provider is not enabled"
}
```

「プロバイダーが有効になっていない」というエラーだ。

Supabase でコードを書いたのは数行だった。

```typescript
const { error } = await supabase.auth.signInWithOAuth({
  provider: "twitter",   // ← ここに問題があった（後述）
  options: {
    redirectTo: "http://localhost:3000/auth/callback",
  },
})
```

コード自体はドキュメント通り。どこが間違っているのか、最初は全くわからなかった。

---

## Supabase の設定をしたのに「無効」と言われる謎

まず Supabase のダッシュボードを確認した。

`Authentication → Sign In / Providers` を開くと、**「X / Twitter (OAuth 2.0)」が緑の「Enabled」になっていた。**

設定されているように見える。なのにエラーが出る。

### API で確認してみた

Supabase には設定状態を返す API がある。

```bash
curl -s "https://[your-project].supabase.co/auth/v1/settings" \
  -H "apikey: [your-anon-key]"
```

結果：

```json
{
  "external": {
    "google": true,
    "twitter": false,   ← ここが false！
    ...
  }
}
```

ダッシュボードでは「Enabled」と表示されているのに、**API では `"twitter": false`** になっていた。

この矛盾に混乱して、Supabase の Client Secret を何度も入れ直したり、Twitter 側の設定を疑ったりして時間を溶かした。

---

## Twitter Developer Console の罠

並行して、Twitter Developer Console の設定も確認していた。

Twitter Developer Console（`developer.twitter.com`）を開くと、アプリの設定に以下があることが分かった。

- **OAuth 1.0 Keys**（Consumer Key / Consumer Secret）
- **OAuth 2.0 Keys**（Client ID / Client Secret）

そして「Edit settings」が **OAuth 2.0 Keys の隣にしかない**。

### OAuth 1.0a の有効化画面が見当たらない

OAuth 1.0a を有効化しようとしたが、設定画面が見つからなかった。Twitter Developer Console の UI が「サイドパネル形式」になっていて、アプリ名をクリックしても新しいページに遷移せず、タブが表示されないためだ。

**実は OAuth 1.0a の設定は「Edit settings」から入る**。「OAuth 2.0 Keys」の「Edit settings」をクリックすると、OAuth 1.0a と OAuth 2.0 の両方の設定ページが開く。

### Callback URL が保存できない

別の問題もあった。Supabase のコールバック URL をここに登録しようとすると：

```
https://[your-project].supabase.co/auth/v1/callback
```

「Not a valid callback URL format」というエラーが出て保存できないケースがある。

この場合、開発中はローカルの URL を登録して進める：

```
http://localhost:3000/auth/callback
```

本番デプロイ時に Supabase の URL を追加する。

---

## 根本原因の発見

何時間もかかって、ようやく根本原因が分かった。

### Supabase JS の型定義を見る

`node_modules/@supabase/auth-js` の型定義ファイルを確認すると、こう書いてあった。

```typescript
export type Provider =
  | ...
  /** Uses OAuth 1.0a */
  | 'twitter'
  /** Uses OAuth 2.0 */
  | 'x'
  | ...
```

**`"twitter"` と `"x"` は別物だった。**

| provider 文字列 | 対応するプロバイダー | 認証方式 |
|---|---|---|
| `"twitter"` | Twitter (Deprecated) | OAuth 1.0a（古い） |
| `"x"` | X / Twitter (OAuth 2.0) | OAuth 2.0（新しい） |

Supabase のダッシュボードには2つの Twitter プロバイダーがある：

- **X / Twitter (OAuth 2.0)** — 新しい方。`provider: "x"` で使う
- **Twitter (Deprecated)** — 古い方。`provider: "twitter"` で使う

最初から `provider: "twitter"` を書いていたが、これは**廃止予定の古い OAuth 1.0a プロバイダー**を指していた。

有効にしていたのは「X / Twitter (OAuth 2.0)」なので、`"twitter": false`（古い方は無効）という API の結果も正しかった。ダッシュボードの表示と API の結果が「矛盾しているように見えた」のは、見ている対象が違っていたからだ。

### 修正は1行

```typescript
// 修正前（OAuth 1.0a を指している → エラー）
provider: "twitter"

// 修正後（OAuth 2.0 を指している → 動く）
provider: "x"
```

これだけで動いた。

---

## 正しい設定手順まとめ

同じ実装をする人のために、正しい手順をまとめる。

### 1. Twitter Developer Console での設定

1. `developer.twitter.com` にアクセス
2. アプリを選択 → 右パネルの「OAuth 2.0 Keys」横の **「Edit settings」** をクリック
3. **Type of App** で「Web App, Automated App or Bot」を選択（Confidential client）
4. **Callback URI / Redirect URL** に追加：
   ```
   https://[your-project].supabase.co/auth/v1/callback
   ```
5. **Website URL** にアプリの URL を入力して **Save**
6. 「Keys and tokens」から **Client ID** と **Client Secret** をコピー

### 2. Supabase での設定

1. `supabase.com/dashboard` → プロジェクトを選択
2. `Authentication → Sign In / Providers`
3. **「X / Twitter (OAuth 2.0)」** をクリック（「Twitter (Deprecated)」ではない）
4. トグルを **Enable** に
5. **Client ID** と **Client Secret** を入力して **Save**

### 3. コードの書き方

```typescript
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

const { error } = await supabase.auth.signInWithOAuth({
  provider: "x",   // "twitter" ではなく "x"
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
})

if (error) {
  console.error("X ログインエラー:", error)
}
```

### 設定確認コマンド

設定が正しく保存されたか確認するには：

```bash
curl -s "https://[your-project].supabase.co/auth/v1/settings" \
  -H "apikey: [your-anon-key]" | grep twitter
```

`"twitter": false` のままでも、X / Twitter (OAuth 2.0) プロバイダーが有効であれば問題ない。この API の `"twitter"` キーは**古い OAuth 1.0a プロバイダー**の状態を示すものなので、新しい X プロバイダーが有効でも `false` になる。

---

## 学び

### 1. `provider: "twitter"` は古い OAuth 1.0a を指す

Supabase JS クライアントで X ログインを実装するときは **`provider: "x"`** を使う。`"twitter"` は廃止予定の OAuth 1.0a プロバイダー用なので、新しいアプリで使ってはいけない。

### 2. Supabase のプロバイダーは「Deprecated」と新しい方の2種類がある

Twitter だけでなく、Slack にも「Slack (OIDC)」と「Slack (Deprecated)」がある。プロバイダー名に「Deprecated」がついている方は古い実装で、基本的に新しい方を選ぶ。

### 3. `auth/v1/settings` API の `"twitter": false` は「古い OAuth 1.0a が無効」という意味

この API で `"twitter": false` が返ってきても、`"x"` プロバイダーが有効かどうかはわからない。混乱の元なので注意。

### 4. Twitter Developer Console の設定画面はアプリ一覧から直接入れない

アプリカードをクリックしてもサイドパネルが開くだけで、設定タブは表示されない。OAuth 2.0 の設定は「OAuth 2.0 Keys」横の「Edit settings」から入る。

### 5. 同じメールで複数プロバイダーを使う場合はアカウントリンクを有効化する

X でログインしたユーザーが、同じメールアドレスで Google ログインしていた場合、デフォルトでは別アカウントになる。同一ユーザーとして扱いたい場合は Supabase の「Policies」設定でアカウントリンクを有効化する。

---

## まとめ

X ログインで詰まった原因を一言で言うと：

**`provider: "twitter"` と `provider: "x"` の違いを知らなかった。**

Supabase のドキュメントには「X/Twitter」として統合されて書かれていることが多く、この2つの文字列の違いに気づきにくい。型定義ファイルを直接読んで初めて分かった。

今後 Supabase で X ログインを実装する場合は、最初から `provider: "x"` を使えばハマらずに済む。

---

## タイトル案

1. Supabase で X ログインが動かない：`provider: "twitter"` と `provider: "x"` は別物だった
2. X ログインで丸一日溶かした話：Supabase の provider 文字列に罠があった
3. `"twitter"` じゃなくて `"x"` を使え：Supabase × X ログインの正しい実装
4. Supabase で「provider is not enabled」が消えない：原因は provider 文字列だった
5. Supabase × X ログイン完全ガイド：OAuth 1.0a と 2.0 の違いから設定手順まで

---

## サムネ用コピー

1. `provider: "twitter"` は罠だった
2. X ログインで丸一日詰まった原因
3. Supabase の provider 文字列に落とし穴
4. `"twitter"` を `"x"` に変えたら動いた
5. OAuth 1.0a と 2.0、間違えてた

---

## SNS 投稿文

### X（Twitter）

```
Supabase で X ログインを実装して丸一日詰まった。

原因は provider の文字列だった。

❌ provider: "twitter"  → OAuth 1.0a（Deprecated）
✅ provider: "x"        → OAuth 2.0（新しい方）

この違い、型定義ファイルを読むまで気づかなかった。
Supabase のダッシュボードで「X / Twitter (OAuth 2.0)」を有効にするなら "x" を使う。
```

### Zenn / Qiita

```
Supabase で X（Twitter）ログインを実装したとき、
「Unsupported provider: provider is not enabled」が消えずに詰まりました。

原因：`provider: "twitter"` は廃止予定の OAuth 1.0a を指す
解決：`provider: "x"` に変えるだけで動いた

Twitter Developer Console の設定手順と Supabase の正しい設定方法も合わせて解説します。
```
