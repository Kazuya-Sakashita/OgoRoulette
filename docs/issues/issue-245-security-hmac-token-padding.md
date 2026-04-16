# ISSUE-245: Security(Medium) — HMAC ゲストトークン検証の padEnd 設計

## ステータス
🔲 TODO

## 優先度
**Medium / セキュリティ**

## カテゴリ
Security / Cryptography / Authentication

---

## 概要

`lib/guest-token.ts` の `verifyGuestToken` 関数において、
受け取ったトークンを hex デコード前に `padEnd(64, "0")` でゼロ埋めしている。
HMAC-SHA256 は常に 64 文字の hex を出力するため通常は問題が発生しないが、
長さの事前チェックがなく、短いトークンが送られた場合に予期しない動作をするリスクがある。

---

## 問題

```typescript
// lib/guest-token.ts:33-36
const tokenBuf = Buffer.from(token.padEnd(64, "0"), "hex")
const expectedBuf = Buffer.from(expected, "hex")
if (tokenBuf.length !== expectedBuf.length) return false
return timingSafeEqual(tokenBuf, expectedBuf)
```

### 問題点

1. **長さの事前検証がない**: トークンが 64 文字未満でも、`padEnd` でゼロ埋めして処理が続く
2. **`padEnd` は "0"（ゼロ文字）で埋める**: 例えば 62 文字のトークンは最後に "00" が付与されるが、
   これは意図とは異なる 16 進数列になる可能性がある
3. **`Buffer.from(str, "hex")` は奇数長を切り捨てる**: `padEnd` 前に長さチェックすべき

### 現在のリスク評価

- HMAC-SHA256 は常に 64 文字を返すため、正規フロー上は問題なし
- `timingSafeEqual` が適切に使われており、タイミング攻撃は防止されている
- 直接的な悪用シナリオは確認されていない（低確率の理論的リスク）

---

## 原因

長さバリデーションを `timingSafeEqual` の前に行っていない設計。

---

## 影響

- 現在の悪用可能性: 極めて低い
- ただし将来的なコード変更（SECRET の変更、トークン形式変更）でリスクが顕在化する可能性

---

## 対応方針

```typescript
export function verifyGuestToken(token: string, memberId: string, roomCode: string): boolean {
  if (!SECRET) return false
  // HMAC-SHA256 の hex は常に 64 文字。それ以外は即時拒否
  if (typeof token !== "string" || token.length !== 64) return false
  try {
    const expected = createHmac("sha256", SECRET)
      .update(`${memberId}:${roomCode}`)
      .digest("hex")
    const tokenBuf = Buffer.from(token, "hex")   // padEnd 不要
    const expectedBuf = Buffer.from(expected, "hex")
    if (tokenBuf.length !== expectedBuf.length) return false
    return timingSafeEqual(tokenBuf, expectedBuf)
  } catch {
    return false
  }
}
```

---

## 完了条件

- [ ] `token.length !== 64` の場合は即時 `false` を返す
- [ ] `padEnd(64, "0")` を削除する
- [ ] `verifyGuestToken` のユニットテストを追加（境界値: 空文字、63文字、65文字、64文字）

## 注意点

- `signGuestToken` は変更不要（`createHmac(...).digest("hex")` は常に 64 文字）

## 関連ファイル
- `lib/guest-token.ts`
