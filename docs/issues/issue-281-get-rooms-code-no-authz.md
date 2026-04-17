# ISSUE-281: High — GET /api/rooms/[code] に認可チェックなし

## ステータス
🔲 TODO

## 優先度
**High / セキュリティ / 認可**

## カテゴリ
Security / Authorization / API / Information Disclosure

---

## 問題

`GET /api/rooms/[code]` はルームの全情報（参加者リスト・セッション結果・当選者名）を返すが、
認証チェックもルームメンバーシップ確認も実施していない。

```typescript
// app/api/rooms/[code]/route.ts（現状）
export async function GET(req: NextRequest, { params }: ...) {
  const { code } = await params
  // ← 認証チェックなし
  // ← ルームメンバー確認なし
  const room = await prisma.room.findUnique({ where: { code }, include: { ... } })
  return NextResponse.json(room)
}
```

ルームコード（6文字英数字）を知っている第三者が、直接 curl でルーム情報を取得できる。

---

## なぜ危険か

- 参加者の名前・LINE プロフィールが漏洩する
- 過去のスピン結果（当選者名・金額）が外部から取得される
- ルームコードはブルートフォースでも列挙可能（6文字英数字 = 36^6 ≈ 2.1 億通り）
- Supabase RLS はデータ層では保護しているが、このエンドポイントは API 層で Prisma 経由のためバイパス

---

## 発生条件

- 認証なしで `GET /api/rooms/[code]` を呼び出す（ブラウザ・curl どちらでも）
- 特定のルームコードを知っている（または推測した）第三者

---

## 影響範囲

- 全ルームの参加者情報
- 全スピン結果（当選者名・金額）
- ゲストモード参加者（非ログインユーザー）の名前

---

## 推定原因

ゲストモード（未認証）でのルーム参加をサポートするために認証チェックを意図的に省いた可能性がある。
ただしゲストも「ルームコードを知っている」という前提で保護できるはず。

---

## 修正方針

### 案A: HMAC トークン検証を追加する（推奨）

ISSUE-245/276 の HMAC 方式に倣い、ルーム参加時に発行したゲストトークンを検証する。

### 案B: Supabase セッション または ゲストトークンのいずれかを必須にする

```typescript
export async function GET(req: NextRequest, ...) {
  const supabase = createRouteHandlerClient(...)
  const { data: { user } } = await supabase.auth.getUser()
  const guestToken = req.headers.get("x-guest-token")

  if (!user && !isValidGuestToken(guestToken, code)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // ...
}
```

### 案C: レートリミットを強化（暫定対応）

ISSUE-277 のレートリミット修正後に、ブルートフォース対策として IP ベースの制限を強化する。
根本解決にはならないが、列挙攻撃の敷居を上げる。

---

## 受け入れ条件

- [ ] 認証なし・ゲストトークンなしの GET リクエストが 401 を返すこと
- [ ] ルームメンバー（ゲスト含む）は引き続きルーム情報を取得できること
- [ ] ゲストモードのフロー（QR スキャン → ルーム参加）が壊れないこと
- [ ] `npx tsc --noEmit` エラーなし

## 関連ファイル

- `app/api/rooms/[code]/route.ts`

## 関連 ISSUE

- ISSUE-277: レートリミット修正（関連する認可不足対策）
- ISSUE-245: HMAC ゲストトークン（参考実装）
