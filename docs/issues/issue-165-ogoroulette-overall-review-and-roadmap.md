# OgoRoulette 全体評価・改善ロードマップ（gstack評価 2026-04-04）

## 概要

gstack フレームワークを用いた OgoRoulette 全体評価の結果と改善ロードマップ。
現在の実力値をスコア化し、100点に向けた優先順位付き改善計画をまとめる。

---

## gstack 評価スコア

| カテゴリ | スコア | 主な減点要因 |
|---------|--------|-------------|
| **Product** | 71 / 100 | 継続利用動機の弱さ、シチュエーション依存、国際展開の壁 |
| **UX** | 65 / 100 | ChunkLoadError でピーク体験が壊れる、ルーム導線の不明瞭さ |
| **Visual / Brand** | 72 / 100 | og-image 欠落、プリズムバースト未デプロイ、Phase B の格落ち |
| **Engineering** | 64 / 100 | ChunkLoadError 再発構造、1278行ファイル、テスト不明確 |
| **Growth / Shareability** | 48 / 100 | og-image 欠落、ウイルスループなし、ソーシャルプルーフ弱 |
| **総合** | **64 / 100** | — |

---

## 強みの整理

- サーバー側で当選者を決定する「疑われない」設計は他のルーレットアプリにない本質的差別化
- Supabase Realtime による全員同期は「みんなで見る体験」を正しく実現している
- WinnerCard Phase A のシネマティック演出（カウントダウン・ニアミス・停止・3.2s 演出）はハッカソン作品として突出したクオリティ
- ハプティクス + 音声 + 視覚のトリプルフィードバックはモバイル体験として高品質
- ゲストモード + QR コード参加は摩擦が少なく即使える設計

---

## 主要問題点（10点抽出）

| # | 問題点 | 重大度 | 影響カテゴリ |
|---|--------|--------|------------|
| P1 | og-image.png が存在しない（404） | Critical | Growth / Visual |
| P2 | ChunkLoadError がルーレット停止直後に発生する構造 | Critical | Engineering / UX |
| P3 | プリズムバーストが未コミット・未デプロイ | Critical | Visual / UX |
| P4 | WinnerCard Phase B のデザインが Phase A から急落する | Recommended | Visual / UX |
| P5 | ルーム参加導線が初見で分かりにくい | Recommended | UX / Growth |
| P6 | 金額入力がルーレット前に必要だと気づかれない | Recommended | UX |
| P7 | play/page.tsx が 1278 行（保守性が深刻） | Recommended | Engineering |
| P8 | シェア UX が複雑で使われない | Recommended | Growth |
| P9 | ウイルスループが設計されていない | Nice-to-have | Growth / Product |
| P10 | ソーシャルプルーフが弱い | Nice-to-have | Growth |

---

## 優先度別改善カテゴリ

### Critical（今すぐ着手）
- og-image.png 作成・配置
- ChunkLoadError の根絶（dynamic import 整理 + デプロイ）
- プリズムバーストのコミット・デプロイ

### Recommended（完成度を大きく上げる）
- WinnerCard Phase B の演出改善
- ルーム参加導線の明確化
- 金額入力 UX の改善
- play/page.tsx 分割リファクタ
- シェア UX の単純化

### Nice-to-have（将来の伸びしろ）
- ウイルスループ設計
- シェアカードの映え化
- グループ再利用・リテンション施策
- ソーシャルプルーフの強化

---

## 改善ロードマップ

### Phase 1 — 信頼性の回復（目標: 64点 → 72点）

**目的**: 本番で壊れているものを直し「シェアしても恥ずかしくない」状態にする

| タスク | Issue | 期待効果 |
|--------|-------|---------|
| ChunkLoadError 根絶 + デプロイ | issue-166 | Engineering +9, UX +5 |
| og-image.png 作成・配置 | issue-167 | Growth +8, Visual +4 |
| プリズムバースト commit & deploy | issue-168 | Visual +4, UX +3 |

---

### Phase 2 — 体験品質の向上（目標: 72点 → 80点）

