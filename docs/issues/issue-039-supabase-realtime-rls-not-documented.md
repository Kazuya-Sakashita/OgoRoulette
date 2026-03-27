# ISSUE-039: Supabase Realtime テーブル設定・RLS ポリシーがデプロイ手順に未記載

## 概要

`app/room/[code]/play/page.tsx` はルーム状態の監視に Supabase Realtime を使用しているが、Supabase ダッシュボード側の設定（テーブルへの Realtime 有効化 + RLS ポリシー）がどこにも記載されていない。未設定のままデプロイすると Realtime が機能せず、10秒ポーリングのみで動作するためリアルタイム体験が完全に失われる。

## 背景

Supabase Realtime は、テーブルごとにダッシュボードから「Realtime 有効化」を明示的にオンにする必要がある。さらに RLS（Row Level Security）が有効な場合、Realtime チャンネルが読み取れる行を RLS ポリシーで許可しないとイベントが届かない。これらは SQL migration では設定できず、Supabase ダッシュボード上の操作またはプロビジョニングスクリプトが必要。

## 問題点

### 現在何が起きているか
- `play/page.tsx:241` に「Supabase ダッシュボードで rooms テーブルの Realtime を有効にする必要がある」というコメントが存在
- しかしデプロイ手順書・README・CLAUDE.md のどこにもこの設定手順が記載されていない
- 未設定の本番環境では `useEffect` 内の `supabase.channel()` がサブスクライブを試みるが、イベントが届かず 10 秒フォールバックポーリングのみ動作

### ユーザー影響
- ホストがルーレットを開始してもメンバーの画面が即座に切り替わらない（最大10秒遅延）
- 「スピン開始した！」「なぜ画面が変わらない？」という UX 混乱が発生

### 技術的影響
- Realtime チャンネルエラーがコンソールに出力されるが、アプリは無音で劣化動作する
- 劣化を検知する手段がない

## 原因

Supabase Realtime の有効化は Supabase Admin API または Management API 経由で設定可能だが、本プロジェクトの migration・セットアップスクリプトに含まれていない。

## 修正方針

以下のいずれかまたは両方を実施する。

### Option A: セットアップドキュメント追加
`DEPLOY.md` または `README.md` に以下の手順を追記する：
```
Supabase ダッシュボード設定（必須）:
1. Supabase > Table Editor > rooms > "Enable Realtime" をオン
2. Supabase > Authentication > Policies で rooms テーブルに以下の RLS ポリシーを追加:
   CREATE POLICY "rooms_realtime_read" ON rooms
   FOR SELECT USING (true);  -- または inviteCode ベースのフィルタ
```

### Option B: Supabase CLI / Management API でのプロビジョニングスクリプト追加
`supabase/config.toml` または `scripts/setup-supabase.sh` にて自動設定する。

## タスク
- [ ] 必要な Supabase ダッシュボード設定を確認・文書化
- [ ] `DEPLOY.md` または `README.md` に設定手順を追記
- [ ] 本番環境で Realtime が機能しているか確認（ルーレット開始 → 別ブラウザで即時遷移）
- [ ] 設定されていない場合のエラーメッセージを改善（サイレント劣化ではなく警告表示）

## 受け入れ条件
- 別ブラウザ2つで同一ルームに参加し、ホストがスピンを開始したとき 1 秒以内に非ホスト側の画面が遷移する
- デプロイ手順書に Realtime 設定が記載されている
- 設定漏れ時にアプリが動作しないのではなく、管理者向けにエラーログが出力される

## 優先度
High

## デプロイブロッカー
Yes（未設定でもアプリは動作するが、コア体験が著しく劣化する）
