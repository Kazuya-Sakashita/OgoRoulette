# OgoRoulette

> おごりをルーレットで決めよう

飲み会やランチで「誰が奢るか」を、ルーレットを使って楽しく・公平に決めるWebアプリです。

---

## 解決したい課題

「誰が払う？」という微妙な空気を、ルーレットという体験に変えることで、

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
| 言語 | TypeScript 5.7 |
| 認証 | [Supabase](https://supabase.com/) Auth（Google OAuth） |
| DB | PostgreSQL（Supabase） |
| ORM | Prisma 6 |
| バリデーション | Zod |
| テスト | Vitest |

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
└── prisma/
    └── schema.prisma       # DBスキーマ定義
```

---

## セットアップ

### 必要環境

- Node.js 18以上
- pnpm
- PostgreSQLが使えるSupabaseプロジェクト

### インストール

```bash
git clone https://github.com/your-username/OgoRoulette.git
cd OgoRoulette
pnpm install
```

### 環境変数

`.env.local` をプロジェクトルートに作成し、以下を設定してください。

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Prisma (Supabase PostgreSQL)
DATABASE_URL=your_database_url
DIRECT_URL=your_direct_url
```

> Supabase の `DATABASE_URL` / `DIRECT_URL` は、Supabaseダッシュボードの **Settings > Database > Connection string** から取得できます。

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
