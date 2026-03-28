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

## 🔴 Critical — デプロイ前評価（2026-03-27）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-025](./issue-025-qr-camera-stub.md) | QRスキャンカメラが「実装中」表示 | カメラ起動ボタンが stub で「実装中」メッセージを出す。初見ユーザーの第一印象を破壊する | ✅ 完了 |
| [ISSUE-026](./issue-026-missing-rate-limit-room-spin.md) | ルーム作成・spin に rate limit なし | POST /api/rooms と spin エンドポイントが無制限。DB DoS リスク | ✅ 完了 |
| [ISSUE-028](./issue-028-auth-callback-open-redirect.md) | auth/callback の open redirect 脆弱性 | x-forwarded-host を無検証で使用。OAuth後に任意ドメインへリダイレクト可能 | ✅ 完了 |
| [ISSUE-029](./issue-029-guest-room-zombie-on-secret-missing.md) | GUEST_HOST_SECRET 未設定時にゾンビルームが作成される | DB 書き込み後に 500 返却、ロールバックなしでゾンビルームが量産される | ✅ 完了 |

---

## 🟠 High — デプロイ前評価（2026-03-27）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-024](./issue-024-guest-double-join-race.md) | ゲスト二重参加でルーレットに同一ユーザーが複数追加される | ダブル送信競合で同一 nickname の RoomMember が複数作成される | ✅ 完了 |
| [ISSUE-027](./issue-027-realtime-filter-column-name.md) | Realtime フィルターのカラム名誤りで常時無効化 | inviteCode → invite_code の 1文字修正漏れで Realtime が全滅 | ✅ 完了 |
| [ISSUE-030](./issue-030-scan-page-broken-login-link.md) | scan ページのフッターリンク /auth/login が 404 | ルートが存在せずログイン導線が死んでいる | ✅ 完了 |
| [ISSUE-031](./issue-031-in-memory-rate-limiter-multi-instance.md) | インメモリ rate limiter が Vercel 複数インスタンスで無効 | Serverless 複数インスタンス間でカウンターが共有されない | 🔴 未着手（Upstash Redis 移行要） |

---

## 🟡 Medium — デプロイ前評価（2026-03-27）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-032](./issue-032-images-unoptimized.md) | images.unoptimized:true で画像最適化が無効 | モバイルで画像が重く、LCP スコア悪化 | ✅ 完了 |
| [ISSUE-033](./issue-033-default-participants-placeholder.md) | デフォルト参加者が ["A","B","C","D"] でプレースホルダー丸出し | 初見ユーザーに「作りかけ感」を与える | ✅ 完了 |

---

## ⚪ Low — デプロイ前評価（2026-03-27）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-034](./issue-034-pwa-manifest-icon.md) | PWA manifest アイコン設定不備 | 512x512 アイコン不足、maskable 指定不備 | ✅ 完了 |

---

## 🔴 Critical — デプロイ前評価（2026-03-27 第2回）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-035](./issue-035-env-var-site-url-vs-app-url.md) | NEXT_PUBLIC_SITE_URL と NEXT_PUBLIC_APP_URL の変数名不整合 | auth/callback が独自変数名を使用。NEXT_PUBLIC_APP_URL を設定しても OAuth リダイレクトに使われない | ✅ 完了 |

---

## ⚪ Low — デプロイ前評価（2026-03-27 第2回）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-036](./issue-036-lobby-start-button-all-members.md) | ロビーの「ルーレットを回す」ボタンが非オーナーにも表示される | メンバーが押すとプレイページに遷移するが SPIN できない。UX 混乱 | ✅ 完了 |
| [ISSUE-037](./issue-037-migration-file-name-mismatch.md) | Prisma マイグレーションファイル名と内容の不一致 | 20260325224845 のファイル名が実際の変更内容と異なる | ✅ 完了（コメント追加、リネームは DB 不整合リスクのため保留） |

---

## 🔴 Critical — LINE ログインバグ調査（2026-03-27）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-038](./issue-038-line-login-already-registered.md) | LINE ログイン "already registered" エラー | 初回ログイン途中失敗後、Supabase Auth にユーザーが残るが Prisma profile が作成されず、次回ログイン時に createUser が "already registered" で /auth/error になる | ✅ 完了 |

---

## 🟠 High — デプロイ前評価（2026-03-27 第3回）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-039](./issue-039-supabase-realtime-rls-not-documented.md) | Supabase Realtime テーブル設定・RLS がデプロイ手順に未記載 | Realtime 未設定のまま本番デプロイすると 10秒ポーリングのみで動作し、リアルタイム体験が消失する | 🔴 未着手 |
| [ISSUE-040](./issue-040-line-login-button-missing.md) | LINE ログインボタンがウェルカムページに存在しない | LINE OAuth バックエンドは実装済みだが UI のエントリーポイントがない。ユーザーが LINE でログインできない | ✅ 完了 |

---

## 🟡 Medium — デプロイ前評価（2026-03-27 第3回）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-041](./issue-041-guest-host-secret-length-validation.md) | GUEST_HOST_SECRET の最小長・強度検証がない | 存在確認のみで長さ検証なし。弱いシークレット設定でも起動してしまい HMAC 安全性が担保されない | ✅ 完了 |
| [ISSUE-042](./issue-042-line-callback-profile-upsert-silent-failure.md) | LINE callback の profile upsert サイレント失敗 | upsert 失敗を .catch() で飲み込みログイン成功扱いにする。profile なしでログイン後、ルーム作成等が FK エラーで壊れる | ✅ 完了 |

