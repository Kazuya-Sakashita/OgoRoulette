# [ISSUE-004] サーバー-クライアント間の時刻スキューで "準備中..." が長時間継続し SPIN ボタンが押せない

## 🧩 概要

スピン API（`/api/rooms/[code]/spin`）は `spinStartedAt = Date.now() + SPIN_COUNTDOWN_MS (3000)` をサーバー時刻で計算して返す。クライアント側では `delay = Math.max(0, data.spinStartedAt - Date.now())` を計算するが、サーバーとクライアントの時計にズレがある場合（サーバーが進んでいる場合）、`delay` が大きくなり `phase = "preparing"` が長時間継続する。この間 SPIN ボタンは disabled のまま。

## 🚨 背景 / なぜ問題か

**計算式（`play/page.tsx:399`）:**

```tsx
const delay = Math.max(0, data.spinStartedAt - Date.now())
setTimeout(() => {
  if (!spinScheduledRef.current) {
    spinScheduledRef.current = true
    setPhase("spinning")
  }
}, delay)
```

**具体例:**
- サーバー時計が 10 秒進んでいる場合: `spinStartedAt = serverNow + 3000 = clientNow + 13000`
- `delay = 13000ms` → 13 秒間 "準備中..." が表示される
- ユーザーには何が起きているか分からない → 「壊れた」と判断して離脱

**現実的な発生ケース:**
- NTP 同期が遅れているユーザーのデバイス（モバイル省電力モード等）
- Vercel Edge Function と DB サーバー間の時刻ズレ
- 開発環境でのシミュレーション時

**上限がない理由:**
- `Math.max(0, ...)` は下限のみを設定しており、上限がない
- サーバー時計が数分進んでいる場合、SPIN は数分間完全に動作しない

## 🎯 目的

`delay` に合理的な上限（`SPIN_COUNTDOWN_MS + 2000ms`）を設けることで、時刻スキューが生じても最大 5 秒で "spinning" フェーズに遷移するようにする。

## 🔍 影響範囲

- **対象機能:** SPIN → "preparing" → "spinning" フェーズ遷移
- **対象画面:** `/room/[code]/play`
- **対象コンポーネント:** `app/room/[code]/play/page.tsx`
  - `handleSpin` 関数（`line:368`）の delay 計算部分（`line:399`）

## 🛠 修正方針

`delay` の上限として `SPIN_COUNTDOWN_MS + 2000` を設定する。これにより clock skew が大きくても最大 5 秒以内に "spinning" に遷移する。

**修正箇所:** `app/room/[code]/play/page.tsx` `handleSpin` 関数内

```tsx
// 変更前
const delay = Math.max(0, data.spinStartedAt - Date.now())

// 変更後
const MAX_SPIN_DELAY_MS = SPIN_COUNTDOWN_MS + 2000 // 最大 5秒（通常 3秒 + 2秒バッファ）
const delay = Math.max(0, Math.min(data.spinStartedAt - Date.now(), MAX_SPIN_DELAY_MS))
```

**補足:**
- `SPIN_COUNTDOWN_MS` は `lib/constants.ts` からインポート済みのため直接使用可能
- 上限 `+2000ms` はクライアント側の API レスポンス待ち時間（通常 100〜500ms）を考慮したバッファ

## ⚠️ リスク / 副作用

- 上限を設けることで、メンバー（非オーナー）との同期アニメーション開始タイミングがずれる可能性がある。ただしメンバー側も同じ `spinStartedAt` を参照しており、クライアント時計が正常なメンバーは問題ない
- クライアント時計が大幅に遅れている場合（delay が cap される場合）、メンバーよりも早くアニメーションが始まるが、`SPIN_COUNTDOWN_MS = 3秒` の余裕があるため実用上は問題ない

## ✅ 確認項目

- [ ] 通常フロー（clock skew なし）で SPIN が正常に動作する
- [ ] `delay` が 5 秒を超えるシミュレーション（`data.spinStartedAt` を 10 秒後の値に設定）で、5 秒以内に "spinning" に遷移する
- [ ] ISSUE-003 のタイムアウト（9 秒）が発火する前に "spinning" に遷移する

## 🧪 テスト観点

**手動確認:**
1. `handleSpin` 内で `data.spinStartedAt` を `Date.now() + 30000` に差し替えてテスト → 5 秒以内に "spinning" に遷移することを確認
2. 通常フロー（`data.spinStartedAt ≈ Date.now() + 3000`）で変化なしを確認

## 📌 受け入れ条件（Acceptance Criteria）

- [ ] `delay` が `SPIN_COUNTDOWN_MS + 2000ms` を超えない
- [ ] 時刻スキューが +10 秒のシミュレーションで、5 秒以内に "spinning" フェーズに遷移する
- [ ] 通常フロー（clock skew なし）で振る舞いに変化がない

## 🏷 優先度

**Critical**（時刻ズレはどの環境でも起きうる。ユーザーが完全に操作不能になる）

## 📅 実装順序

**4番目**（変更は 1 行。ISSUE-001〜003 と同時に対応可能）

## 🔗 関連Issue

- [ISSUE-003] phase タイムアウト安全網（補完的対策）
- [ISSUE-002] spinScheduledRef 競合
