# ISSUE-253: Security(High) — LINE OAuth Cookie の secure フラグが NODE_ENV 依存（✅ 修正済み）

## ステータス
🔲 TODO

## 優先度
**High / セキュリティ**

## カテゴリ
Security / OAuth / Cookie / LINE Auth

---

## 概要

`GET /api/auth/line/start` が設定する `line_oauth_state` および `line_oauth_return_to` クッキーの
`secure` フラグが `process.env.NODE_ENV === "production"` にのみ依存している。
Vercel 環境ではすべてのデプロイで `NODE_ENV=production` が設定されるため
**現在の本番環境では問題ない**が、将来的に NODE_ENV を使わない環境（Docker, 独自ホスティング）に
移行した場合、HTTPS 環境でも `secure=false` となるリスクがある。

---

## 問題

```typescript
// app/api/auth/line/start/route.ts:34-40
response.cookies.set("line_oauth_state", state, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",  // ← NODE_ENV 依存
  sameSite: "lax",
  maxAge: 600,
  path: "/",
})
```

### リスクシナリオ

1. 将来的に Docker / EC2 等へ移行
2. staging 環境で `NODE_ENV=staging` 等の設定
3. HTTPS で運用していても `secure=false` で state クッキーが送信される
4. MitM 攻撃者が state を傍受 → CSRF の余地が発生

---

## 現在のリスク評価

- **Vercel 環境（現在）**: NODE_ENV は常に `"production"` → secure=true → **実被害なし**
- **将来の移行時**: NODE_ENV 依存のため secure=false になりうる

---

## 対応方針

```typescript
// 案A: NEXT_PUBLIC_APP_URL が https:// で始まるかで判断
secure: process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ??
        process.env.NODE_ENV === "production"

// 案B: 専用の環境変数を追加
secure: process.env.COOKIE_SECURE === "true"

// 案C: 常に true（開発時に影響するが最もセキュア）
secure: true
```

---

## 完了条件

- [ ] secure フラグを HTTPS URL の有無に基づいて設定する
- [ ] `line_oauth_state` と `line_oauth_return_to` の両クッキーに適用
- [ ] ローカル開発（HTTP）での LINE OAuth フローが壊れていないことを確認

## 注意点

- ローカル開発で `http://localhost` を使う場合 `secure=true` にすると Cookie が送信されない
- 案A が最も現実的（NEXT_PUBLIC_APP_URL は既にプロジェクト全体で使用されている）

## 関連ファイル
- `app/api/auth/line/start/route.ts`
