# ISSUE-247: Security(High) — X-Forwarded-For スプーフィングによるレート制限回避（✅ 修正済み）

## ステータス
🔲 TODO

## 優先度
**High / セキュリティ**

## カテゴリ
Security / Rate Limiting / DoS

---

## 概要

`lib/rate-limit.ts` の `getClientIp` 関数が `X-Forwarded-For` ヘッダーの最初の値を
そのまま IP アドレスとして使用している。
このヘッダーはクライアントが自由に設定できるため、
攻撃者が任意の IP を偽装してレート制限を回避できる。

---

## 問題

```typescript
// lib/rate-limit.ts:117-123
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  )
}
```

### 悪用シナリオ

```bash
# 攻撃者がループで異なる IP を偽装しながらルームを大量作成
for i in $(seq 1 1000); do
  curl -X POST https://ogo-roulette.vercel.app/api/rooms \
    -H "X-Forwarded-For: 192.168.1.$((i % 255))" \
    -H "Content-Type: application/json" \
    -d '{"maxMembers":6,"guestNickname":"bot"}'
done
```

この攻撃により：
- Supabase / Prisma のコネクション枯渇
- Vercel の関数実行コスト増大
- 正規ユーザーの体験悪化（遅延・エラー増加）

---

## 原因

Vercel のプロキシを経由する場合、クライアントの本物の IP は
`X-Forwarded-For` の **末尾** または Vercel 独自ヘッダーに入る。
最初の値を取ると偽装値を取得してしまう。

---

## 影響

- レート制限が機能しない（ルーム作成、スピン等の API）
- DoS・スパム攻撃のリスク増大
- Vercel / Supabase の利用コスト増大

---

## 対応方針

### Vercel 環境での正しい IP 取得

Vercel は `x-forwarded-for` の末尾に実際のクライアント IP を追加する：

```typescript
export function getClientIp(headers: Headers): string {
  // Vercel: x-forwarded-for の末尾が実際のクライアント IP
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const ips = forwarded.split(",").map((s) => s.trim())
    return ips[ips.length - 1]  // 末尾を使用
  }
  return headers.get("x-real-ip") ?? "unknown"
}
```

または Vercel 専用ヘッダーを使用（要検証）：

```typescript
// Vercel は x-vercel-forwarded-for を設定する場合がある
headers.get("x-vercel-forwarded-for") ?? ...
```

---

## 完了条件

- [ ] `getClientIp` を Vercel 環境の IP 取得方法に合わせて修正
- [ ] 修正後、レート制限が正常に機能することを確認
- [ ] `X-Forwarded-For` スプーフィングのテストケースを追加

## 注意点

- Vercel のプロキシ動作は公式ドキュメントで確認すること
- ローカル開発環境では `"unknown"` が IP になる場合があるため、開発時の挙動を確認

## 関連ファイル
- `lib/rate-limit.ts`
