# ISSUE-285: High — sendBeacon のルームリセット失敗でルームが凍結する

## ステータス
🔲 対応延期 — sendBeacon の成否は検知不可能（仕様）。根本解決には Supabase Realtime Presence（オーナー離脱検知）または定期クリーンアップCronが必要。飲み会ユースケースでは手動リロードで復帰可能（ページリロード → IN_SESSION → 10秒ポーリングで自動復旧）。優先度高だが単独スプリントで対応推奨。

## 優先度
**High / UX / 信頼性**

## カテゴリ
Bug / Reliability / sendBeacon / Room State

---

## 問題

ページ離脱時のルームリセット（参加者削除・ルーム状態を WAITING に戻す）に `sendBeacon` を使っているが、
`sendBeacon` は成功/失敗を検知できない。リセットが失敗してもエラーハンドリングが不可能。

```typescript
// 推定箇所（use-room-sync.ts または page.tsx）
window.addEventListener("beforeunload", () => {
  navigator.sendBeacon(`/api/rooms/${code}/leave`, JSON.stringify({ userId }))
  // ↑ 戻り値は boolean だが、サーバー側の処理結果は不明
  // ↑ ネットワークエラー・サーバーエラーは検知不能
})
```

`sendBeacon` はリクエストを fire-and-forget で送信するため、
サーバーサイドでエラーが発生しても再試行できない。

---

## なぜ危険か

- ルームリセットが失敗すると、次のセッションでルームが `IN_SESSION` 状態のまま残る
- 新しいユーザーがルームに参加しようとしても「スピン中のルームには参加できない」エラーになる
- オーナーが一度退出してから再入場しようとすると、ルームが凍結状態になっている
- ルームの凍結は手動での DB 操作でしか解除できない

---

## 発生条件

1. ルームオーナーがページを閉じる・リロードする
2. `sendBeacon` のリクエストがネットワーク不安定やサーバー高負荷で失敗する
3. ルームの `status` が `IN_SESSION` のまま残る
4. 次のゲームで参加者が詰まる

---

## 影響範囲

- ルームオーナーが途中離脱したルーム
- モバイルでのバッテリー切れ・圏外での強制終了

---

## 推定原因

`sendBeacon` は仕様上、ページ離脱時にリクエストを送れる唯一の方法だが、
応答を待てない・エラーハンドリングができない。
これは Web API の制約であり、完全な解決は難しい。

---

## 修正方針

### 案A: Supabase Realtime の Presence で離脱を検知する（推奨）

```typescript
// presence を使うとユーザーの接続状態を Supabase がリアルタイムで管理
channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
  if (leftPresences.some(p => p.userId === ownerId)) {
    // オーナー離脱 → サーバー側でルームリセット
    await resetRoom(code)
  }
})
```

`sendBeacon` と併用することで、beacon が失敗してもPresence で補完できる。

### 案B: ルームに TTL（有効期限）を設ける

ルームの `updatedAt` が N 分以上古い場合、Supabase cron で自動リセット。
凍結ルームが蓄積しなくなる。

### 案C: 参加時に前回のセッション状態をリセットする

ルーム参加 API で `IN_SESSION` のルームに参加しようとした場合、
最終更新から X 分以上経過していれば自動で `WAITING` にリセットする。

---

## 受け入れ条件

- [ ] オーナーが強制終了してもルームが凍結しないこと（または N 分後に自動回復すること）
- [ ] 凍結したルームに参加しようとしたユーザーが適切なエラーメッセージを受け取ること
- [ ] 正常な離脱フロー（ボタンクリック）は現状通り動作すること

## 関連ファイル

- `app/room/[code]/play/` （beforeunload ハンドラの実装箇所）
- `app/api/rooms/[code]/leave/route.ts` または類似エンドポイント
