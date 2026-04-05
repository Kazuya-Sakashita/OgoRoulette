# Roulette — ルーレット固有の設計パターン

## 当選者決定の仕組み

```
1. ホストが SPIN ボタン押下
2. POST /api/rooms/[code]/spin → サーバーが winner を確定・DB保存
3. クライアントは pendingWinnerIndex を受け取り アニメーション開始
4. アニメーション終了後に winner を表示
```

**重要:** クライアント側でランダム選択しない。サーバー決定が唯一の正解。

## clock 同期（ISSUE-202 実装済み）

```ts
// ホストとメンバー間の時刻スキュー補正
const clockOffsetMs = serverTime - Date.now()
const adjustedStartedAt = spinStartedAt + clockOffsetMs
```

メンバーは `clockOffsetMs` を計算してスピン開始タイムスタンプを補正する。

## アニメーションコールバック（roulette-wheel.tsx）

```ts
onSpinComplete()   // 停止時
onSpinStart()      // 開始時
onSlowingDown()    // スロー開始時 ← ISSUE-207 の演出フック
onNearMiss()       // ニアミス時
```

`handleSlowingDown` がすでに `play/page.tsx` に接続済み。ISSUE-207 はここに演出を追加するだけ。

## ルーレットサイズ計算

```ts
// ISSUE-141: ビューポートに合わせて動的計算
const RESERVED_HEIGHT = 440
const byWidth = Math.min(360, window.innerWidth - 40)
const byHeight = Math.min(360, window.innerHeight - RESERVED_HEIGHT)
setWheelSize(Math.max(200, Math.min(byWidth, byHeight)))
```

## rate-limit（ISSUE-201 実装済み）

```ts
// lib/rate-limit.ts
// プライマリ: Vercel KV（複数インスタンス対応）
// フォールバック: in-memory Map（単一インスタンスのみ有効）
// 分離キー: IP + エンドポイント
```

## sendBeacon によるページ離脱検知

```ts
// ISSUE-045: スピン中にオーナーがページを閉じると room が IN_SESSION で固着
// 対策: pagehide イベントで /api/rooms/[code]/reset に sendBeacon
window.addEventListener("pagehide", handlePageHide)
```

## DB スキーマ（主要テーブル）

```
rooms: id, ownerId, inviteCode(unique 8chars), status, expiresAt, maxMembers(10)
room_members: roomId, profileId, nickname, color, isHost, joinedAt
roulette_sessions: roomId, hostId, winnerId, status, spinDuration, totalAmount
participants: セッション内プレイヤー
```

## ゲストホストトークン

```
HMAC-SHA256(inviteCode + timestamp, GUEST_HOST_SECRET)
X-Guest-Host-Token ヘッダーで送信
サーバー側で署名検証
```
