# OgoRoulette — Issue 一覧

> **評価基準**: CEO レビュー（2026-03-25）および SPIN ボタンバグ調査結果をもとに作成
> **ステータス凡例**: 🔴 未着手 / 🟡 対応中 / ✅ 完了

---

## 🔴 Critical（動かない / UX 崩壊 / 致命バグ）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-074](./issue-074-safe-display-name-spec.md) | SNS共有時の表示名安全仕様（設計・親Issue） | Google/LINEログイン由来のフルネームがそのままSNS共有される。display_name を分離し安全名のみ公開する | ✅ 完了（commit: d1fb32c） |
| [ISSUE-075](./issue-075-display-name-db-migration.md) | Profile に display_name フィールド追加（DB migration） | `profiles` テーブルに `display_name` / `display_name_confirmed_at` を追加 | ✅ 完了（commit: 1b3579a） |
| [ISSUE-076](./issue-076-get-display-name-util.md) | getDisplayName() ユーティリティ実装 | `lib/display-name.ts` に表示名ロジックを集約。fallback は `"ユーザー" + id末尾4文字` | ✅ 完了（commit: 1b3579a） |
| [ISSUE-077](./issue-077-replace-share-name-with-display-name.md) | シェア・公開箇所の表示名を display_name に切り替え | result / history / share-service / 招待ページのオーナー名を display_name に変更 | ✅ 完了（commit: 1b3579a） |
| [ISSUE-078](./issue-078-display-name-confirmation-sheet.md) | 初回シェア前の「公開名確認」ボトムシート実装 | 初回シェアアクション時に1回だけ公開名を確認するUIを追加 | ✅ 完了（commit: 4b88980） |
| [ISSUE-073](./issue-073-spin-button-initially-disabled.md) | home 画面 SPIN ボタンが初回押せない（overlay CSS バグ） | `roulette-wheel.tsx` の ambient glow `motion.div` に `pointer-events: none` がなく、ボタン上部 72% へのクリックを奪っていた | ✅ 完了 |
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

## 🎨 Critical — デザインレビュー（2026-03-28 / design-shotgun）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-058](./issue-058-design-roulette-wheel-visual-impact.md) | ルーレットホイールが小さく、回転の迫力が足りない | プレイページでホイールが画面の約35%しか占有しない。スピン中・当選後の演出が乏しく、アプリのハイライト体験が弱い | 🔴 未対応 |
| [ISSUE-060](./issue-060-design-result-celebration-missing.md) | スピン後の当選発表に祝祭感がなく、感情的クライマックスを逃している | ホイールが止まるだけで confetti・音・画面演出がない。「誰が奢るか決まった！」という瞬間の演出が欠如 | ✅ 完了（Phase 1） |

---

## 🎨 High — デザインレビュー（2026-03-28 / design-shotgun）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-057](./issue-057-design-top-page-cta-hierarchy.md) | トップページの CTA 階層が不明確・ボタンテキストに不統一 | 4つのボタンが同等の重みで並び、ユーザーが迷う。「Xで続ける」のみ文体が異なりブランド一貫性を損なう | ✅ 完了（commit: 39e4e51） |
| [ISSUE-059](./issue-059-design-play-page-info-density.md) | プレイページの情報密度が高く、ホイールまでのスクロールが必要 | ヘッダー・有効期限バナー・メンバー一覧・設定行がホイールの前に積み重なり、メインコンテンツが埋もれる | ✅ 完了（commit: c58d987） |

---

