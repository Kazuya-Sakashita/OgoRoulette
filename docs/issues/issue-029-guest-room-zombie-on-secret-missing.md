# ISSUE-029: GUEST_HOST_SECRET 未設定時にルームが作成されるが 500 を返し、ゾンビルームが残る

## 概要

`POST /api/rooms` のゲストフローで、ルームを DB に作成した後に `signGuestToken` を呼ぶ。`GUEST_HOST_SECRET` 環境変数が未設定の場合、`signGuestToken` が throw して 500 を返すが、**既に作成されたルームは DB に残ったまま**（ロールバックなし）。ゲストは「エラーが出た」と再試行を繰り返し、ゾンビルームが量産される。

## 背景

```typescript
// app/api/rooms/route.ts lines 216-227
const hostMember = room.members.find(m => m.isHost)
let hostToken: string | null = null
if (hostMember) {
  try {
    hostToken = signGuestToken(hostMember.id, inviteCode)
  } catch {
    console.error("GUEST_HOST_SECRET is not configured")
    return NextResponse.json({ error: "サーバー設定エラーが発生しました" }, { status: 500 })
  }
}
```

room.create が成功した後で signGuestToken が失敗するため、DB 書き込みのロールバックが発生しない。

## 問題点

- 現在何が起きているか: `GUEST_HOST_SECRET` が未設定の本番環境では、ゲストがルームを作ろうとするたびにルームレコードだけが DB に蓄積される
- ユーザー影響: ゲストはルームを使えず、何度試みても同じエラー。アプリが完全に使えない
- 技術的影響: 孤立した room レコードと room_member レコードが DB に蓄積。Supabase の無料枠ストレージを消費

## 原因

1. デプロイ時の環境変数チェックが存在しない
2. DB 書き込みとトークン生成が分離しており、失敗時のロールバック処理がない

## 修正方針

**短期（優先）:** `GUEST_HOST_SECRET` が未設定の場合はリクエスト開始時点でフェイルファストする:

```typescript
// POST /api/rooms の冒頭で追加
if (!process.env.GUEST_HOST_SECRET) {
  console.error("[rooms] GUEST_HOST_SECRET is not configured")
  return NextResponse.json({ error: "サーバー設定エラーが発生しました" }, { status: 500 })
}
```

**中長期:** Vercel 起動時に必須環境変数の存在チェックを行い、不足があればデプロイを失敗させる（`next.config.ts` の `env` バリデーションまたは起動スクリプトで実装）。

## タスク

- [ ] `POST /api/rooms` の冒頭に `GUEST_HOST_SECRET` の存在チェックを追加
- [ ] DB 書き込み前にフェイルファストするよう実装を変更
- [ ] 動作確認: `GUEST_HOST_SECRET` なしで 500 が DB 書き込み前に返ること
- [ ] 動作確認: `GUEST_HOST_SECRET` あり で正常なルーム作成が動くこと

## 受け入れ条件

- `GUEST_HOST_SECRET` 未設定時にゾンビルームが作成されない
- エラーが DB 書き込み前に発生する
- 正常環境でゲストルーム作成が動作する

## 優先度

High

## デプロイブロッカー

Yes — 環境変数の設定ミスがサービス全体のゲスト機能を破壊し、データ汚染を引き起こす
