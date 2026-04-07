# ISSUE-208: Google Fonts CDN → next/font/google 移行

## ステータス
✅ 完了 2026-04-07

## 優先度
**Recommended** — LCP・プライバシー・FOUT に影響。Lighthouse パフォーマンス改善。

## カテゴリ
Performance / SEO / Privacy

## 対象スコア
技術: +1 / G-STACK-Architecture: +0.5

---

## 背景

`app/layout.tsx` は現在 Google Fonts を `<link>` タグで直接 CDN から読み込んでいる。

```tsx
// 現状（layout.tsx:54-61）
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Noto+Sans+JP:wght@400;700;900&display=swap"
  rel="stylesheet"
/>
```

コメントに「next/font/google の Turbopack ビルド問題を回避」と記載されている。
Turbopack の next/font 対応は Next.js 15 以降で大幅改善されており、この制約は解消された可能性が高い。

---

## 問題

### ① LCP に影響

CDN フォントは外部ドメインからのフェッチが必要。`preconnect` があっても初回ロード時に
ネットワーク遅延が発生する。`next/font` はフォントをビルド時に self-host し、FOUT を完全排除。

### ② プライバシー

Google Fonts CDN はユーザーの IP を Google に送信する。
GDPR/個人情報保護の観点で `next/font` の self-host が推奨される。

### ③ Lighthouse パフォーマンス警告

"Eliminate render-blocking resources" に Google Fonts の `<link>` が含まれる場合がある。
`next/font` は `font-display: swap` を自動設定し、render-blocking を回避する。

---

## 原因

Turbopack + `next/font/google` の互換性問題（旧バージョン）を回避するための暫定実装が残っている。
Next.js 16.1.6 + Turbopack では、`next/font/google` が正式対応済み。

---

## 確認方法

```bash
# ビルドで next/font/google が動作するか確認
npm run build
# Turbopack dev でフォントが表示されるか確認
npm run dev
```

---

## 改善内容

```tsx
// app/layout.tsx

// 削除
import './globals.css'
// <link rel="preconnect"> 3行を削除

// 追加
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

// <html> タグ
<html lang="ja" className={`${inter.variable} ${notoSansJP.variable}`} suppressHydrationWarning>
```

`tailwind.config.ts` でフォント変数を参照するよう更新。

---

## 影響ファイル

- `app/layout.tsx` — `<link>` タグ削除、`next/font` import 追加
- `tailwind.config.ts` — fontFamily に CSS variable 参照追加（既存設定に応じて）

---

## 完了条件

- [ ] `npm run build` でエラーなし
- [ ] `npm run dev` でフォント正常表示
- [ ] Chrome DevTools Network タブで `fonts.googleapis.com` へのリクエストが0件
- [ ] Lighthouse: "Eliminate render-blocking resources" に Fonts が含まれない

## 期待スコア上昇

技術: +1（11→12） / G-STACK-Architecture: +0.5
→ 総合: +0.5点