## 🎨 Medium — デザインレビュー（2026-03-28 / design-shotgun）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-061](./issue-061-design-join-page-engagement.md) | 招待参加ページが素っ気なく、参加へのモチベーションを高められていない | 参加人数とボタンのみのシンプルな構成。招待流入という最重要のユーザー獲得ポイントに演出がない | ✅ 完了（commit: c84fede） |
| [ISSUE-062](./issue-062-design-expiry-banner-overwarning.md) | 有効期限バナーが通常時も警告色で表示され、ノイズになっている | 期限が十分残っていても amber 色バナーが常時表示。警告疲れを引き起こし、本当の警告が機能しなくなる | ✅ 完了（実装確認済み: 期限切れ・24h以内のみ表示） |
| [ISSUE-063](./issue-063-design-home-spin-button-prominence.md) | ホームページの SPIN ボタンがルーレットと視覚的に分離しており、操作の関係が分かりにくい | ボタンとホイールの視覚的結びつきが弱い。「このボタンでホイールが回る」が直感的に伝わらない | ✅ 完了（commit: 99f32ea） |

---

## 🎨 Low — デザインレビュー（2026-03-28 / design-shotgun）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-064](./issue-064-design-lobby-qr-code-visual.md) | ロビーページの QR コードと招待 UI が機能的で、ワクワク感に欠ける | QR コードが素の白四角。ロゴ埋め込み・参加時アニメーション・全員揃った時の演出がない | ✅ 完了（commit: 91d14a9） |
| [ISSUE-065](./issue-065-design-login-page-provider-visual-weight.md) | ログインページのプロバイダーボタンに視覚的重み付けがなく、X が後から追加された印象 | 3ボタンが異なる色系統でバラバラ感。トップページとの実装重複も解消すべき | ✅ 完了（commit: 08ce1b6） |

---

## 📱 SNS シェア強化（2026-03-28）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-066](./issue-066-sns-share-constraints.md) | SNS シェア制約の整理と共通設計方針 | X・LINE intent URL はテキスト+URLのみ。動画は Web Share API (iOS 15+ / Android Chrome) 経由。trimForX() で 280 字超過を自動トリム | ✅ 完了 |
| [ISSUE-067](./issue-067-share-payload-design.md) | SharePayload — 共通シェアデータ構造の設計 | winner / winnerColor / participants / totalBill / treatAmount / videoBlob を統一した型に。URL 生成・テキスト生成を lib/share-service.ts に集約 | ✅ 完了 |
| [ISSUE-068](./issue-068-share-message-templates.md) | SNS シェアメッセージテンプレートの追加 | 定番・ドラマチック・いじり・金額付き・グループの 5 テンプレートを実装。ShareSheet のチップ UI で選択可能 | ✅ 完了 |
| [ISSUE-069](./issue-069-share-sheet-ux.md) | ShareSheet UX 改善 — テンプレート選択 + テキスト編集 | テンプレートチップ + メッセージプレビュー + 自由テキスト編集（280字カウンター）を追加 | ✅ 完了 |
| [ISSUE-070](./issue-070-share-service-core.md) | lib/share-service.ts — シェアサービス中核実装 | buildShareUrl / buildShareText / shareToX / shareToLine / shareWithFile / downloadVideo を新規ファイルに集約 | ✅ 完了 |
| [ISSUE-071](./issue-071-share-winner-card-integration.md) | WinnerCard クイックシェアボタンを share-service に統合 | winner-card.tsx の独自 URL 生成・テキスト生成・プラットフォーム呼び出しを share-service に委譲 | ✅ 完了 |
| [ISSUE-072](./issue-072-share-video-ios-mp4.md) | ShareSheet 動画拡張子を blob.type から自動判定（MP4 / WebM） | `.webm` ハードコードを廃止。iOS で MP4 生成時にファイル名・MIME type が正しくなる | ✅ 完了 |

---

## 📊 サマリ

| 優先度 | 件数 |
|--------|------|
| 🔴 Critical | 18 |
| 🟠 High | 22 |
| 🟡 Medium | 23 |
| ⚪ Low | 7 |
| 📱 SNS Share | 7 |
## 🔒 プライバシー・表示名安全化（2026-03-29）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-079](./issue-079-profile-edit-display-name.md) | プロフィール編集導線の追加（display_name 変更） | ログインユーザーが公開名をいつでも変更できる UI を追加 | ✅ 完了（commit: 4b88980, 3eb6a75） |

