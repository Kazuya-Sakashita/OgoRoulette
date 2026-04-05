# UI/UX — 感情設計・体験設計パターン

## 感情設計の原則

**「動く」と「楽しい」は別の問題。感情設計は機能設計とは独立して行う。**

### 感情スコア評価軸（20点満点）

| ポイント | 内容 |
|---|---|
| 停止前の緊張感 | スロー区間（2秒）に演出があるか |
| 停止の瞬間 | 音・フラッシュ・クライマックスがあるか |
| 当選者リビール | 名前がドラマチックに登場するか |
| マルチプレイヤー共同体験 | 全員が「一緒に体験」できるか |
| シェアしたい衝動 | 録画〜シェアまでが1タップに近いか |

**現スコア: 11/20（55%）。ISSUE-207 で対応予定。**

## Kano モデル適用

| 品質 | OgoRoulette での例 |
|---|---|
| 当たり前品質（なくて怒る） | 正確な抽選・マルチプレイヤー同期・ゲストモード |
| 一元的品質（あれば嬉しい） | winner カード・履歴・グループ保存・金額入力 |
| 魅力品質（あると驚く） | 録画シェア・PrismBurst・季節テーマ（未実装） |

## デザインシステム

```css
/* globals.css — デザイントークン */
--background: #0B1B2B;   /* Deep Navy */
--primary: #F59E0B;      /* Warm Orange */
--accent: #F97316;       /* Bright Orange */
--foreground: #F9FAFB;
```

- **ストライプ:** `stripe-blue`（青紫）/ `stripe-green`（緑）/ `stripe-amber`（橙赤）
- **フォント:** Inter（ラテン）+ Noto Sans JP（日本語）
- **モーション:** Framer Motion v11（`roulette-wheel.tsx`）

## モバイル対応パターン

```tsx
// ✅ 正解
className="min-h-dvh"           // iOS 動的ツールバー対応
style={{ width: wheelSize }}     // JS で動的計算（ISSUE-141）

// ❌ 避ける
className="min-h-screen"        // iOS Safari で不正確
style={{ height: "100vh" }}     // 動的ツールバー非考慮
```

## WinnerCard 設計ルール

- CTA は2択以内（情報過多禁止）— ISSUE-181 参照
- 「次回のアクション導線」を必ず含める — ISSUE-210 参照
- リビール演出：名前は即表示せず 0.8秒のアニメーション後に表示

## ロビー（room/[code]）

- QR コード + メンバーリスト + 参加トースト
- 有効期限バナー: 72h→info / 24h→warning / 3h→danger（ISSUE-062 実装済み）
