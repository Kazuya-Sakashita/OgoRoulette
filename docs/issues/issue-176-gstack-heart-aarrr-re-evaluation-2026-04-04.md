# 第2回 gstack / HEART / AARRR 再評価レポート（2026-04-04）

## 概要

ISSUE-166/167/168 の実装完了を受け、gstack・HEART・AARRR の 3 フレームワークによる再評価を実施。
前回評価（issue-165、2026-04-04 早期）との差分を分析し、スコアをさらに向上させるためのロードマップを策定する。

---

## スコアサマリー

### gstack スコア

| 評価軸 | 前回 | 今回 | 差分 | 主な要因 |
|--------|------|------|------|---------|
| Product | 71 | 69 | −2 | Phase B 失速・バズ設計の不足を再評価 |
| UX | 65 | 70 | +5 | PrismBurst 実装・viewport 修正・コントラスト改善 |
| Visual/Brand | 72 | 75 | +3 | PrismBurst・OGP 日本語対応・muted 改善 |
| Engineering | 64 | 67 | +3 | ChunkLoadError 根絶（+9）、状態管理(58)が相殺 |
| Growth | 48 | 60 | +12 | OGP 動的生成で SNS シェア機能化 |
| **gstack 総合** | **64** | **68** | **+4** | |

### HEART スコア（今回初回計測）

| 項目 | スコア | 課題 |
|------|--------|------|
| Happiness | 72 | 演出パターンが繰り返しで飽きる |
| Engagement | 68 | Phase B 情報過多で没入が途切れる |
| Adoption | 73 | プリセット設計が機能、マルチプレイ初体験は障壁あり |
| Retention | 52 | 再訪動機・グループ保存導線が弱い |
| Task Success | 80 | おごり決めタスクは確実に達成できる |
| **HEART 総合** | **69** | |

### AARRR スコア（今回初回計測）

| 項目 | スコア | 課題 |
|------|--------|------|
| Acquisition | 45 | SEO/マーケ施策なし、OGP 修正が唯一の改善 |
| Activation | 73 | プリセット設計で低障壁 |
| Retention | 48 | 再訪設計が未整備、通知なし |
| Referral | 58 | シェアループが弱い、静止画カードなし |
| Revenue | 28 | マネタイズ未設計 |
| **AARRR 総合** | **50** | |

### 総合スコア（加重平均）

```
総合 = gstack(50%) + HEART(30%) + AARRR(20%)
     = 68×0.5 + 69×0.3 + 50×0.2
     = 34.0 + 20.7 + 10.0
     = 64.7 → 65
```

| | 前回 | 今回 | 差分 |
|-|------|------|------|
| gstack 総合 | 64 | 68 | **+4** |
| HEART 総合 | — | 69 | 初回 |
| AARRR 総合 | — | 50 | 初回 |
| **総合スコア** | **64** | **65** | **+1（gstack ベースでは +4）** |

---

## 伸びた箇所 / 伸びていない箇所

### 伸びた
- **Engineering +3**: ChunkLoadError 根絶（ISSUE-166）が安定性に大きく寄与
- **Growth +12**: OGP 動的生成（ISSUE-167）で SNS シェア時の画像なし問題が解消
- **UX +5**: PrismBurst（ISSUE-168）・viewport 修正（ISSUE-147）・コントラスト（ISSUE-149）

### 伸びていない / 下がった
- **Product −2**: 前回の甘い評価を修正。Phase B 失速とバズ設計の欠如を正直に評価
- **状態管理（Engineering 58）**: play/page.tsx 1278 行問題が未解決。ChunkLoadError +9 を相殺
- **Retention（HEART 52 / AARRR 48）**: グループ保存導線・再訪設計が手つかず
- **AARRR 全体（平均 50）**: Acquisition(45)・Revenue(28) が特に低い

---

## 課題一覧と優先度

### Critical

| 課題 | 影響 | 対応 ISSUE |
|------|------|-----------|
| ルーレット同期ズレ（owner/member 間） | UX・マルチプレイの核心体験 | issue-177（統合修正計画） |
| auth callback オープンリダイレクト | セキュリティ | issue-028（既存） |

### High Impact

