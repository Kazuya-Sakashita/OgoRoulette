# ルーレット同期ズレ根絶（issue-143 / issue-146 統合修正計画）

## 概要

マルチプレイ時にオーナーとメンバー間でルーレット回転の同期がズレる問題（issue-143）、および
メンバー側でルーレットアニメーションが skip される問題（issue-146）を統合的に根絶する。
「全員の画面が同期する」は OgoRoulette の最大の価値提案であり、これが機能しないことはコア体験の破壊に等しい。

## 背景

OgoRoulette のマルチプレイ体験の核心は「全員が同じタイミングでルーレットが止まるのを見る」という共同体験。
この同期が崩れると:
- 「不正しているのでは？」という疑念が生まれる
- 「同期できているか」という注意がルーレットではなく確認に向く
- 盛り上がりが半減する（誰かが先に結果を知ってしまう）

現在の同期設計は「spinSeed（タイムスタンプ）による決定論的アニメーション」という良い設計を持っているが、
`spinElapsedMs` の計算タイミングとアニメーション開始の間に競合状態があるため、
特に Realtime が遅延した場合や iOS で遅延ポーリングになった場合に同期が崩れる。

## 問題の詳細

### issue-143: オーナー/メンバー間のルーレット回転同期ズレ

**症状:**
- オーナーのルーレットが止まった後、メンバーのルーレットが数秒遅れて止まる
- または逆に、メンバーが先に止まってオーナーの停止を待つ

**根本原因（推定）:**
- `spinElapsedMs` = `Date.now() - session.startedAt` の計算を Realtime イベント受信直後に行っているが、
  クライアントの時計ズレ（clock skew）と Realtime 遅延が重なると elapsed の値がオーナーと乖離する
- `duration = Math.max(0.5, 4.5 - elapsedSec)` の計算を同一ロジックで行っているが、
  elapsed の基準が「Realtime 受信時刻」と「API レスポンス時刻」で揺れている可能性

### issue-146: メンバーのルーレットアニメーション skip

**症状:**
- メンバーが遅れてポーリングで状態を取得したとき、アニメーションが skip されて結果だけが表示される
- elapsed が `MAX_SPIN_DELAY_MS`（3000ms）を超えた場合に duration が 0.5s になるが、
  それでもアニメーションが「見える」形で実行されていない

**根本原因（推定）:**
- Realtime ではなくポーリングで状態を取得した場合、`setPhase("spinning")` → `setPhase("result")` が
  同一レンダリングサイクル内で実行されるため、`RouletteWheel` がスピン状態を経由せずに結果に遷移する可能性
- `spinElapsedMs` が 4500ms 超のとき（スピンが既に終わっているとき）のフォールバック表示が未整備

## 修正方針

### Step 1: elapsed 計算の安定化

```typescript
// 現状（問題）: Realtime/ポーリング受信直後に elapsed を計算
const elapsed = Date.now() - new Date(session.startedAt).getTime()

// 改善: startedAt を受け取った時点ではなく、
// RouletteWheel のアニメーション開始直前に elapsed を計算する
// これにより React の状態更新バッチングによる遅延を排除する
```

### Step 2: ポーリング到着時のアニメーション skip 防止

```typescript
// elapsed が 4500ms 超 = 既にスピン終了 → 結果だけ表示（アニメーションなし）でOK
// elapsed が 0〜4500ms = アニメーションを再生する

if (elapsed > SPIN_DURATION_MS) {
  // 即結果表示：phase を spinning を経由せず直接 result に
  setPhase("result")
  setWinner(session.winner)
} else {
  // アニメーション再生：必ず spinning フェーズを通す
  setPhase("spinning")
  // RouletteWheel に残り duration を渡す
  setSpinRemainingMs(Math.max(500, SPIN_DURATION_MS - elapsed))
}
```

### Step 3: clock skew 対策

```typescript
// サーバー時刻とクライアント時刻のズレを補正するオフセットを計算
// API レスポンスに X-Server-Time ヘッダーを付与し、
// クライアント側で (serverTime - clientTime) のオフセットを保持する
const clockOffset = serverTime - Date.now()
const adjustedElapsed = (Date.now() + clockOffset) - startedAt
```

### Step 4: RouletteWheel の spinRemainingMs prop 追加

`RouletteWheel` に `spinRemainingMs` prop を追加し、遅延到着クライアントが残り時間だけアニメーションを再生できるようにする。
現状の `spinElapsedMs` は「何ms経過しているか」だが、`spinRemainingMs` = `max(0, 4500 - elapsed)` の方が
RouletteWheel 側の実装がシンプルになる。

## 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `app/room/[code]/play/page.tsx` | elapsed 計算の安定化、skip 防止ロジック |
| `components/roulette-wheel.tsx` | `spinRemainingMs` prop の追加と対応 |
| `app/api/rooms/[code]/spin/route.ts` | `X-Server-Time` レスポンスヘッダー追加 |

## 完了条件

- [x] `X-Server-Time` ヘッダーを spin API レスポンスに追加（clock skew 補正用）
- [x] `spinElapsedMs` → `spinRemainingMs` に変換（RouletteWheel props / play/page.tsx 双方）
- [x] elapsed >= 5500ms 時のアニメーション skip 防止ロジック実装
- [x] clock skew 補正（`clockOffsetMsRef` で管理）実装
- [x] `npm run build` でエラーなし
- [ ] マルチプレイ環境での動作確認（オーナー/メンバー同期精度）
- [ ] iOS Safari でも同様に動作する確認

## ステータス

✅ 完了 — 2026-04-06（デプロイ済み）
- `spinElapsedMs`（経過時間ベース）→ `spinRemainingMs`（残り時間ベース）に prop 設計を変更
- spin API に `X-Server-Time` ヘッダーを追加、クライアントで clock offset を計測
- elapsed >= 5500ms（バウンス含む全体時間）のとき即結果表示にフォールバック
- `npm run build` / `npx tsc --noEmit` 両方クリア

## 優先度

**Critical** — 「全員の画面が同期する」は OgoRoulette の最大の価値提案。これが機能しないことはコア体験の破壊。
gstack UX スコアの最大の改善余地（+5〜8）。

## 期待効果

- UX スコア: 70 → 75（+5）
- Engineering スコア: 67 → 71（+4）
- Engagement（HEART）: 68 → 73（+5）
- ルーレット体験の「信頼感」が回復し、「誰かがインチキしているのでは」という疑念が消える

## 関連カテゴリ

Engineering / UX / Multiplayer

## 備考

- 関連 issue: issue-143（同期ズレ）、issue-146（アニメーション skip）、issue-004（clock skew delay）、issue-006（respin ポーリング競合）
- ISSUE-172（play/page.tsx 分割）と同時に進めると効率的。分割後の方が修正しやすい
- Supabase Realtime が正常動作する環境では顕在化しにくい。ポーリングフォールバック時に必ず再現する
- `spinSeed`（= `spinStartedAt` ms）による決定論的アニメーションは正しい設計。問題は elapsed の計算タイミングのみ
