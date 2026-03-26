# OgoRoulette — Issue 一覧

> **評価基準**: CEO レビュー（2026-03-25）および SPIN ボタンバグ調査結果をもとに作成
> **ステータス凡例**: 🔴 未着手 / 🟡 対応中 / ✅ 完了

---

## 🔴 Critical（動かない / UX 崩壊 / 致命バグ）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-001](./issue-001-spin-button-isowner-flicker.md) | ゲストホスト `isOwner` フリッカーによる SPIN ボタン永続無効化 | `isGuestHost` が非同期ロードされる間に `isOwner=false` でメンバーエフェクトが誤発火。`phase` が "preparing" に固まり SPIN が押せなくなる | ✅ 完了 |
| [ISSUE-002](./issue-002-spin-scheduled-ref-race.md) | `spinScheduledRef` 競合による `setPhase("spinning")` ブロック | ISSUE-001 の副作用として `spinScheduledRef.current=true` が残り、`setPhase("spinning")` が永続ブロックされる | ✅ 完了（ISSUE-001 修正により解消） |
| [ISSUE-003](./issue-003-spinning-phase-timeout.md) | `phase="spinning"` / `"preparing"` で永続停止したときの自動回復機構がない | タイムアウト安全網なし。フェーズが永続停止したときのリカバリ手段がページリロードのみ | ✅ 完了 |
| [ISSUE-004](./issue-004-clock-skew-delay.md) | サーバー-クライアント間の時刻スキューで "準備中..." が長時間継続 | `delay` に上限がなく、時計ずれが大きいと数十秒〜数分 SPIN が押せない | ✅ 完了 |

---

## 🟠 High（重要な機能障害・体験毀損）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-005](./issue-005-room-in-session-stuck.md) | `spin-complete` 失敗時に `room.status` が "IN_SESSION" で固まり次のスピンが 409 | fire-and-forget の `spin-complete` が失敗するとルームが永続ロック状態になる | ✅ 完了 |
| [ISSUE-006](./issue-006-handlerespin-polling-race.md) | `handleRespin` 後のポーリング競合で SPIN ボタンが「結果を見る」に一時切り替わる | 楽観的更新前にポーリングが `COMPLETED` を返し、SPIN ボタンが消える | ✅ 完了 |
| [ISSUE-007](./issue-007-ios-webm-video-share.md) | 録画動画（WebM）が iOS Safari で再生・シェアできない | MediaRecorder が WebM を生成するが iOS Safari は WebM 非対応。バイラル機能が iOS で完全に壊れている | ✅ 完了（Step 1 対応）|
| [ISSUE-008](./issue-008-winner-card-respin-ux.md) | WinnerCard を閉じなければ SPIN を再押しできないことが伝わらない | `phase=result` で SPIN が disabled になるが理由が表示されない。「もう一回！」ボタンが見つけにくい | ✅ 完了 |

---

## 🟡 Medium（改善・技術負債・成長施策）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-009](./issue-009-polling-to-realtime.md) | 3 秒ポーリングの Supabase Realtime（WebSocket）移行 | ユーザー増加時の DB 負荷対策とリアルタイム体験向上 | ✅ 完了（Realtime + 10s フォールバック） |
| [ISSUE-010](./issue-010-room-expiry-display.md) | ルームの有効期限（`expiresAt`）が UI に表示されず期限切れで操作不能になる | 期限切れルームで SPIN を押すと `403` エラーが初めて分かる | ✅ 完了 |
| [ISSUE-011](./issue-011-spin-button-disabled-hint.md) | SPIN ボタンが押せない理由がユーザーに伝わらない | `opacity-50` のみで理由説明なし。「なぜ押せないか」のヒントテキストが必要 | ✅ 完了 |
| [ISSUE-012](./issue-012-og-image-visual.md) | OG 画像のビジュアルが弱く SNS でのクリック率が低い | クラウン・絵文字・金額表示なし。シェア時のプレビューが地味 | ✅ 完了（既存 OG 実装で対応済み確認） |
| [ISSUE-013](./issue-013-analytics-setup.md) | 行動分析基盤の欠如でユーザー行動が把握できない | Vercel Web Vitals のみ。スピン完了率・シェア率・エラー率が計測不能 | ✅ 完了 |
| [ISSUE-014](./issue-014-persistent-group-rooms.md) | 常設グループ機能（永続ルーム）がなく継続利用の導線が弱い | ルームが使い捨て設計。同じグループが繰り返し使える仕組みがない | ✅ 完了（要 prisma migrate dev） |
| [ISSUE-015](./issue-015-play-page-e2e-test.md) | プレイページのステートマシン全体に自動テストがない | `phase` 遷移のリグレッションを自動検出できない | ✅ 完了（reset + getSupportedMimeType テスト追加） |

