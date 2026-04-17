# ISSUE-272: `POST /api/groups` — participants配列要素の個別バリデーション不足

## 概要

`POST /api/groups` で `participants` が配列であることは確認しているが、
各要素の内部フィールド（`name` 等）の型・長さ・文字種が個別に検証されていない。
Prismaが最終的に型チェックするため即座な実害は限定的だが、
不正な入力に対して内部DBエラーがそのままクライアントに漏れる可能性がある。

---

## 対象ファイル

`app/api/groups/route.ts` — line 49

---

## 現状コード

```typescript
// 現状: 配列の存在チェックのみ
if (typeof name !== "string" || !name.trim() || !Array.isArray(participants)) {
  return NextResponse.json({ error: "Invalid request" }, { status: 400 })
}

// participants の各要素はバリデーションなしで DB に渡される
const group = await prisma.userGroup.upsert({
  ...
  update: { participants },
  create: { userId: user.id, name: name.trim(), participants },
})
```

---

## 問題の詳細

| 問題 | 内容 |
|------|------|
| 要素の型未検証 | `participants` の各要素が object であるか未確認 |
| `name` フィールド未検証 | 各要素の `name` が string か、空でないか、長さ制限があるか未確認 |
| エラー情報漏洩 | Prisma バリデーションエラーが `Internal server error` としてログに出るが、不必要な情報が含まれる |
| 配列長制限なし | 極端に大きい配列（例: 10000要素）が受け付けられる |

---

## 修正内容

```typescript
// app/api/groups/route.ts

const PARTICIPANT_NAME_MAX = 100
const PARTICIPANTS_MAX = 200

const body = await request.json()
const { name, participants } = body

// グループ名バリデーション
if (typeof name !== "string" || !name.trim() || name.length > 100) {
  return NextResponse.json({ error: "Invalid request" }, { status: 400 })
}

// participants配列バリデーション
if (!Array.isArray(participants) || participants.length > PARTICIPANTS_MAX) {
  return NextResponse.json({ error: "Invalid request" }, { status: 400 })
}

for (const p of participants) {
  if (
    typeof p !== "object" || p === null ||
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.length > PARTICIPANT_NAME_MAX
  ) {
    return NextResponse.json({ error: "参加者名が不正です" }, { status: 400 })
  }
}
```

---

## 受け入れ条件

- [ ] participants 各要素の `name` が string・非空・100文字以内であることを検証
- [ ] participants 配列の長さが 200 以下であることを検証
- [ ] グループ名の長さ上限（100文字）を明示的に検証
- [ ] 不正入力に対して 400 + 具体的エラーメッセージを返す
- [ ] `pnpm typecheck` 通過

---

## 優先度: Medium

- 認証済みユーザーのみアクセス可能（401で未認証は弾かれる）
- Prismaが型安全に処理するため即座のSQLインジェクション等はなし
- ただしエラー情報漏洩と大量データ投入のリスクがある

## 関連ISSUE
- ISSUE-266: RLS監査（セキュリティ再確認の起点）