## 🚀 バズ特化フェーズ1（2026-03-30）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-095](./issue-095-recording-stability-fallback.md) | 録画安定化 — MediaRecorder 失敗時に静止画フォールバック | iOS Safari で録画が失敗した際、recordingCanvas から PNG を取得してシェア可能に | ✅ 完了 |
| [ISSUE-096](./issue-096-landing-page-demo-spin.md) | ランディングページにデモルーレットを追加 | ログイン前にデモ体験 → コンバージョン向上 | ✅ 完了 |
| [ISSUE-097](./issue-097-x-share-save-flow-ogp-enhancement.md) | X シェア「保存→貼り付け」フロー改善 + OGP 画像強化 | blob 自動ダウンロード後 X Intent 起動 + 背景グラデーション強化 | ✅ 完了 |

## 🚀 バズ特化フェーズ2（2026-03-30）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-098](./issue-098-near-miss-effect.md) | ニアミス演出 | スピン停止直前に隣セグメントを280ms点灯 → 「惜しかった！」感 | ✅ 完了 |
| ISSUE-099 | 同期バイブレーション | `vibrate(HapticPattern.result)` は play/page.tsx:614,654 で実装済み | ✅ 完了（既存） |
| [ISSUE-100](./issue-100-live-waiting-room.md) | ライブ待機室 | Supabase Realtime でメンバー参加を即検出 + 参加トースト | ✅ 完了 |
| [ISSUE-101](./issue-101-pwa-install-prompt.md) | PWA インストールプロンプト | beforeinstallprompt キャプチャ + ホーム追加バナー | ✅ 完了 |
| [ISSUE-102](./issue-102-video-duration-optimization.md) | 動画尺最適化 | REVEAL_RECORD_DURATION_MS 定数抽出（機能変化なし） | ✅ 完了 |

## 🚨 iPhone 動画シェア問題（2026-03-30）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-103](./issue-103-fix-ios-png-fallback-mime-bug.md) | iPhone PNG fallback MIME/拡張子バグ修正 | shareWithFile/downloadVideo/ShareSheet の PNG 対応 | ✅ 完了（commit: e470755） |
| [ISSUE-104](./issue-104-ios-share-ux-improvement.md) | iOS 向けシェア UX 明確化 | canRecordVideo 公開・ボタンテキスト変更・REC 非表示 | ✅ 完了（commit: e470755 で REC 非表示・ShareSheet 対応） |
| [ISSUE-105](./issue-105-gif-video-generation-ios.md) | iOS でも動画/GIF でシェアできるようにする | GIF生成 PoC / PNG静止画強化 / サーバー生成検討 | 🔴 未対応 |

| **合計** | **105** |

---

