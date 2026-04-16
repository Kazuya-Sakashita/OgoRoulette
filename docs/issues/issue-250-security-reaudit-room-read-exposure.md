# ISSUE-250: Security Re-audit(High) — GET /api/rooms/[code] の認可なし・セッション履歴露出

## ステータス
🔲 TODO

## 優先度
**High / セキュリティ**

## カテゴリ
Security / Authorization / Privacy / Rate Limiting

---

## 概要

`GET /api/rooms/[code]` が認可チェックおよびレート制限なしで公開されており、
ルームコードを知っていれば誰でもメンバーリスト・セッション履歴（当選者名・奢り金額）を取得できる。
ルームコードは QR コードで共有される設計のため一定の情報公開は意図的だが、
**金額情報を含む過去セッション履歴**が無制限に取得できる点は許容範囲外。
またレート制限がないためルームコードの列挙攻撃（ブルートフォース）が可能。

---

## 問題

```typescript
// app/api/rooms/[code]/route.ts (全体)
export async function GET(request: Request, ...) {
  const room = await prisma.room.findUnique({
    where: { inviteCode: code.toUpperCase() },
    include: {
      sessions: {          // ← セッション履歴を返す
        take: 5,
        include: {
          participants: { where: { isWinner: true } }  // 当選者名・色
        }
      }
    }
  })
  // ← 認証チェックなし
  // ← レート制限なし
  return NextResponse.json({ ...room, members: sanitizedMembers })
}
```

### 漏洩する情報

| フィールド | 含まれる情報 | 感度 |
|-----------|------------|------|
| `members[].nickname` | 参加者名 | 低（ニックネーム） |
| `owner.displayName` | オーナーの公開名 | 中 |
| `sessions[].participants` | 直近5回の当選者名 | 中 |
| ※金額はセッション詳細 API からのみ | — | — |

**注**: セッション金額（treatAmount）は `GET /api/sessions/[id]` に認証付きで分離されており、
このエンドポイントでは直接は露出しない。ただし当選者名は露出する。

---

## 悪用シナリオ

### 1. ルームコードの列挙（ブルートフォース）

```bash
# レート制限なし → 高速列挙が可能
for code in $(generate_codes); do
  result=$(curl -s "https://ogo-roulette.vercel.app/api/rooms/$code")
  if [[ $result != *"not found"* ]]; then
    echo "Found room: $code"
    echo "$result" | jq '.members[].nickname'
  fi
done
```

- 6文字 × 33進数 = 約13億通り
- レート制限なし → 分間数千リクエスト可能
- 現実的には大規模インフラが必要だが、設計上防御がない

### 2. 知っているコードで他グループの情報取得

- SNS でシェアされたルームリンクから code を抽出
- 終了後のルームの当選履歴を閲覧

---

## 原因

`GET /api/rooms/[code]` は参加者がルーム状態を取得するための必須エンドポイントだが、
認証・レート制限の両方が欠如している。

---

## 対応方針

### 1. レート制限を追加（必須）

```typescript
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

const ip = getClientIp(request.headers)
const { allowed } = await checkRateLimit(ip, "room-read", 30, 60_000)
if (!allowed) {
  return NextResponse.json({ error: "Too many requests" }, { status: 429 })
}
```

### 2. セッション履歴を非メンバーに返さない（推奨）

```typescript
// ルームメンバーか確認（認証ユーザーまたはゲスト）
const isMember = user
  ? room.members.some((m) => m.profileId === user.id)
  : true  // ゲストは参加時に code を知っている → 信頼する

// 非メンバー（コードを知っているだけ）にはセッション履歴を返さない
const response = {
  ...room,
  members: sanitizedMembers,
  sessions: isMember ? room.sessions : [],
}
```

---

## 完了条件

- [ ] `GET /api/rooms/[code]` に IP ベースのレート制限を追加（30回/分）
- [ ] セッション履歴を非メンバー（認証なし）に返さない制御を追加
- [ ] 修正後にルームへの正常なアクセスフロー（join → play）が壊れていないことを確認

## 注意点

- このエンドポイントはゲストが QR スキャン後に呼び出すため、**完全な認証必須化は不可**
- レート制限のみでも brute force リスクは大幅に下がる（最優先対応）
- セッション履歴の制限は UX への影響が小さく実装しやすい（第二優先）

## 関連ファイル
- `app/api/rooms/[code]/route.ts`
- `lib/rate-limit.ts`