**目的**: 「使ってみたら良かった」から「また使いたい」「友達に勧めたい」へ

| タスク | Issue | 期待効果 |
|--------|-------|---------|
| WinnerCard Phase B 演出改善 | issue-169 | Visual +4, UX +3 |
| ルーム参加導線の明確化 | issue-170 | UX +4, Growth +2 |
| 金額入力 UX 改善 | issue-171 | UX +3 |
| play/page.tsx 分割 | issue-172 | Engineering +6 |

---

### Phase 3 — バズ・ブランド・継続利用強化（目標: 80点 → 85点以上）

**目的**: 口コミで広まり、使い続けられるプロダクトへ

| タスク | Issue | 期待効果 |
|--------|-------|---------|
| ウイルスループ設計 | issue-173 | Growth +8, Product +3 |
| シェアカードの映え化 | issue-174 | Growth +5, Visual +3 |
| グループ再利用・リテンション | issue-175 | Product +4, Growth +3 |

---

## 100点に近い理想像

### 初見ユーザーが感じること
「あ、これちゃんとしてる」と感じる。デモルーレットを一回回すだけで「グループで使いたい」と思う。SNS で見かけたとき、サムネイルで「なにこれ」と感じてタップする。

### ルーレット体験
カウントダウンから始まり、音・振動・ニアミスが重なって「止まりそうで止まらない」緊張感が最大化する。止まった瞬間のプリズムバースト + Confetti で「わー！」と声が出る。画面を見ていた全員の表情が変わる瞬間が作れている。

### 結果表示
Phase A のシネマティック演出から Phase B でも演出が続いて「金額が出てきた！」という喜びがある。シェアボタンを押したくなる気持ちが自然に湧く。

### シェアしたくなる強さ
「この結果を送りたい」という気持ちが先に来る。受け取った側が「え、これなに？使いたい」と思う設計。

### 安定性
何度回しても、何人で使っても、デプロイ後でも、一切エラーが起きない。特にルーレットが止まった瞬間は世界で最も安定していてほしい瞬間。

### 使い続けたくなる理由
グループが保存され、食事のたびに「OgoRoulette 回そう」が合言葉になる。過去の奢り履歴が面白い。グループの文化として定着する。

---

## 個別 issue 一覧

| Issue | タイトル | 優先度 |
|-------|---------|--------|
| [issue-166](issue-166-chunkload-dynamic-import-cleanup-and-deploy.md) | ChunkLoadError 根絶 + 未コミット修正のデプロイ | Critical |
| [issue-167](issue-167-og-image-missing-404.md) | og-image.png 欠落（SNS シェア画像なし） | Critical |
| [issue-168](issue-168-prism-burst-uncommitted.md) | プリズムバースト 未コミット・未デプロイ | Critical |
| [issue-169](issue-169-winner-card-phase-b-polish.md) | WinnerCard Phase B の演出・デザイン改善 | Recommended |
| [issue-170](issue-170-room-onboarding-clarity.md) | ルーム参加導線の明確化 | Recommended |
| [issue-171](issue-171-billing-input-ux.md) | 金額入力 UX の改善 | Recommended |
| [issue-172](issue-172-play-page-tsx-split.md) | play/page.tsx 分割リファクタ（1278行） | Recommended |
| [issue-173](issue-173-viral-loop-design.md) | ウイルスループ設計 | Nice-to-have |
| [issue-174](issue-174-shareable-result-card.md) | シェアカードの映え化 | Nice-to-have |
| [issue-175](issue-175-group-reuse-retention.md) | グループ再利用・リテンション施策 | Nice-to-have |

---

## 備考

- 評価実施日: 2026-04-04
- 評価フレームワーク: gstack（Product / UX / Visual / Engineering / Growth）
- 補助フレームワーク: HEART（Happiness / Engagement / Adoption / Retention / Task Success）
- 評価基準: 「ハッカソン作品として良い」ではなく「プロダクトとして強い」軸で採点
- 既存の関連 issue: issue-012（og-image 視覚設計）、issue-066〜072（シェア）、issue-101（PWA）、issue-137（ソーシャルプルーフ）