---

---

## 🟠 High — コードレビュー（2026-03-28）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-043](./issue-043-join-color-collision-race.md) | JOIN 同時実行で複数メンバーが同一色になる | `room._count.members` 読み取りと `roomMember.create` の間にロックなし。同時参加で色インデックスが衝突 | ✅ 完了 |
| [ISSUE-045](./issue-045-play-page-beforeunload-room-stuck.md) | ブラウザをアニメーション中に閉じると room が IN_SESSION で永続停止 | `beforeunload` ハンドラ未実装。オーナーが離脱すると `spin-complete` が呼ばれず常設グループが永久ロックされる | ✅ 完了（Phase 1: pagehide + sendBeacon） |

---

## 🟡 Medium — コードレビュー（2026-03-28）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-044](./issue-044-winner-card-guest-cta-room-context-lost.md) | WinnerCard ゲスト CTA — ログイン後にルームコンテキストが失われる | 登録ボタンが `window.location.href = "/"` でナビゲート。ログイン後 `/home` に飛び、元のルームに戻れない | ✅ 完了 |
| [ISSUE-046](./issue-046-expired-room-returns-http-400.md) | 期限切れルームへの GET が HTTP 400 を返す | セマンティクス不正確（410 Gone が正しい）。クライアントが `expired` フラグ未処理で「ルームが見つかりません」と誤表示 | ✅ 完了 |
| [ISSUE-047](./issue-047-room-ranking-limited-to-5-sessions.md) | roomRanking が直近5セッションのみ参照し長期利用ルームで奢り回数が過少表示 | `take: 5` で取得したセッションからランキング算出。常設グループで6回以上スピンすると不正確になる | ✅ 完了 |
| [ISSUE-048](./issue-048-join-max-members-race-condition.md) | JOIN の maxMembers チェックが非アトミック — 同時参加でルームが定員超過 | SELECT と INSERT の間にトランザクションなし。QR スキャン同時多発で定員を超えてメンバーが作成される | ✅ 完了 |

---

## ⚪ Low — コードレビュー（2026-03-28）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-049](./issue-049-create-page-dead-code-qr-view.md) | `app/room/create/page.tsx` の QR・メンバーリスト UI がデッドコード | ルーム作成直後に `router.replace()` でナビゲートされるため `setRoom` が呼ばれず、230行以上の UI が一切表示されない | ✅ 完了 |

---

## 🔴 Critical — CEO/CTO評価（2026-03-28）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-050](./issue-050-join-page-guest-host-name.md) | 招待ページでゲストホストの名前が「ゲストさん」になる | ゲスト作成ルームで `room.owner` が null のため招待文が「ゲストさんが招待しています」になる。実際のホスト名は `members[].nickname` に存在する | ✅ 完了 |
| [ISSUE-051](./issue-051-logout-group-cache-leak.md) | ログアウト後もグループ情報が表示される不具合 | `handleLogout` が localStorage を一切クリアしない。cloudId 付きグループ（クラウド同期済み）が残り、次回訪問者（ゲスト・別ユーザー）に前ユーザーのデータが表示される | ✅ 完了 |

---

## 🟠 High — 認証共通化・X ログイン追加（2026-03-28）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-052](./issue-052-auth-x-login-implementation.md) | X（Twitter）ログインの実装 | X ボタンが `handleComingSoon` のみ。Supabase ネイティブ `provider: "twitter"` で実装、`lib/auth.ts` で型を `"google" \| "twitter"` に統一 | ✅ 完了 |
| [ISSUE-053](./issue-053-auth-login-page-missing-return-to.md) | `/auth/login` 経由のログインで returnTo が機能しない | `login/page.tsx` の Google が `?next=` を callback に渡さない。LINE も `?returnTo=` なし。LINE callback の `line_oauth_return_to` cookie 削除漏れも修正 | ✅ 完了 |

---

## 🟡 Medium — 認証共通化・X ログイン追加（2026-03-28）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-054](./issue-054-auth-login-logic-duplication.md) | Google / LINE ログインロジックが2ページに重複実装 | `app/page.tsx` と `login/page.tsx` に OAuth 開始処理が重複。`lib/auth.ts` に共通化し実装差異を解消 | ✅ 完了 |
| [ISSUE-055](./issue-055-auth-error-page-missing-rate-limit-ui.md) | `/auth/error` がレートリミットエラーを一般エラーとして表示 | `reason=rate_limit` パラメータを読まず常に「認証エラー」表示。時計アイコン＋残り時間表示に対応 | ✅ 完了 |

---

## 🔴 Critical — 認証デプロイ前作業（2026-03-28）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-056](./issue-056-auth-x-supabase-setup-required.md) | X ログインには Supabase ダッシュボード設定が必要 | Twitter Developer Portal でアプリ作成 + Supabase ダッシュボードで OAuth 有効化が必要。設定なしでは X ログインが OAuth エラーになる | 🔴 未着手 |

---

## 📊 サマリ

| 優先度 | 件数 |
|--------|------|
| 🔴 Critical | 16 |
| 🟠 High | 18 |
| 🟡 Medium | 18 |
| ⚪ Low | 5 |
| **合計** | **57** |

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
