# ISSUE-042: LINE callback の profile upsert サイレント失敗でセッション確立後に後続 API が壊れる

## 概要

`app/api/auth/line/callback/route.ts` では、Prisma `profile.upsert` の失敗を `.catch()` で飲み込み、ユーザーを `/home` にリダイレクトする。profile が作成されていない状態でログインが「成功」すると、`profiles` テーブルを参照する後続 API（ルーム作成・ルーム参加・プロフィール更新）が FK 制約違反で 500 エラーになる。

## 背景

LINE コールバックは以下の構造になっている：

```typescript
// 6. Prisma profile upsert（ログインのたびに name / avatarUrl を同期）
await prisma.profile.upsert({
  where: { id: supabaseUserId },
  ...
}).catch((err) => {
  // プロフィール同期失敗はログのみ。ログインは継続する。  ← ここが問題
  console.error("[LINE callback] step=profile_upsert FAILED (non-blocking)", err)
})

// 7. state cookie を削除してリダイレクト
redirectResponse.cookies.delete("line_oauth_state")
return redirectResponse  // /home にリダイレクト（profile なしで成功扱い）
```

Google OAuth の callback も同様のパターンを採用しているが、Google の場合は Supabase が先にユーザーを作成してからコールバックが呼ばれるため、profile の FK 参照が成立しやすい。LINE は自前フローのため、profile が存在しない状態が起こりやすい。

## 問題点

### 現在何が起きているか
profile upsert が失敗するケース：
1. DB への接続が一時的に失敗した場合
2. email の unique 制約違反（極めて稀だが `line_{userId}@line.ogoroulette.app` で別ユーザーと衝突した場合）
3. プロビジョニングミスで `profiles` テーブルが存在しない場合

このとき：
- LINE ログインは "成功" し、Supabase セッションが確立される（`/home` にリダイレクト）
- しかし `profiles` テーブルに行が存在しない
- 以降 `/api/rooms` (POST) で `ownerId: user.id` → `profiles(id)` FK 制約違反 → 500
- `/api/rooms/join` で `profileId: user.id` → 同様に FK 違反 → 500
- ユーザーはログインできているのに何もできない状態になる

### ユーザー影響
- ログインは成功したように見えるが、ルーム作成・参加・プロフィール更新がすべて 500 エラーになる
- エラーメッセージが「サーバーエラーが発生しました」などの汎用メッセージのみで原因不明
- ログアウトして再ログインすると治る場合もあるが、ユーザーは気づけない

### 技術的影響
- profile がない状態を検知する手段がない（ログのみ）
- 再ログインで upsert が成功すれば自己修復するが、それをユーザーに伝えられない

## 原因

"best-effort profile sync" のパターンを LINE OAuth に適用した設計判断。Google OAuth と異なり LINE は自前の session establishment を行っているため、profile が必須かどうかの考慮が不足していた。

## 修正方針

profile upsert の失敗を blocking エラーとして扱う。

```typescript
try {
  await prisma.profile.upsert({
    where: { id: supabaseUserId },
    update: {
      name: lineProfile.displayName,
      avatarUrl: lineProfile.pictureUrl ?? null,
    },
    create: {
      id: supabaseUserId,
      email: lineEmail,
      name: lineProfile.displayName,
      avatarUrl: lineProfile.pictureUrl ?? null,
    },
  })
} catch (err) {
  console.error("[LINE callback] step=profile_upsert FAILED (blocking)", err)
  return NextResponse.redirect(`${origin}/auth/error`)
}
```

または、リダイレクト前に profile の存在確認を追加してリトライ機構を設ける。

## タスク
- [ ] `app/api/auth/line/callback/route.ts` の profile upsert を blocking エラー処理に変更
- [ ] profile upsert 失敗時に `/auth/error` へリダイレクト
- [ ] テストに「profile upsert 失敗 → /auth/error」ケースを追加
- [ ] Google OAuth の同様パターン (`app/auth/callback/route.ts`) の影響度を評価

## 受け入れ条件
- profile upsert が失敗した場合、ユーザーは `/auth/error` にリダイレクトされる
- `/home` にリダイレクトされた場合は必ず profile が存在する
- テストに失敗ケースのカバレッジがある

## 優先度
Medium

## デプロイブロッカー
No（profile upsert が失敗するケースは稀。ただし発生時の UX 破綻度が高いため早期対応推奨）
