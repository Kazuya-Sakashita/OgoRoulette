# ISSUE-027: Supabase Realtime フィルターのカラム名誤りで Realtime が常時無効化される

## 概要

`app/room/[code]/play/page.tsx` の Supabase Realtime サブスクリプションで `inviteCode=eq.${code}` というフィルターを使っているが、Realtime フィルターは DB の実カラム名（snake_case）で指定する必要があり、正しくは `invite_code=eq.${code}` でなければならない。現状 Realtime が完全に機能せず、常に 10秒ポーリングフォールバックになっている。

## 背景

Prisma の `@map("invite_code")` によりアプリコードでは `inviteCode` として扱えるが、Supabase Realtime フィルターは PostgreSQL のカラム名で解釈される。camelCase のフィルターはマッチしない。

## 問題点

- 現在何が起きているか: Realtime サブスクリプションが全イベントでフィルター不一致となり、ペイロードを受け取らない（`app/room/[code]/play/page.tsx` line 259）
- ユーザー影響: スピン開始の通知が最大 10秒遅延。全員が自分のスマホを見ているパーティーで「なぜ動かない？」という体験
- 技術的影響: Realtime が常時無効化されている状態で稼働しているため、スケール時の DB 負荷対策（ISSUE-009 で実装した WebSocket 移行）が完全に無意味

## 原因

```typescript
// app/room/[code]/play/page.tsx line 259（誤）
filter: `inviteCode=eq.${code.toUpperCase()}`,

// 正しくは:
filter: `invite_code=eq.${code.toUpperCase()}`,
```

## 修正方針

フィルター文字列の `inviteCode` を `invite_code` に変更する（1行修正）。

## タスク

- [ ] `app/room/[code]/play/page.tsx` の Realtime フィルターを `invite_code=eq.` に修正
- [ ] Supabase ダッシュボードで Room テーブルの Realtime が有効化されていることを確認
- [ ] 動作確認: 別デバイスでスピンするとほぼリアルタイムで結果が反映されること
- [ ] 回帰確認: 10秒ポーリングフォールバックが引き続き動作すること

## 受け入れ条件

- スピン結果が 1秒以内に全デバイスに反映される（Realtime 有効時）
- Realtime が使えない環境では 10秒ポーリングが機能する
- コンソールに Realtime 関連エラーが出ない

## 優先度

High

## デプロイブロッカー

No（ポーリングフォールバックで機能は保たれる）。ただし UX が著しく低下するため早期対応推奨
