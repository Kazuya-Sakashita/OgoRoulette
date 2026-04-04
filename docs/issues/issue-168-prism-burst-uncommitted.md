# プリズムバースト 未コミット・未デプロイ

## 概要

当選確定瞬間の虹色リング爆発演出「プリズムバースト」が実装済みだが未コミット・未デプロイのため、本番では動作していない。ルーレット停止の最大感情ピークに演出が届いていない状態が継続している。

## 背景

当選瞬間を「神演出」にするために `components/prism-burst.tsx` が実装された。
Framer Motion による conic-gradient + mask-image のプリズムリング + 中心フラッシュ + オーロラスウィープの3層構成。

gstack 評価でも「ピーク演出の欠如」が Visual スコアを下げている主因の一つ。

## 現状の問題

ローカルに存在するが未コミットのファイル・変更:

| ファイル | 状態 | 内容 |
|---------|------|------|
| `components/prism-burst.tsx` | 新規・未コミット | プリズムバースト本体 |
| `app/home/page.tsx` | 変更・未コミット | PrismBurst import + showPrismBurst state + JSX 追加 |
| `app/room/[code]/play/page.tsx` | 変更・未コミット | PrismBurst import + showPrismBurst state + JSX 追加 |

本番では Confetti のみが動作しており、当選瞬間の演出が弱い。
ISSUE-166 の ChunkLoadError 修正も同じファイルに含まれるため、同時コミットが必要。

## 目的

- 当選確定瞬間に虹色プリズムリングが中心から拡散する演出を本番で有効にする
- ルーレット体験のクライマックスを「わー！」という反応が出るレベルに引き上げる
- 実装コストをかけた演出が本番ユーザーに届く状態にする

## 対応内容

### 実装内容の確認

`components/prism-burst.tsx` の仕様:
- 4 段階のプリズムリング（conic-gradient + radial-gradient mask）
- Safari WebKit 対応: mask-image と filter:blur を別要素に分離
- 中心フラッシュ（当選者カラー or 白/パープル系）
- オーロラスウィープ（108度の虹色光帯が左→右に横断）
- `active: boolean` prop で false→true のエッジで発火
- BURST_DURATION_MS = 1450ms で自動終了
- z-index: 62（WinnerCard z-50 より上、Confetti z-70 より下）

`home/page.tsx` での使用:
```typescript
const [showPrismBurst, setShowPrismBurst] = useState(false)

// handleSpinComplete 内
setShowPrismBurst(true)
setTimeout(() => setShowPrismBurst(false), 1800)

// JSX
<PrismBurst
  active={showPrismBurst}
  winnerColor={winner ? SEGMENT_COLORS[winner.index % SEGMENT_COLORS.length] : undefined}
/>
```

`play/page.tsx` での使用:
- オーナーとメンバー両方の spinComplete 処理で `setShowPrismBurst(true)` を呼び出す

### コミット手順

ISSUE-166 と同時にコミットすること（同じファイルを変更しているため）:

```bash
git add components/prism-burst.tsx app/home/page.tsx app/room/[code]/play/page.tsx
git commit -m "feat: ISSUE-166/168 — プリズムバースト実装・ChunkLoadError 根絶（dynamic→static import）"
git push
```

### デプロイ後の確認

- ルーレット停止直後に虹色リングが中心から広がるか
- 当選者カラーが中心フラッシュに反映されているか
- /home と /room/[code]/play の両ページで動作するか
- Safari（iOS）で mask-image + blur が正常に動作するか

## 完了条件

- [x] `components/prism-burst.tsx` がコミット済み（予定）
- [x] `app/home/page.tsx` の PrismBurst 関連変更がコミット済み（予定）
- [x] `app/room/[code]/play/page.tsx` の PrismBurst 関連変更がコミット済み（予定）
- [ ] Vercel デプロイ完了
- [ ] /home でルーレット停止直後にプリズムバーストが表示される
- [ ] /room/[code]/play でも同様に表示される（オーナー・メンバー双方）
- [ ] iOS Safari で演出が崩れない

## ステータス

**完了（コミット待ち）** — 2026-04-04
`components/prism-burst.tsx` 実装済み。WebKit Safari バグ（mask-image + filter 同一要素問題）を外側/内側要素分離で解消。
`app/home/page.tsx` および `app/room/[code]/play/page.tsx` で PrismBurst 統合済み。
ISSUE-166 と同時コミット予定。

## 優先度

**Critical** — 実装済みなのに本番で動いていない。コミットするだけで達成できる改善。

## 期待効果

- Visual スコア: 72 → 76（+4）
- UX スコア: 65 → 68（+3）
- 当選瞬間の感情ピークが「Confetti のみ」から「プリズムバースト + Confetti」に強化される

## 関連カテゴリ

Visual / UX / Engineering

## 備考

- ISSUE-166 との同時コミットを推奨（対象ファイルが重複するため）
- mask-image + filter:blur は同一要素では Safari で動作しない。実装では outer div に mask、inner div に blur を分離済み
- z-index 設計: WinnerCard(50) < PrismBurst(62) < Confetti(70) で演出が重ならないよう設計済み
- `active` prop は false→true のエッジで発火するため、連続スピン（リスピン）でも再発火する