---

## ⚪ Low（将来の成長施策）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-016](./issue-016-pwa-push-notifications.md) | PWA 対応とプッシュ通知によるリエンゲージメント基盤 | ホーム画面追加・プッシュ通知なしで再訪問の導線がない | ✅ 完了（manifest.json + layout.tsx 対応、Step 1） |

---

## 🟡 Medium（改善・技術負債・成長施策）— 追加分

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-017](./issue-017-improve-group-ux.md) | 常設グループ UX 改善（いつものメンバー化 + 直感操作への再設計） | ホーム画面に永続ルーム一覧がなく、`UserGroup` と永続 `Room` が分断。1 タップでいつものメンバーで開始できる体験に再設計する | ✅ 完了 |

---

## 🔴 Critical（追加）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-018](./issue-018-fix-group-create-bug.md) | グループ登録ができない不具合の修正 | `showSaveInput` 状態に対応する入力フォーム UI が欠落。「新しいグループを登録」ボタンを押しても何も起きない | ✅ 完了 |

---

## 🟠 High（追加）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-019](./issue-019-fix-hydration-group-list.md) | Hydrationエラー（GroupList）の修正 | `useGroups` の `useState` lazy initializer が `localStorage` を直接読み取り、SSR（`[]`）と CSR hydration（保存データ）で DOM が不一致になる | ✅ 完了 |
| [ISSUE-020](./issue-020-spin-route-guest-host-bug.md) | spin/route.ts — ゲストホスト検証の不整合と 500 エラー防御強化 | ゲストホスト検索に `profileId: null` フィルタが欠落し spin-complete / reset と不整合。`profile.upsert` の uncaught 例外が 500 になるリスクも修正 | ✅ 完了 |
| [ISSUE-023](./issue-023-member-join-preset-group.md) | メンバーがいつものグループに参加できる — プリセット名前ピッカー | グループからルームを作成するとメンバー名がプリセット登録され、JOIN ページで名前をタップするだけで参加できる | ✅ 完了（要 prisma migrate dev） |

---

## 🔴 Critical（追加 2）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-021](./issue-021-fix-room-play-participants-init-error.md) | RoomPlayPage の `participants` 初期化前参照エラー修正 | `isCurrentGroupSaved` / `handleSaveGroup` が `participants` の `useMemo` 定義より前に配置されており TDZ エラー（`Cannot access 'participants' before initialization`）が発生 | ✅ 完了 |
| [ISSUE-022](./issue-022-group-spin-utilization.md) | グループ活用 UX の再設計 — 1タップでスピン開始 | グループを保存しても「どう使うか」の導線がなくユーザーが活用できない。GroupList の各グループカードに「▶ 回す」ボタンを追加し 1タップでそのメンバーでスピン開始 | ✅ 完了 |

---

## 📊 サマリ

| 優先度 | 件数 |
|--------|------|
| 🔴 Critical | 6 |
| 🟠 High | 8 |
| 🟡 Medium | 8 |
| ⚪ Low | 1 |
| **合計** | **23** |

---

## 🗓 推奨実装順序

### フェーズ1: リリースブロッカー対応（〜1週間）

```
ISSUE-001 → ISSUE-002 → ISSUE-003 → ISSUE-004（4件セット、1日〜2日）
ISSUE-007 Step1（MediaRecorder コーデック選択、1日）
ISSUE-008（WinnerCard UX 修正、1日）
ISSUE-005（spin-complete retry 追加、1日）
```

### フェーズ2: 品質・体験向上（〜2週間）

```
ISSUE-006（handleRespin 楽観的更新改善）
ISSUE-010（ルーム期限表示）
ISSUE-011（SPIN ボタンヒントテキスト）
ISSUE-013（分析基盤セットアップ）
ISSUE-015（プレイページテスト追加）
```

### フェーズ3: 成長・収益化（〜1ヶ月）

```
ISSUE-012（OG 画像リニューアル）
ISSUE-014（常設グループ機能）
ISSUE-009（Realtime 移行）
ISSUE-007 Step2（ffmpeg.wasm MP4 変換）
```

### フェーズ4: エンゲージメント強化（〜3ヶ月）

```
ISSUE-016（PWA + プッシュ通知）
```

---

## 🔗 参考資料

- [CEO レビュー結果](../ceo-review.md)（作成予定）
- [SPIN ボタンバグ調査レポート](../spin-button-investigation.md)（作成予定）
- `app/room/[code]/play/page.tsx` — 主要実装ファイル
- `components/roulette-wheel.tsx` — ルーレットアニメーション
- `components/winner-card.tsx` — 結果モーダル
