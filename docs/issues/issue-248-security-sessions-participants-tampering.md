# ISSUE-248: Security(Medium) — /api/sessions のクライアント送信 participants 改ざん（✅ 修正済み）

## ステータス
🔲 TODO

## 優先度
**Medium / セキュリティ**

## カテゴリ
Security / Data Integrity / API

---

## 概要

`POST /api/sessions`（ホームページのスピン結果保存）がクライアント送信の
`participants` 配列をバリデーションなしで DB に保存している。
ログインユーザーが自分のセッション履歴を任意の参加者名・当選者名で記録できる。

---

## 問題

```typescript
// app/api/sessions/route.ts:127-135
participants: {
  create: (participants as { name: string; color: string; index: number }[]).map((p) => ({
    name: p.name,      // ← クライアント送信値をそのまま使用
    color: p.color,
    isWinner: typeof winnerIndex === "number"
      ? p.index === winnerIndex
      : p.name === winnerName,
    // ...
  })),
}
```

### 悪用シナリオ

```bash
# ログインユーザーが細工したリクエストを送信
curl -X POST https://ogo-roulette.vercel.app/api/sessions \
  -H "Authorization: Bearer <valid_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "winnerName": "自分",
    "winnerIndex": 0,
    "participants": [
      {"name": "自分", "color": "#red", "index": 0},
      {"name": "田中部長", "color": "#blue", "index": 1}
    ],
    "totalAmount": 100000,
    "treatAmount": 100000
  }'
```

これにより「田中部長が参加していた」という虚偽の履歴が DB に保存される。

---

## 原因

ホームページ（ソロスピン）では実際のルームがないため、
サーバー側で participants を検証する方法が限られている。

---

## 影響

- **影響範囲**: 自分のセッション履歴のみ（他ユーザーへの直接影響なし）
- **深刻度**: Medium（自己の履歴改ざんであり、他者への被害は限定的）
- **将来リスク**: 統計や AI 機能でセッションデータを使う場合に問題が顕在化

---

## 対応方針

### 案A: participants の文字列サニタイズを追加（短期）

```typescript
const safeParticipants = (participants as Array<{name: string; color: string; index: number}>)
  .filter((p) => typeof p.name === "string" && p.name.trim().length > 0 && p.name.length <= 20)
  .slice(0, 20)  // 最大人数を制限
  .map((p) => ({
    ...p,
    name: p.name.trim(),
    color: VALID_COLORS.includes(p.color) ? p.color : SEGMENT_COLORS[0],  // 色もバリデーション
  }))
```

### 案B: winnerName の整合性チェック（追加）

```typescript
// winnerName が participants の中に存在することを確認
if (winnerName && !safeParticipants.some((p) => p.name === winnerName)) {
  return NextResponse.json({ error: "Invalid winner" }, { status: 400 })
}
```

---

## 完了条件

- [ ] `participants` の各要素に長さ・型バリデーションを追加
- [ ] participants 数の上限チェック（最大 20 名）
- [ ] `winnerName` が `participants` リストに含まれることを検証
- [ ] `color` が `SEGMENT_COLORS` の値であることを検証

## 注意点

- この API はログインユーザーのみ呼び出せる（ゲストはローカル履歴のみ）
- ルームスピン（`/api/rooms/[code]/spin`）は DB から participants を取得するため、この問題はない

## 関連ファイル
- `app/api/sessions/route.ts`
- `lib/constants.ts`（SEGMENT_COLORS）
