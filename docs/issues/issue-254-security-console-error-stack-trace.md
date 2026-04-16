# ISSUE-254: Security(Medium) — 本番環境での console.error スタックトレース出力

## ステータス
🔲 TODO

## 優先度
**Medium / セキュリティ**

## カテゴリ
Security / Information Disclosure / Logging

---

## 概要

複数の API route で `error.stack` を `console.error` に直接出力している。
Vercel のログは非公開であるため**現在は実被害なし**だが、
スタックトレースには DB エラー（テーブル名・カラム名）や
Prisma の内部メッセージが含まれる場合があり、将来的なログ基盤の変更時にリスクになりうる。

---

## 問題箇所

```typescript
// app/api/rooms/[code]/spin/route.ts:231
console.error("[spin] unexpected error:", error instanceof Error ? error.stack : String(error))

// app/api/rooms/[code]/spin-complete/route.ts:76
console.error("Error in spin-complete:", error)

// app/api/rooms/[code]/reset/route.ts:84
console.error("Error resetting room:", error)
```

### 漏洩しうる情報

- PostgreSQL / Prisma エラーメッセージ（テーブル名、制約名）
- Node.js スタックトレース（ファイルパス）
- DB 接続エラーの詳細

---

## 現在のリスク評価

- **Vercel 環境**: ログは Vercel ダッシュボードのみ → 非公開 → **実被害なし**
- **ログ基盤を外部サービス（Datadog / Sentry 等）に転送する場合**: 適切なマスキングが必要

---

## 対応方針

```typescript
// 開発時のみスタックトレースを出力
if (process.env.NODE_ENV === "development") {
  console.error("[spin] error:", error instanceof Error ? error.stack : String(error))
} else {
  console.error("[spin] unexpected error occurred")
}
```

または、Sentry 等の外部エラー追跡サービスを使用する場合は
そちらに完全な情報を送り、console.error は最小限にする。

---

## 完了条件

- [ ] 本番環境で `error.stack` を console.error に直接出力しない
- [ ] 開発環境では引き続き詳細ログを出力する

## 注意点

- Vercel の Function ログは Vercel ダッシュボード経由でのみ参照可能（外部からアクセス不可）
- 外部ログサービス導入時に改めて対応するでも許容範囲

## 関連ファイル
- `app/api/rooms/[code]/spin/route.ts`
- `app/api/rooms/[code]/spin-complete/route.ts`
- `app/api/rooms/[code]/reset/route.ts`
- その他の API route
