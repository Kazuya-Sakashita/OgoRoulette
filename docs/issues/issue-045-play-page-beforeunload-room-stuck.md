# issue-045: ブラウザをアニメーション中に閉じると room が IN_SESSION で永続停止する

## 概要

オーナーがルーレットアニメーション（約10秒）中にブラウザを閉じた場合、`spin-complete` API が呼ばれず、ルームが `IN_SESSION` / `SPINNING` 状態で永続的に停止する。オーナーが戻らない限り、誰もスピンできない状態になる。

## 背景

ISSUE-005 でスピン完了時の retry ロジック（最大3回）が実装されたが、**ページが閉じられた場合のプロアクティブなクリーンアップ** は未対応。ISSUE-005 が対象とするのは「spin-complete API への接続失敗」であり、「ページが閉じられる」という根本的なシナリオは別問題。

## 問題点

`app/room/[code]/play/page.tsx` の `handleSpinComplete`（line 558）：

```typescript
// spin-complete は handleSpinComplete コールバックから呼ばれる
if (isOwner) {
  (async () => {
    // MAX_RETRIES = 3 でリトライ
    const res = await fetch(`/api/rooms/${code}/spin-complete`, ...)
  })()
}
```

この関数は `RouletteWheel` コンポーネントのアニメーション完了コールバックから呼ばれる。アニメーション中（`phase === "spinning"`）にページが閉じられると：

1. `handleSpinComplete` が呼ばれない
2. `spin-complete` API が呼ばれない
3. DB の room.status = `IN_SESSION`、rouletteSession.status = `SPINNING` のまま

`beforeunload` イベントハンドラが存在しないため、ページ離脱時にクリーンアップが行われない。

## 原因

`play/page.tsx` に `beforeunload` ハンドラがない。離脱時に `navigator.sendBeacon` で `/api/rooms/[code]/reset` を叩く仕組みがない。

## ユーザー影響

| シナリオ | 影響 |
|---------|------|
| ゲストルームでオーナーが離脱 | 以後誰もスピンできない（ゲストトークンは残るが操作者不在）|
| 認証ルームでオーナーが離脱 | オーナーが再訪問すれば reset 可能だが、再訪問への導線がない |
| 常設グループ（`isPersistent=true`）| 有効期限がないため、無期限でルームが停止する |
| メンバー視点 | 「スピンが進行中です（409）」が永続表示される |

常設グループは特に深刻。24h で自然消滅するゲストルームと違い、永久に使えなくなる。

## 技術的リスク

- `navigator.sendBeacon` は非同期・保証なしだが、ブラウザ close 時のネットワークリクエスト手段として唯一の選択肢
- `beforeunload` でのフェッチは Chrome/Firefox でブロックされる（Keep-Alive フラグ付きでも不安定）
- サーバーサイドの自動タイムアウト（Cronジョブ）があれば補完できるが未実装

## 修正方針

### Phase 1（クライアント）: `beforeunload` + `sendBeacon`

`app/room/[code]/play/page.tsx` の spinning/preparing フェーズ中のみ、beforeunload で reset ビーコンを送信：

```typescript
useEffect(() => {
  if (phase !== "spinning" && phase !== "preparing") return
  if (!isOwner) return

  const handleBeforeUnload = () => {
    navigator.sendBeacon(`/api/rooms/${code}/reset`, "")
  }

  window.addEventListener("beforeunload", handleBeforeUnload)
  return () => window.removeEventListener("beforeunload", handleBeforeUnload)
}, [phase, isOwner, code])
```

`/api/rooms/[code]/reset` は POST のみ受け付けているため、`sendBeacon` の CORS/認証課題を解決する必要がある（ゲストトークンヘッダーが sendBeacon では送れない問題あり）。

### Phase 2（サーバー）: 定期クリーンアップ Cron

Vercel Cron で `spinStartedAt + 60秒` を超えた IN_SESSION ルームを自動 reset するエンドポイントを追加する。これにより、クライアント側の beforeunload に頼らずとも 1 分以内に自動回収される。

## タスク

- [ ] spinning フェーズ中の `beforeunload` ハンドラを実装（Phase 1）
- [ ] `sendBeacon` のゲストトークン問題を解決（クッキーに一時保存等）
- [ ] Vercel Cron ジョブで IN_SESSION 永続停止を自動回収（Phase 2）
- [ ] 常設グループで動作確認

## 受け入れ条件

- オーナーがアニメーション中にタブを閉じた後、1分以内（Phase 2）またはリロード後即座（Phase 1）にルームが WAITING に戻る
- 通常のスピン完了フローに影響しない

## 優先度

High

## デプロイブロッカー

No（ISSUE-005 の reset で手動回復は可能だが、常設グループでは実質ブロッカー級）
