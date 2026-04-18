# OgoRoulette

## 概要

飲み会・合コン・社内ランチで「誰がおごるか」をルーレットで決めるマルチプレイヤーアプリ。  
QRコードで参加 → ルーレット → 当選者発表。ゲストモード対応（ログイン不要）。

**本番URL:** https://ogo-roulette.vercel.app/  
**スタック:** Next.js 16 App Router / React 19 / TypeScript / Supabase / Prisma / Tailwind CSS v4

## 設計思想

- **サーバー側抽選:** 当選者はサーバーが決定、クライアントはアニメーションのみ
- **モバイルファースト:** `min-h-dvh`、`max-w-[390px]`、タッチ最適化
- **ゲストファースト:** ログイン不要でルーム作成・スピン可能（HMAC署名トークン）
- **感情設計優先:** 「動く」より「楽しい」を先に設計する

## 絶対ルール

**AI 指示**
- V1 ファイルに触れる作業は「V2 を新ファイルに作成」と明示。「更新」は上書きと解釈される
- 破壊的操作の前は必ず `git status` を確認する

**評価**
- 評価は6軸固定: G-STACK / HEART / AARRR / Kano / 感情 / 技術（合計100点）
- 感情スコアが 15/20 未満 → 機能追加より演出改善を優先
- 現スコア: **99.0/100**（2026-04-16）— G-STACK:14 HEART:20 AARRR:20 Kano:10 感情:20 技術:15
- 感情 20/20（フル達成）
- 補助スコア: JTBD:92 / EEM:92 / NSM:84（2026-04-16）
- 残り1点: G-STACK バイラルK-factor の実測値（運用・計測で達成）

**ISSUE**
- 「なんとなく足りない」はISSUE化しない。スコアの数値が根拠になって初めてISSUE化する
- 完了済み: ISSUE-208〜209・214・221〜243・244〜259・260・263〜266〜276・277・278〜279・282・284・286・288・289・290（2026-04-18時点）
- 部分対応: ISSUE-281（join flow制約でメンバー強制不可）・287（ランキングログ追加）
- 未対応（設計フェーズ）: ISSUE-280（CSP手動検証）・283（use-spin分割）・285（sendBeacon復旧）（2026-04-18 時点）
- 未対応: ISSUE-291（LPデスクトップ未対応）・292（LP内部スコアコピー）（2026-04-18 時点）

**Server Components**
- Server Components でデータを直接 fetch（Prisma / Supabase 直接呼び出し）する場合は、`middleware.ts` に当該ルートの認可チェックを必ず追加すること（ISSUE-264）
- API route 経由であれば現在の設計で安全（route handler 側で JWT/HMAC 検証済み）
- 追加時の確認チェックリスト:
  - `auth.getUser()` でユーザー確認しているか
  - middleware の `protectedPaths` にルートを追加したか

**Git**
- `docs/blog/` は `.gitignore` 対象のため `git add -f` が必要
- コミットは機能単位で分割（docs系 / fix系 / feat系）
