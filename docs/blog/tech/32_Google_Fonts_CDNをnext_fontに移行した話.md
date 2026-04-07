# Google Fonts CDN を next/font に移行した話

「外部フォントは preconnect しておけばいい」と思っていた。

それは間違いではなかったが、もっといいやり方があった。

---

## きっかけ

`app/layout.tsx` に、こういうコードがあった。

```tsx
<head>
  {/* Google Fonts — 直接 CDN から読み込み（next/font/google の Turbopack ビルド問題を回避） */}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Noto+Sans+JP:wght@400;700;900&display=swap"
    rel="stylesheet"
  />
</head>
```

コメントに「Turbopack ビルド問題を回避」と書いてある。

旧バージョンの Next.js では `next/font/google` が Turbopack と相性が悪く、
ビルド時にエラーが出ることがあった。それを避けるための応急処置だった。

Next.js 16 になった今、この制約は解消されている。

---

## 何が問題だったか

### 毎回 Google に IP を送る

Google Fonts CDN は外部ドメイン（`fonts.googleapis.com`）からファイルを取得する。
これはつまり、ユーザーのブラウザが Google にリクエストを送るということだ。

GDPR の観点でも、「ユーザーが意図せず第三者にデータを送信する」構造は問題になりやすい。
`preconnect` を置いていても、実際のフェッチはページを開くたびに発生する。

### LCP への影響

`preconnect` はあくまで「接続だけ先に確保しておく」処理だ。
ファイル自体は CSS が評価されるまで取得されない。

ネットワーク環境によっては、フォントの到着が遅れる。
フォントが届くまで、ブラウザはテキストを描画できない。これが LCP（Largest Contentful Paint）に響く。

### FOUT（Flash of Unstyled Text）

フォント未読み込みの間、ブラウザはシステムフォントで代替表示する。
その後フォントが届いた瞬間、テキストが一瞬ちらつく。

`display=swap` を URL に指定していても、CDN 経由だと制御しきれない部分が残る。

---

## next/font に切り替える

`next/font/google` を使うと、フォントは**ビルド時に自分のサーバーにダウンロードされる**。

ユーザーのブラウザは `fonts.googleapis.com` に一切アクセスしない。
フォントは自分のドメインから配信される。

```tsx
// app/layout.tsx

import { Inter, Noto_Sans_JP } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-inter',
  display: 'swap',
})

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--font-noto-sans-jp',
  display: 'swap',
})
```

生成した CSS 変数を `<html>` タグに渡す。

```tsx
<html lang="ja" className={`${inter.variable} ${notoSansJP.variable}`}>
```

これだけだ。`<link>` タグ 3 行は丸ごと削除した。

---

## CSS 変数の接続

Tailwind v4 を使っているので、フォント定義は `globals.css` の `@theme` ブロックにある。

**変更前:**

```css
@theme inline {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Noto Sans JP', sans-serif;
}
```

文字列でフォント名を直接指定していた。

**変更後:**

```css
@theme inline {
  /* next/font が <html> に注入する CSS 変数を参照 */
  --font-sans: var(--font-inter), var(--font-noto-sans-jp), -apple-system, BlinkMacSystemFont, sans-serif;
}
```

`next/font` が生成した CSS 変数（`--font-inter`、`--font-noto-sans-jp`）を参照する。
`<html>` にクラスが当たる → CSS 変数が定義される → `@theme` がそれを参照する。

---

## 変更後に確認したこと

Chrome DevTools の **Network タブ** で確認。

変更前:
- `fonts.googleapis.com` へのリクエスト 1 件
- `fonts.gstatic.com` からフォントファイル数件

変更後:
- `fonts.googleapis.com` へのリクエスト: **0 件**

フォントは自ドメイン（`ogo-roulette.vercel.app`）から配信されている。

---

## Turbopack との互換性

コメントにあった「Turbopack ビルド問題」は実際に存在した。
Next.js 13〜14 の初期では `next/font` が Turbopack で動作不安定だった。

Next.js 16 時点では解消済みで、`npm run build` も `npm run dev` も問題なく通った。

古いコメントが理由で移行を先送りしていたが、確かめてみたら 5 分で終わった。

---

## まとめ

`next/font/google` への移行でやったことは 3 つだ。

1. `import { Inter, Noto_Sans_JP } from 'next/font/google'` で定義
2. `<html className={inter.variable} ${notoSansJP.variable}>` で適用
3. CSS 変数参照に更新（Tailwind v4 の場合）

得たものは:
- Google Fonts CDN フェッチ: **ゼロ**
- LCP: 外部フェッチ分だけ改善
- プライバシー: ユーザー IP が Google に送信されない

「旧バージョンの制約」は意外と残り続ける。
コメントの理由が今も有効かどうか、たまに確かめてみると発見がある。
