# OgoRoulette

> おごりをルーレットで決めよう

**本番環境**: https://ogo-roulette.vercel.app/

飲み会やランチで「誰が奢るか」を、ルーレットという体験に変えることで、

- もめずに決まる
- 盛り上がって決まる
- 金額まで計算できて、その場ですぐ使える

を実現します。

---

## 主な機能

### ルーレット
- 参加者（最大8人）を登録してルーレットを回す
- 当選者がアニメーションとコンフェッティで表示される

### 金額計算
- 合計金額・奢り金額を入力すると、当選者以外の割り勘金額をリアルタイムで計算
- 端数は切り上げ（日本の慣習に準拠）

### ルーム機能
- ルームを作成して招待コードを発行
- QRコードでメンバーが参加可能
- オーナーがスピンすると、全メンバーの画面に同時にアニメーションが流れる

### 履歴
- ログインユーザーは過去のルーレット結果を履歴として確認できる

### ゲストモード
- ログイン不要で即試せる（保存・履歴機能は対象外）

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | [Next.js](https://nextjs.org/) 16 (App Router) |
| UI | React 19 / Tailwind CSS v4 / Radix UI / shadcn/ui |
| アニメーション | Framer Motion 11 |
| 言語 | TypeScript 5.7 |
| 認証 | [Supabase](https://supabase.com/) Auth（Google / LINE / X） |
| DB | PostgreSQL（Supabase） |
| ORM | Prisma 6 |
| バリデーション | Zod |
| テスト | Vitest |
| デプロイ | Vercel |

---

## 画面構成

| パス | 説明 |
|------|------|
| `/` | ウェルカム・ログイン画面 |
| `/home` | メインのルーレット画面 |
| `/room/create` | ルーム作成 |
| `/room/[code]` | ルーム待合室（メンバー確認・招待） |
| `/room/[code]/play` | ルームプレイ画面（リアルタイムスピン） |
| `/join/[code]` | 招待コードからルームに参加 |
| `/scan` | QRコードスキャンで参加 |
| `/result` | スピン結果・金額内訳の表示 |
| `/history` | ルーレット履歴一覧 |
| `/history/[id]` | 履歴詳細 |
| `/bill` | 割り勘計算 |
| `/how-to-use` | 使い方ガイド |

---

## ディレクトリ構成

```
.
├── app/                  # Next.js App Router（ページ・APIルート）
│   ├── api/              # APIエンドポイント（rooms / sessions / profile）
│   ├── home/             # メインのルーレット画面
│   ├── room/             # ルーム関連画面
│   ├── history/          # 履歴
│   └── ...
├── components/           # 共通UIコンポーネント
│   ├── roulette-wheel.tsx
│   ├── winner-card.tsx
│   ├── confetti.tsx
│   └── ui/               # shadcn/ui ベースのコンポーネント群
├── hooks/                # カスタムフック
├── lib/                  # ロジック・ユーティリティ
│   ├── bill-calculator.ts  # 奢り・割り勘計算ロジック
│   ├── room-spin.ts        # スピン状態遷移ロジック
│   ├── room-owner.ts       # オーナー判定ロジック
│   ├── supabase/           # Supabase クライアント
│   └── prisma.ts           # Prisma クライアント
├── prisma/
│   └── schema.prisma       # DBスキーマ定義
└── docs/
    ├── ai-driven-development/  # AI駆動開発 完全ガイド（27ページ教科書）
    └── templates/              # テンプレート集
```

---

## セットアップ

### 必要環境

- Node.js 18以上
- pnpm
- PostgreSQLが使えるSupabaseプロジェクト

### インストール

```bash
git clone https://github.com/Kazuya-Sakashita/OgoRoulette.git
cd OgoRoulette
pnpm install
```

### 環境変数

`.env.example` をコピーして `.env.local` を作成し、各値を設定してください。

```bash
cp .env.example .env.local
```

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase 匿名キー |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase サービスロールキー（LINE 認証用） |
| `DATABASE_URL` | ✅ | Prisma 接続 URL（Transaction pooler） |
| `DIRECT_URL` | ✅ | Prisma マイグレーション用 Direct URL |
| `LINE_CHANNEL_ID` | ✅ | LINE ログイン チャネル ID |
| `LINE_CHANNEL_SECRET` | ✅ | LINE ログイン チャネルシークレット |
| `LINE_CALLBACK_URL` | ✅ | LINE OAuth コールバック URL |
| `NEXT_PUBLIC_APP_URL` | ✅ | アプリの公開 URL（例: `https://your-domain.com`） |
| `GUEST_HOST_SECRET` | ✅ | ゲストホストトークン HMAC 署名シークレット（`openssl rand -hex 32` で生成） |
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | ⚠️ 開発のみ | Google OAuth の開発環境リダイレクト先。**本番では設定しない** |

> **注意:** `SUPABASE_SERVICE_ROLE_KEY` と `GUEST_HOST_SECRET` はサーバーのみで使用し、クライアントに公開しないでください。

### DB セットアップ

```bash
pnpm db:push
```

### 起動

```bash
pnpm dev
```

[http://localhost:3000](http://localhost:3000) で起動します。

---

## 開発コマンド

```bash
pnpm dev          # 開発サーバー起動
pnpm build        # 本番ビルド
pnpm start        # 本番サーバー起動
pnpm lint         # ESLint
pnpm test         # テスト実行（Vitest）
pnpm db:push      # DBスキーマ反映
pnpm db:studio    # Prisma Studio（DBビューア）起動
```

---

## テスト

ビジネスロジック（金額計算・スピン状態遷移・オーナー判定・当選者フィルター）に対してユニットテストを実装しています。

```bash
pnpm test
```

---

## 注意事項

- ゲストモードでは履歴・保存機能は利用できません
- ルーム機能はログインが必要です
- 環境変数が未設定の場合、認証・DB連携は動作しません

---

## AI駆動開発ガイド

このアプリの開発プロセスを教材化したドキュメントを `docs/ai-driven-development/` に収録しています。

- **完全ガイド** (`guide.html` / PDF 27ページ) — 要件定義からリリースまでの全工程
- **テンプレート集** (`templates/`) — コピペで使える7種のプロンプトテンプレート
- **プロンプト集** (`prompts/`) — カテゴリ別20+のプロンプト
- **ケーススタディ** (`cases/`) — 実際に遭遇した問題と解決策4本
