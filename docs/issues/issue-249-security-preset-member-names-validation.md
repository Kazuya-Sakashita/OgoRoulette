# ISSUE-249: Security(Low) — presetMemberNames の重複・整合性チェック不足（✅ 修正済み）

## ステータス
🔲 TODO

## 優先度
**Low / セキュリティ**

## カテゴリ
Security / Input Validation / Data Integrity

---

## 概要

`POST /api/rooms` で受け取る `presetMemberNames` に重複チェックがない。
同じ名前のメンバーが複数作成され、ルーレット UI や統計処理で予期しない動作が起きる可能性がある。

---

## 問題

```typescript
// app/api/rooms/route.ts:95-101
const validPresetNames: string[] = Array.isArray(presetMemberNames)
  ? presetMemberNames
      .filter((n: unknown): n is string =>
        typeof n === "string" && n.trim().length > 0 && n.trim().length <= 20)
      .map((n: string) => n.trim())
      .slice(0, 19)
  : []
// ← 重複チェックなし
```

### 例

```json
{
  "presetMemberNames": ["太郎", "太郎", "太郎", "花子"],
  "guestNickname": "ホスト"
}
```

この場合、ルーレットに「太郎」が3セグメント登録され、
当選確率が意図せず上がる。

---

## 原因

配列の重複排除処理が実装されていない。

---

## 影響

- **ルーレット公平性**: 同じ名前が複数セグメントに割り当てられ、当選確率が操作できる
- **セキュリティ分類**: Low（悪意ある利用は自分のルームのみに限られる）

---

## 対応方針

```typescript
const validPresetNames: string[] = Array.isArray(presetMemberNames)
  ? [...new Set(
      presetMemberNames
        .filter((n: unknown): n is string =>
          typeof n === "string" && n.trim().length > 0 && n.trim().length <= 20)
        .map((n: string) => n.trim())
    )].slice(0, 19)
  : []
```

---

## 完了条件

- [ ] `new Set()` で重複を排除する
- [ ] テスト：重複名が送信された場合にユニーク化されること

## 関連ファイル
- `app/api/rooms/route.ts`
