# ISSUE-265: Security(Low) — LINE OAuth metadata 更新エラー時のプロフィール不一致リスク（✅ 実装済み）

## ステータス
✅ 実装済み（2026-04-17）— 案A が既に実装されていることをコード確認で確認
- `app/api/auth/line/callback/route.ts` の Prisma upsert（step 6）が
  `lineProfile.displayName` / `lineProfile.pictureUrl` を直接使用している
- `updateUserById` の成否に関わらず、Prisma profile は常に最新 LINE データで更新される
- ISSUE で懸念した「古い user_metadata 経由での更新」は発生しない

## 優先度
**Low / セキュリティ（データ整合性）**

## カテゴリ
Security / Authentication / Data Consistency / LINE OAuth

---

## 概要

ISSUE-258 で LINE OAuth の metadata 更新を blocking（await）に変更したが、
更新が失敗した場合はエラーをログに記録してログイン処理を継続する設計になっている。
この設計は意図的なもの（プロフィール更新失敗でログインをブロックしない）だが、
更新失敗が続いた場合、アプリ側のプロフィール表示名が古いまま残り続けるリスクがある。

---

## 現状の実装

```typescript
// app/api/auth/line/callback/route.ts
// ISSUE-258: blocking に変更済み
const { error: updateError } = await supabaseAdmin.auth.admin
  .updateUserById(supabaseUserId, { user_metadata: lineUserMeta })
if (updateError) {
  // エラー時はログに記録のみ — ログイン処理自体は継続する
  console.warn("[LINE callback] step=user_update WARN", { message: updateError.message })
}
```

---

## リスクシナリオ

1. ユーザーが LINE で表示名を「田中」→「田中 太郎」に変更
2. OgoRoulette に LINE でログイン
3. `updateUserById` が一時的なエラー（Supabase API タイムアウト等）で失敗
4. `console.warn` のみ記録され、ログイン処理は継続
5. Prisma の `profile.upsert` が Supabase session の user_metadata（古い「田中」）で更新
6. 次回ログインでも同じエラーが繰り返された場合、「田中」が継続表示される

---

## 現在のリスク評価

- **セキュリティ影響**: なし（認証自体は成功している）
- **データ整合性影響**: 低（表示名が古いまま残る可能性）
- **UX 影響**: 低（LINE で名前を変更したが OgoRoulette に反映されない）
- **発生確率**: 極めて低（Supabase の一時的な障害時のみ）

---

## 対応方針

### 案A: Prisma profile.upsert で LINE プロフィールを直接使用（推奨）

metadata 更新の成否に関わらず、Prisma の upsert で LINE API から取得した最新データを使う：

```typescript
// 現状: Supabase session の user_metadata からプロフィールを更新
// → metadata 更新が失敗した場合、古いデータで upsert される

// 改善案: LINE API から取得した lineProfile を直接 Prisma に渡す
await prisma.profile.upsert({
  where: { id: supabaseUserId },
  update: {
    name: lineProfile.displayName,  // ← Supabase metadata 経由ではなく直接使用
    avatarUrl: lineProfile.pictureUrl ?? null,
  },
  create: {
    id: supabaseUserId,
    email: lineEmail,
    name: lineProfile.displayName,
    avatarUrl: lineProfile.pictureUrl ?? null,
  },
})
```

### 案B: 現状維持（許容判断）

- metadata 更新失敗は極めてまれ
- 次回ログイン時に再試行される（blocking に変更済みのため）
- プロフィール名が一時的に古くなるだけで、セキュリティ上の問題はない
- 実装変更によるリスクより現状の許容の方が合理的

---

## 完了条件

- [ ] 案A を採用する場合: LINE プロフィールを Prisma upsert に直接渡す実装に変更
- [ ] 案B を採用する場合: このISSUEを「許容済み」としてクローズ
- [ ] どちらの場合も、設計判断をコメントとして残す

## 注意点

- `lineProfile` は callback の初期で取得済みのため、案Aは追加の API 呼び出しが不要
- Supabase Auth の metadata と Prisma の profile は現在部分的に同期しているため、
  切り離す場合は全体的な整合性を確認する

## 関連ファイル
- `app/api/auth/line/callback/route.ts`
