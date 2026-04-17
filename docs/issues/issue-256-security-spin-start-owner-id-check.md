# ISSUE-256: Security(Low) — spin-start の ownerId 早期チェック欠如（✅ 修正済み）

## ステータス
🔲 TODO

## 優先度
**Low / セキュリティ（設計一貫性）**

## カテゴリ
Security / Authorization / Consistency

---

## 概要

`spin-complete`, `spin`, `reset` では認証ルームへの未認証アクセスを早期に 401 で拒否しているが、
`spin-start` にはこの早期チェックが存在しない。
機能的には認証ルームへのゲストアクセスを else ブランチの HMAC 検証で防いでいるため
**セキュリティ上の脆弱性はない**が、コードの一貫性が低下している。

---

## 問題

```typescript
// spin-complete/route.ts, spin/route.ts, reset/route.ts に存在する早期チェック
if (room.ownerId && !user) {
  return NextResponse.json({ error: "ログインが必要です" }, { status: 401 })
}

// ↑ spin-start/route.ts にはこれがない
```

### 現在の spin-start の動作

認証ルーム（`ownerId !== null`）へ未認証でアクセスした場合：
1. `else` ブランチに到達
2. `hostMember = findFirst({ isHost: true, profileId: null })` → `null`（認証ルームのホストは profileId を持つ）
3. `!hostMember` → 403 を返す

**セキュリティ的には同等**だが、エラーが 401 ではなく 403 になる点が異なる。

---

## 現在のリスク評価

- **脆弱性**: なし（HMAC 検証で正しく拒否される）
- **問題**: HTTP ステータスが不適切（未認証なのに 403 を返す）
- **保守性**: 他のエンドポイントと設計が一致していない

---

## 対応方針

```typescript
// spin-start/route.ts に以下を追加
const room = await prisma.room.findUnique({
  where: { inviteCode: code.toUpperCase() },
  select: { id: true, status: true, ownerId: true },  // ← ownerId を追加
})

// 認証ルームへの未認証アクセスを早期拒否
if (room.ownerId && !user) {
  return NextResponse.json({ error: "ログインが必要です" }, { status: 401 })
}
```

---

## 完了条件

- [ ] spin-start に `if (room.ownerId && !user) return 401` を追加
- [ ] Prisma query に `ownerId` を追加
- [ ] 既存の認証フローに影響なし

## 注意点

- セキュリティ上は問題ないため低優先度
- 将来のエンドポイント追加時のコーディング規約として CLAUDE.md に記載することも検討

## 関連ファイル
- `app/api/rooms/[code]/spin-start/route.ts`
