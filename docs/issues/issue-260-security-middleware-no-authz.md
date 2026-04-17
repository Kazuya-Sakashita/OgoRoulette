# ISSUE-260: Security(Low) — middleware が認可を担わず、ページルートの保護がクライアント依存（✅ 設計方針として文書化済み）

## ステータス
✅ 設計方針として文書化済み（2026-04-17）
- `middleware.ts` に設計方針コメントを記録済み（`393fc69`）
- ISSUE-264 で CLAUDE.md に Server Components 認可規約を追記済み
- 現時点では API 側の保護が十分であることが確認・文書化された

## 優先度
**Low / 設計懸念**

## カテゴリ
Security / Authorization / Middleware / Design

---

## 概要

`middleware.ts` は Supabase セッションの refresh のみを行い、
ページルートの認可チェック（認証必須ページへの未認証アクセス防止）は実装されていない。
現状では認証必須の機能はすべて API 側で保護されているが、
ページ自体（`/room/[code]/play` 等）はサーバー側で保護されていない。

---

## 問題

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  return await updateSession(request)  // セッション refresh のみ
}

// 認可チェックなし — 例:
// /room/[code]/play を未認証で直接アクセスしても
// サーバー側でリダイレクトされない
```

### 現在の保護状況

| ルート | 保護方式 | リスク |
|--------|---------|--------|
| `/room/[code]/play` | クライアント useEffect で確認 | 一瞬ページが表示される |
| `/home` | なし（意図的にオープン） | 問題なし |
| `/api/*` | 各 route handler で認証/認可 | 安全 |

---

## 実際のリスク

- 現在は `クライアント側で認証確認 → 必要なら redirect` のフローのみ
- **データは API 経由でのみ取得** されるため、API 側の認可が正しければデータ漏洩はない
- ただし、認証前のページが一瞬フラッシュする（UI 上の問題）
- ミドルウェアで保護しないと、将来の Server Components 追加時に漏洩リスクが高まる

---

## 影響

- **現在のセキュリティ影響**: 低（API 側で保護済み）
- **将来のリスク**: Server Components で直接データを fetch した場合、ミドルウェア保護がないとデータ漏洩
- **UX 影響**: 未認証ユーザーが保護ページを一瞬見られる（フラッシュ）

---

## 対応方針

```typescript
// middleware.ts への追加案
export async function middleware(request: NextRequest) {
  const response = await updateSession(request)

  // 将来 Server Components でデータを fetch するルートが増えた場合に追加
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user && request.nextUrl.pathname.startsWith('/protected-page')) {
  //   return NextResponse.redirect(new URL('/auth/login', request.url))
  // }

  return response
}
```

---

## 完了条件

- [ ] 将来 Server Components でデータを fetch するルートが追加された場合、middleware で保護する
- [ ] 現時点では API 側の保護が十分であることを文書化

## 注意点

- 現在の設計（クライアント side 認証 + API 側認可）は Next.js App Router での一般的なパターン
- 過度な middleware 認可は `updateSession` のパフォーマンスに影響するため慎重に

## 関連ファイル
- `middleware.ts`