## 📱 モバイル入力・QR スキャン改善（2026-03-30）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-080](./issue-080-improve-mobile-room-id-input-performance.md) | スマホでルームID入力時の反応が鈍い問題を改善 | input の onChange をデバウンス + キーボード上昇時の scroll 最適化 | ✅ 完了（commit: ae02520） |
| [ISSUE-081](./issue-081-fix-mobile-flick-input-instability.md) | スマホのフリック入力でルームID入力が不安定な問題を修正 | IME compositionend イベントで確定前文字入力を制御 | ✅ 完了（commit: 8dfa688） |
| [ISSUE-082](./issue-082-fix-iphone-room-id-input-regression.md) | iPhoneでルームID入力ができなくなった問題を修正（ISSUE-081リグレッション） | ISSUE-081 の compositionend 対応が Safari で逆効果になるリグレッション修正 | ✅ 完了（commit: 383d7d9） |
| [ISSUE-083](./issue-083-fix-share-return-about-blank.md) | シェア後にChromeへ戻るとabout:blankになる問題を修正 | Web Share API 完了後に window.history.back() → about:blank になる問題を修正 | ✅ 完了（commit: 1731992） |
| [ISSUE-084](./issue-084-improve-qr-scan-mobile-strategy.md) | QRコード読み取り機能のモバイル実装戦略 | jsQR + getUserMedia の全端末対応設計方針 | ✅ 完了（commit: bc1febb → 129bdd8 → bd4742c） |
| [ISSUE-085](./issue-085-qr-scanner-component.md) | jsQR 導入と QrScanner コンポーネント実装 | `components/qr-scanner.tsx` 実装（getUserMedia + Canvas ループ） | ✅ 完了（commit: 129bdd8） |
| [ISSUE-086](./issue-086-scan-page-qr-integration.md) | /scan ページへの QrScanner 統合 | プレースホルダー削除・QrScanner コンポーネント組み込み | ✅ 完了（commit: bd4742c） |
| [ISSUE-087](./issue-087-camera-permission-denied-ui.md) | カメラ権限拒否・未対応 UI | NotAllowedError / NotFoundError を捕捉しエラー UI 表示 | ✅ 完了（commit: bd4742c） |
| [ISSUE-088](./issue-088-review-home-greeting-display-name.md) | home画面の挨拶表示を公開名ベースへ修正 | `user.user_metadata.full_name` → `profile.displayName` に変更 | ✅ 完了（commit: c20cfac） |
| [ISSUE-089](./issue-089-fix-iphone-qr-camera-startup.md) | iPhoneでQRスキャン時にカメラが起動しない問題を修正 | `<video>` 常時マウント + 表示切り替えで iPhone Safari の getUserMedia 問題を解消 | ✅ 完了（commit: 5b5c81d） |
| [ISSUE-090](./issue-090-fix-room-join-member-display-name.md) | ルーム参加時のメンバー表示を公開名に統一 | join API の `nickname` を `getDisplayName()` に変更 | ✅ 完了（commit: 55bb60e） |

---

## 🎬 動画演出・エンゲージメント強化（2026-03-30）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-091](./issue-091-improve-roulette-video-recording-timing.md) | ルーレット動画の録画タイミング修正・感情アーク演出 | スピン開始〜当選発表の録画タイミングを調整し、参加者イントロを追加 | ✅ 完了（commit: b681e6d） |
| [ISSUE-092](./issue-092-improve-roulette-video-visual-effects.md) | ルーレット動画の視覚演出を強化 | 当選者名76pxフォント・ダブルグロウ・パーティクル演出追加 | ✅ 完了（commit: b681e6d） |
| [ISSUE-093](./issue-093-instant-share-at-peak-moment.md) | 当選確定の瞬間に「今すぐシェア」ボタンを追加 | WinnerCard に 1.5s 後に出現するインスタントシェアボタン実装 | ✅ 完了（commit: f3dfd44） |
| [ISSUE-094](./issue-094-result-page-conversion-cta.md) | /result ページに新規ユーザー向け CTA を追加 | シェア流入ユーザーへの「あなたもやる？」コンバージョン CTA 追加 | ✅ 完了（commit: f3dfd44） |

---

## 🔐 公開名保存バグ修正（2026-03-31）

| ID | タイトル | 概要 | ステータス |
|----|--------|------|----------|
| [ISSUE-106](./issue-106-fix-display-name-not-saved-to-db.md) | 公開名を編集してもDBに保存されない問題を修正 | 旧 Prisma クライアントキャッシュによる保存失敗を調査・文書化 | ✅ 完了（commit: 1384b3b, 1c3833c） |
| [ISSUE-107](./issue-107-fix-display-name-persistence-stale-prisma-client.md) | 公開名がDBに保存されず再ログインで消える問題の根本原因修正 | stale Prisma クライアント問題 + /api/profile バリデーション強化 | ✅ 完了（commit: 547ded3, 22064ec） |
| [ISSUE-108](./issue-108-x-video-share-honest-ux.md) | Xへの動画シェア仕様を実態に合う形へ修正 | 動画ダウンロード分離・「テキストのみ」注記追加・Xシェア誤認UX改善 | ✅ 完了（commit: bb29b14, 49e6916） |

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
