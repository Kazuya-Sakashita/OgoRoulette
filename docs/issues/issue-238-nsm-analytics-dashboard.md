# ISSUE-238: NSM(P1) — スピン回数/セッション計測基盤の整備

## ステータス
🔲 TODO

## 優先度
**P1 / High**

## カテゴリ
Analytics / North Star Metric / Growth

## 対象スコア
NSM スコア: +20/100 → プロダクト改善判断の精度向上

---

## Summary

2026-04-16 統合評価で North Star Metric を「1セッションあたりのスピン回数」と定義した。  
しかし現状、この値を計測・追跡できる基盤がない。  
コードには `trackEvent(AnalyticsEvent.*)` が実装済みだが、集計・可視化がされていない。  
NSM を継続的に観測できるようにすることで、機能改善の効果を数値で評価できる。

---

## Background

評価フレームワーク追加（JTBD / EEM / NSM）により NSM を定義：
- **NSM:** 1セッションあたりのスピン回数（目標: > 2.0）
- 現在のコード: `trackEvent(AnalyticsEvent.HOME_VIEWED)` 等は実装済み
- ギャップ: 集計・ダッシュボードがない

---

## Key Metrics to Track

| メトリクス | 定義 | 目標値 |
|-----------|------|-------|
| Spins/Session | スピン数 ÷ セッション数 | > 2.0 |
| Guest→Login 転換率 | ログイン完了 ÷ ISSUE-234 モーダル表示 | > 15% |
| Share Rate | シェア ÷ スピン完了 | > 20% |
| D7 Retention | 7日後再訪率 | > 25% |

---

## Scope

### 案A: Vercel Analytics + カスタムイベント（推奨）
- `@vercel/analytics` は既存。カスタムイベントに `spin_complete` / `session_start` を追加
- Vercel ダッシュボードでファネル確認

### 案B: 既存 `trackEvent` を Supabase に集計テーブルで記録
- `analytics_events` テーブルを追加
- 週次 SQL で NSM を算出

### 最小実装（すぐできる）
```tsx
// lib/analytics.ts に追加
export const AnalyticsEvent = {
  ...existing,
  SESSION_SPIN_COUNT: 'session_spin_count',  // スピン完了時に回数も送る
}

// app/home/page.tsx の handleSpinComplete に追加
trackEvent(AnalyticsEvent.SESSION_SPIN_COUNT, { count: sessionSpinCount + 1 })
```

---

## Acceptance Criteria

- [ ] スピン完了イベントにセッション内スピン回数が含まれて送信される
- [ ] Vercel Analytics または同等のツールで Spins/Session が確認できる
- [ ] Guest→Login 転換率が ISSUE-234 モーダル経由で計測できる
- [ ] 週次で NSM の推移が確認できるレポート or ダッシュボードがある

## Priority
**P1**

## Impact
NSM スコア: 65 → 85/100（計測基盤が整うことで改善サイクルが回せる）

## Risk / Notes
- Vercel Analytics の無料枠: 月 2,500 イベントまで（超過課金に注意）
- PII（個人情報）をイベントペイロードに含めない
