# OgoRoulette 第4回包括的評価レポート（2026-04-05）

## ステータス
✅ 完了（評価ドキュメント）

## 優先度
**Critical** — 以降の ISSUE-201〜206 の根拠として参照

---

## スコアサマリー

| フレームワーク | 前回（issue-179） | 今回 | 差分 |
|-------------|-----------------|------|------|
| G-STACK総合 | 68 | 71 | +3 |
| HEART総合 | 69 | 79 | +10 |
| AARRR総合 | 52 | 56 | +4 |
| **総合スコア** | **65** | **70** | **+5** |

```
総合 = G-STACK(50%) + HEART(30%) + AARRR(20%)
     = 71×0.5 + 79×0.3 + 56×0.2 = 70.4 → 70点
```

---

## 今回評価に含めた実装（issue-179 以降）

- ISSUE-058: ルーレットホイール 360px 拡大
- ISSUE-061: Join ページ ambient orb + 参加者チップ
- ISSUE-062: 有効期限バナー段階的カラー
- ISSUE-063: ルーレットホイールタップ操作
- ISSUE-149: muted コントラスト改善
- ISSUE-193: Phase A 余韻制御（30秒フォールバック、タップ継続）
- ISSUE-194: 奢り回数別パーソナライズドリアクション
- ISSUE-195: サウンド ON/OFF トグル
- ISSUE-196: 再スピン ワンタップ
- ISSUE-197: セッション回数演出（N回戦）
- ISSUE-198: スピン履歴可視化（グループリスト）
- ISSUE-199: ユースケース拡大（LP・how-to-use・SEO）

---

## G-STACK 詳細（71/100）

| 軸 | スコア | 根拠 |
|----|--------|------|
| Goal | 16/20 | 「おごりをルーレットで公平に決める」は明確。継続利用・マネタイズ目標が未定義 |
| Strategy | 14/20 | ISSUE-199 でユースケース拡大。成長戦略（Acquisition）が実装されていない |
| Tactics | 16/20 | サウンド・再スピン・履歴・セッション演出など厚みが増した。PWA/シェアカードが未完 |
| Architecture | 13/20 | play/page.tsx 1296行未分割、テストカバレッジ最小 |
| Risk | 12/20 | rate-limit 多インスタンス問題（BUG-01）継続。clockOffset バグ（BUG-02） |

---

## HEART 詳細（79/100）

| 軸 | スコア | 根拠 |
|----|--------|------|
| Happiness | 18/20 | Phase A 演出（ISSUE-193/194）が大幅改善。コントラスト・ホイールサイズも改善 |
| Engagement | 16/20 | 再スピン・セッション演出・履歴可視化で再訪/継続動機が生まれた |
| Adoption | 16/20 | Join ページ ambient 演出でワクワク感が増加 |
| Retention | 12/20 | 履歴表示は進歩。「次回またこのグループで」の再開フロー・通知がない |
| Task Success | 17/20 | clockOffset バグ（BUG-02）でマルチプレイ同期ズレが残存 |

---

## AARRR 詳細（56/100）

| 軸 | スコア | 根拠 |
|----|--------|------|
| Acquisition | 12/20 | ISSUE-199 SEO keywords 拡充。Google Search Console 未申請が継続 |
| Activation | 15/20 | ゲストモード即スタートは良好。ルーム機能への誘導が弱い |
| Retention | 12/20 | 履歴表示で+2。プッシュ通知・リマインダーなし |
| Revenue | 5/20 | 完全無料。マネタイズ設計なし |
| Referral | 12/20 | シェア機能は基本実装済み。OGP 静止画シェアカードが未完成 |

---

## 発見された不具合（ISSUE-201〜206 に詳細）

| ID | 深刻度 | ISSUE | 概要 |
|----|--------|-------|------|
| BUG-01 | Critical | ISSUE-201 | Vercel serverless で rate-limit が無効（globalThis 非共有） |
| BUG-02 | Major | ISSUE-202 | メンバーの clockOffsetMs が常に 0（マルチプレイ同期ズレ） |
| BUG-03 | Major | ISSUE-203 | カウントダウン中に参加者削除可能（勝者インデックスズレ） |
| BUG-04 | Major | ISSUE-204 | PrismBurst が @keyframes を DOM に蓄積（メモリリーク） |
| BUG-05 | Medium | ISSUE-205 | saveGroup が名前マッチングのためリネーム後に重複エントリ生成 |
| BUG-06 | Medium | ISSUE-206 | handleRespin 二重タップで重複カウントダウンタイマー起動リスク |

---

## 90点到達プラン

```
現在: 70点
目標: 90点（+20点）
```

### フェーズ A: バグ修正（+5点）
- BUG-02 clockOffset 修正: +2（HEART Task Success）
- BUG-01 rate-limit Vercel KV 化: +2（G-STACK Risk）
- BUG-03/06 修正: +1（HEART Happiness/Task Success）

### フェーズ B: 完成度向上（+8点）
- play/page.tsx 分割: +2（G-STACK Architecture）
- SNS シェアカード完成: +3（AARRR Referral+Acquisition）
- ルーム参加オンボーディング改善（issue-170）: +2（HEART Adoption+AARRR Activation）
- WinnerCard Phase B 整理（issue-169）: +1（HEART Happiness）

### フェーズ C: 成長設計（+7点）
- Retention 設計（通知・グループ再開）: +4（HEART Retention +AARRR Retention）
- マネタイズ設計（issue-192）: +3（AARRR Revenue）

### 達成スコア試算（全フェーズ完了後）
```
G-STACK: 71 + 4(Risk) + 3(Arch) = 78
HEART:   79 + 2(Task) + 2(Adopt) + 1(Happy) + 4(Retention) = 88
AARRR:   56 + 3(Referral) + 3(Activation) + 4(Retention) + 3(Revenue) = 69

総合 = 78×0.5 + 88×0.3 + 69×0.2 = 39 + 26.4 + 13.8 = 79.2
```

→ フェーズ A〜C でおよそ **79点**。マネタイズが Revenue +10 まで育てば **83点** 水準。
  90点到達には SEO 流入確立（Acquisition 18+）と Retention 18+ が必要。
