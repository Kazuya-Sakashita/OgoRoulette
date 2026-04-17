# ISSUE-264: Security(Medium) — Server Components 導入時の middleware 認可リスク（✅ 規約記録済み）

## ステータス
✅ 規約記録済み（2026-04-17）— CLAUDE.md に Server Components コーディング規約を追記

## 優先度
**Medium / セキュリティ（予防的）**

## カテゴリ
Security / Authorization / Middleware / Future Risk

---

## 概要

現在の OgoRoulette は Client Components が中心で、データはすべて API route 経由で取得している。
この設計では API 側の認証・認可チェックが最終防衛ラインとして機能しており安全だが、
将来 Server Components でデータを直接 fetch する実装を追加した場合、
現在の `middleware.ts`（セッション refresh のみ）では保護が不十分になるリスクがある。

---

## 問題

```typescript
// middleware.ts — 現状はセッション refresh のみ
export async function middleware(request: NextRequest) {
  return await updateSession(request)
  // ← ページルートの認可チェックなし
}
```

### 安全な現在の設計

```
Client Component → useEffect → fetch('/api/data') → API route で認証・認可
                                                       ↑ ここで JWT / HMAC 検証
```

### 将来のリスクシナリオ

```
// もし以下のような Server Component が追加された場合
async function UserDashboard() {
  const data = await prisma.session.findMany()  // ← ここで直接 DB アクセス
  return <div>{data}</div>
}
// → middleware で認可チェックがないと、未認証ユーザーに全セッションが見える
```

---

## 現在のリスク評価

- **現時点のセキュリティ影響**: なし（Server Components でデータを直接 fetch していない）
- **将来のリスク**: 高（Server Components 導入時に認可漏れが発生しやすい）
- **発生確率**: 中（Next.js 16 では Server Components が推奨パターン）

---

## 対応方針

### 将来 Server Components でデータを fetch する際の必須対応

```typescript
// middleware.ts に追加すべき認可チェックの雛形
export async function middleware(request: NextRequest) {
  const response = await updateSession(request)

  // 保護ページの定義（将来追加時）
  const protectedPaths = ['/dashboard', '/admin']
  if (protectedPaths.some(p => request.nextUrl.pathname.startsWith(p))) {
    const supabase = createServerClient(/* ... */)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}
```

### コーディング規約として記録

Server Components でデータを fetch する実装を追加するプルリクエストには、
以下のチェックリストを必須とする：

- [ ] データ取得前に `auth.getUser()` または API route 経由か確認
- [ ] middleware に保護ルートが追加されているか確認
- [ ] セキュリティレビューを受けたか確認

---

## 完了条件

- [ ] Server Components でデータを直接 fetch する実装を追加する際に、このISSUEを参照してmiddleware を更新する
- [ ] CLAUDE.md にコーディング規約として記載する（Server Components 追加時の確認事項）

## 注意点

- 現時点では middleware の変更は不要
- Server Components の導入と同時にこの ISSUE を完了させること
- API route 経由のデータ取得であれば、現在の設計で安全

## 関連ファイル
- `middleware.ts`
- `CLAUDE.md`（将来のコーディング規約追加先）
