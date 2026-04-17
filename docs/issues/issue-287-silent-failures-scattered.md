# ISSUE-287: Medium — silent failure がコード全体に散在し障害検知が不能

## ステータス
⚠️ 部分対応（2026-04-18）— ランキング取得失敗を console.error に格上げ。useEmojiReactions は調査済みでサイレント障害なし。スピン系エラーは既に setSpinError でUI表示済み。

## 優先度
**Medium / 可観測性 / 信頼性**

## カテゴリ
Observability / Error Handling / Silent Failure

---

## 問題

エラーが `console.warn` または何もせずに握りつぶされるパターンがコード全体に散在している。
ユーザーには何も見えないまま機能が動作しなくなる。

```typescript
// 例1: use-emoji-reactions.ts
reactChannelRef.current?.send({ type: "broadcast", event: "reaction", payload })
// ↑ エラーハンドリングなし。失敗してもリアクションが届かない

// 例2: app/api/auth/line/callback/route.ts
if (updateError) {
  console.warn("[LINE callback] step=user_update WARN", { message: updateError.message })
  // ↑ ログのみ。監視していなければ誰も気づかない
}

// 例3: use-spin.ts（推定）
try {
  const res = await fetch('/api/spin')
} catch (e) {
  // 何もしない
}
```

---

## なぜ危険か

- 本番環境で機能が壊れていても誰も気づかない（障害の検知ができない）
- ユーザーは「反応がない」「送れていないかも」と混乱し、連打 → 問題悪化
- デバッグ時に証跡がなく、根本原因の特定に時間がかかる
- リアクション・シェア・ログインなどの重要フローで silent failure が発生する可能性

---

## 発生条件

エラーが実際に発生したとき（ネットワーク障害・Supabase 障害・API エラー）。

---

## 主要な silent failure 箇所

| ファイル | 箇所 | 影響 |
|---------|------|------|
| `use-emoji-reactions.ts` | Broadcast send のエラーハンドリングなし | リアクションがサイレントに失敗 |
| `line/callback/route.ts` | `updateUserById` エラーを warn のみ | プロフィール更新失敗が不可視 |
| `use-spin.ts` | API 呼び出しエラーの一部 | スピン失敗がユーザーに伝わらない |
| `use-room-sync.ts` | `fetchRoom` エラー時 | ルーム状態の不整合が不可視 |

---

## 修正方針

### 優先順位 1: ユーザーに影響するエラーはトーストで通知する

```typescript
// use-emoji-reactions.ts
const result = await reactChannelRef.current?.send(...)
if (!result || result.status !== "ok") {
  toast.error("リアクションを送れませんでした")
}
```

### 優先順位 2: インフラエラーはログに詳細を記録する

```typescript
// Sentry, Datadog, または console.error で構造化ログ
console.error("[LINE callback] updateUserById failed", {
  userId: supabaseUserId,
  error: updateError.message,
  timestamp: new Date().toISOString(),
})
```

### 優先順位 3: 重要フローのエラーは状態を UI に反映する

スピン API のエラーは「スピンに失敗しました。もう一度お試しください」のエラーメッセージを表示。

---

## 受け入れ条件

- [ ] ユーザー向けアクション（リアクション・シェア・スピン）のエラーはトーストで通知されること
- [ ] インフラエラー（LINE API・Supabase 障害）は構造化ログが出力されること
- [ ] `console.warn` のみで握りつぶしているエラーが 0 件になること
- [ ] エラー発生時にユーザーが「もう一度試す」アクションを取れること

## 関連ファイル

- `app/room/[code]/play/use-emoji-reactions.ts`
- `app/api/auth/line/callback/route.ts`
- `app/room/[code]/play/use-spin.ts`
- `app/room/[code]/play/use-room-sync.ts`