| 課題 | 影響 | 対応 ISSUE |
|------|------|-----------|
| WinnerCard Phase B 情報過多 | Happiness, Engagement | issue-169（既存） |
| SNS 静止画シェアカード未実装 | Growth, Referral | issue-174（既存） |
| play/page.tsx 1278 行 | Engineering 状態管理 | issue-172（既存） |
| グループ保存が Phase B の 5 番目 | Retention | issue-175（既存） |
| ルーム参加オンボーディング不足 | Adoption | issue-170（既存） |

### Growth

| 課題 | 影響 | 対応 ISSUE |
|------|------|-----------|
| ウイルスループ設計なし | Referral, Acquisition | issue-173（既存） |
| グループリテンション設計なし | Retention | issue-175（既存） |
| LP が Next.js 外の静的 HTML | Acquisition, SEO | issue-178（新規） |

---

## スコア向上ロードマップ

### Phase 1 — 基盤安定（〜2 週間）

| 作業 | 対象スコア | 見込み上昇 |
|------|-----------|-----------|
| ルーレット同期バグ根絶（issue-177） | UX, Engineering | gstack +7 |
| auth セキュリティ修正（issue-028） | Engineering | gstack +2 |
| play/page.tsx 分割（issue-172） | Engineering 状態管理 | gstack +5 |

**Phase 1 後予測: gstack 68 → 73、総合 65 → 68**

### Phase 2 — 体験強化（〜1 ヶ月）

| 作業 | 対象スコア | 見込み上昇 |
|------|-----------|-----------|
| Phase B 整理（issue-169） | Happiness, Engagement | HEART +8 |
| SNS 静止画シェアカード（issue-174） | Growth, Referral | AARRR +10 |
| グループ保存 Primary CTA（issue-175） | Retention | AARRR +6 |
| オンボーディング改善（issue-170） | Adoption | HEART +5 |

**Phase 2 後予測: gstack 73 → 76、総合 68 → 73**

### Phase 3 — バズ・成長（〜2 ヶ月）

| 作業 | 対象スコア | 見込み上昇 |
|------|-----------|-----------|
| ウイルスループ設計（issue-173） | Referral, Acquisition | AARRR +10 |
| グループリテンション全体（issue-175） | Retention | AARRR +8 |
| LP SEO 統合（issue-178） | Acquisition | AARRR +8 |

**Phase 3 後予測: gstack 76 → 80、総合 73 → 77**

---

## 100 点の状態定義

### 初見での印象
アプリを開いた瞬間に「これを使いたい」と直感できる。デフォルト 4 名で即スタートでき、「ローカルスピン」と「マルチプレイ」の区別が 5 秒で理解できる。

### ルーレット体験の感情
カウントダウンが始まった瞬間から心拍数が上がる。停止直前のニアミス演出（惜しい！→ 止まる）が最大限の期待と恐怖を演出する。停止の瞬間に PrismBurst + Confetti + 振動 + 音が同時に爆発し「うわっ！」という声が出る。

### 結果発表の気持ちよさ
Phase A が終わったとき「もう一回見たい」と思わせる演出品質。Phase B に移行しても「シェア」と「グループ保存」の 2 択だけが目に入り、何をすべきか迷わない。

### SNS で共有したくなる強さ
「今すぐシェア」を押したら 1 秒以内にブランドが入った画像付き投稿が完成する。X のタイムラインで見た人が「なにこれ」とタップし、そのまま参加できるウイルスループが機能している。

### 継続利用の理由
グループを開くと前回誰が奢ったかが一目で分かり「今回こそ○○さんに払わせよう」という動機が自然に生まれる。ワンタップでルームが作成でき、メンバーが来るのを「ライブ待機室」で楽しく待てる。

---

## 優先度

**Critical** — スコア向上の前提となる評価・計画ドキュメント。Phase 1 の作業順を決める基準として参照。

## 関連 ISSUE

- issue-165: 第1回評価レポート
- issue-177: ルーレット同期バグ統合修正計画（Critical, 新規）
- issue-178: LP SEO 統合（Growth, 新規）
- issue-028: auth open redirect（Critical, 既存）
- issue-172: play/page.tsx 分割（High, 既存）
- issue-169: Phase B 整理（High, 既存）
- issue-174: シェアカード映え化（High, 既存）
- issue-173: ウイルスループ設計（Growth, 既存）
- issue-175: グループリテンション（Growth, 既存）
