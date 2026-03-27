# ISSUE-041: GUEST_HOST_SECRET の最小長・強度検証がない

## 概要

`app/api/rooms/route.ts` では `GUEST_HOST_SECRET` の存在チェックのみを行い、最小長・強度の検証がない。弱いシークレット（例: `"abc"` や `"secret"` など）を設定した場合、ゲストホスト認証の HMAC-SHA256 署名が事実上無意味になり、なりすましが可能になる。

## 背景

`lib/guest-token.ts` では HMAC-SHA256 を使ってゲストホストのトークンに署名しており、`GUEST_HOST_SECRET` が署名鍵として使われる。HMAC の安全性は鍵のエントロピーに依存するため、鍵が短い・推測可能な場合はブルートフォース攻撃で偽造トークンが生成できる。

## 問題点

### 現在何が起きているか
```typescript
// app/api/rooms/route.ts:67
if (!process.env.GUEST_HOST_SECRET) {
  console.error("[rooms] GUEST_HOST_SECRET is not configured")
  return NextResponse.json({ error: "サーバー設定エラーが発生しました" }, { status: 500 })
}
// ← 存在確認のみ。長さ・強度の検証なし。
```

設定例として `GUEST_HOST_SECRET=secret` のような弱い値でもサーバーが起動してしまう。

### ユーザー影響
- 通常ユーザーへの直接影響はないが、攻撃者がゲストホストになりすましてルーレットを不正操作できる

### 技術的影響
- HMAC-SHA256 の安全性はキー長に依存。32バイト未満のキーはブルートフォース耐性が低下する
- `timingSafeEqual` による timing attack 対策が実装済みでも、キーが弱いと迂回される

## 原因

フェイルファスト実装時に存在確認のみ追加し、長さ・強度検証を省略した。

## 修正方針

起動時（フェイルファスト箇所）または `lib/guest-token.ts` の初期化時に最小長を検証する。

```typescript
// app/api/rooms/route.ts または lib/guest-token.ts
const secret = process.env.GUEST_HOST_SECRET
if (!secret) {
  throw new Error("GUEST_HOST_SECRET is not configured")
}
if (secret.length < 32) {
  throw new Error(
    `GUEST_HOST_SECRET is too short (${secret.length} chars). Minimum 32 chars required. ` +
    "Generate with: openssl rand -hex 32"
  )
}
```

加えて `.env.example` にコメントで推奨生成コマンドを記載する：
```
# 必須: ゲストホストトークンの HMAC 署名鍵 (最小32文字)
# 生成コマンド: openssl rand -hex 32
GUEST_HOST_SECRET=
```

## タスク
- [ ] `app/api/rooms/route.ts` のフェイルファスト箇所に最小長検証を追加
- [ ] `app/api/rooms/[code]/spin/route.ts` にも同様の検証を追加（HMAC 検証箇所）
- [ ] `.env.example` に推奨生成コマンドをコメントで記載
- [ ] 本番の `GUEST_HOST_SECRET` が 32 文字以上であることを確認

## 受け入れ条件
- 32文字未満の `GUEST_HOST_SECRET` でサーバー起動時に明確なエラーが出力される
- エラーメッセージに推奨生成コマンドが含まれる
- 32文字以上の場合は通常通り動作する

## 優先度
Medium

## デプロイブロッカー
No（本番環境で適切な長さのシークレットが設定されていれば問題なし。ただし設定ミスのセーフガードとして実装推奨）
