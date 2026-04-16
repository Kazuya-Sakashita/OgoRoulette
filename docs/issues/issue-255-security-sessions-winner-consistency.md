# ISSUE-255: Security(Low) — sessions API の winnerIndex / winnerName 矛盾の潜在的不整合

## ステータス
🔲 TODO

## 優先度
**Low / セキュリティ**

## カテゴリ
Security / Data Integrity / Sessions API

---

## 概要

`POST /api/sessions` でクライアントが `winnerIndex` と `winnerName` を両方送れる設計になっており、
矛盾する値を送った場合の動作が暗黙的（`winnerIndex` 優先）であるため、
将来のコード変更で不整合が発生するリスクがある。

---

## 問題

```typescript
// app/api/sessions/route.ts
isWinner: typeof winnerIndex === "number"
  ? p.index === winnerIndex    // ← winnerIndex 優先
  : p.name === winnerName,    // ← フォールバック
```

### 矛盾ペイロード例

```json
{
  "winnerIndex": 0,        // index 0 のゲストAを当選者に
  "winnerName": "ゲストB",  // だがゲストBの名前も送る
  "participants": [
    { "name": "ゲストA", "color": "#F97316", "index": 0 },
    { "name": "ゲストB", "color": "#EC4899", "index": 1 }
  ]
}
```

**現在の動作**: `winnerIndex=0` が優先されるため「ゲストA」が当選者になる（winnerName は無視される）。
これはホームページのソロスピン（自分の履歴保存）にのみ影響する。

---

## 現在のリスク評価

- **影響範囲**: 自分のセッション履歴のみ（他ユーザーへの影響なし）
- **悪用シナリオ**: 自分の奢り履歴を改ざんして別の人を当選者に記録できる
- **実被害**: ISSUE-248 のバリデーション強化で軽減済み

---

## 対応方針

```typescript
// 案A: winnerIndex のみを受け入れ winnerName をサーバーで算出
const resolvedWinnerName = safeParticipants.find(p => p.index === winnerIndex)?.name ?? winnerName

// 案B: 矛盾チェックを追加
if (typeof winnerIndex === "number" && winnerName) {
  const expectedName = safeParticipants.find(p => p.index === winnerIndex)?.name
  if (expectedName && expectedName !== winnerName) {
    return NextResponse.json({ error: "winnerIndex と winnerName が矛盾しています" }, { status: 400 })
  }
}
```

---

## 完了条件

- [ ] `winnerIndex` が存在する場合は `winnerName` をサーバーで導出する
- [ ] または矛盾時にエラーを返す

## 注意点

- この API はログインユーザーのホームページスピン履歴保存にのみ使用
- ルームスピンは `/api/rooms/[code]/spin` で完全にサーバー決定 → 影響なし

## 関連ファイル
- `app/api/sessions/route.ts`
