# ISSUE-073: SPINボタンが初回押せない問題

## ステータス
✅ 完了

## 優先度
**Critical**

## デプロイブロッカー
Yes

## カテゴリ
Bug / CSS / Overlay

---

## 概要

home 画面で SPIN ボタンが初回押せず、数秒後に押せるようになる不具合が発生していた。

---

## 背景

- SPIN は主導線。阻害されると「壊れている」と認識される
- 初回ロード直後の UX を直撃するため離脱リスクが高い
- UI 上はボタンが見えており `disabled` でもないため原因が分かりにくい

---

## 問題点

- ボタンを押しても反応しない（UI 上は押せそうに見える）
- 数秒経つと突然押せるようになる
- console error なし
- `disabled` 属性は付いていない

---

## 原因

**カテゴリ C: overlay / CSS 問題**

`components/roulette-wheel.tsx` の ambient glow `motion.div` に `pointer-events: none` が設定されておらず、SPIN ボタンへのクリックを奪っていた。

### 詳細

```tsx
// 問題のあったコード
<motion.div
  className="absolute inset-[-25%] rounded-full"
  style={{ filter: 'blur(40px)', ... }}
/>
```

#### ジオメトリ計算

| 項目 | 値 |
|------|-----|
| ホイールサイズ | 280px × 280px |
| `inset-[-25%]` の結果 | 420px × 420px（-70px からはみ出し） |
| glow 下端（ホイール上端から） | 280 + 70 = **350px** |
| SPIN ボタン上端（ホイール上端から） | 280 + 24(mb-6) = **304px** |
| 重複範囲 | **46px**（ボタン高さ 64px の上部 72%） |

#### 重複幅の計算（y = 304, ボタン上端）

glow は `rounded-full` により円形。ホイール中心 y = 140px、半径 210px として：

```
横幅 = sqrt(210² - (304-140)²) = sqrt(44100 - 26896) ≈ 131px（左右それぞれ）
カバー範囲: ボタン中心から ±131px（280px 幅のうち 262px が glow の内側）
```

**SPIN ボタンの中央付近（最も自然にタップされる位置）が glow に覆われていた。**

#### 「数秒後に押せる」理由

ユーザーが中央付近を数回タップ（→ glow が奪う）した後、下端付近を偶然タップすると押せる。
または GroupList が読み込まれた後のレイアウト変動でボタン押下可能な場所が生まれる。

---

## 修正方針

- `pointer-events: none` を ambient glow に追加するだけの最小差分修正
- 視覚的な変化なし
- 他機能への影響なし

---

## 実装内容

**修正ファイル**: `components/roulette-wheel.tsx`

```tsx
// 修正前
<motion.div
  className="absolute inset-[-25%] rounded-full"
  style={{ filter: 'blur(40px)', ... }}
/>

// 修正後
<motion.div
  className="absolute inset-[-25%] rounded-full pointer-events-none"
  style={{ filter: 'blur(40px)', ... }}
/>
```

変更は `pointer-events-none` クラスの追加のみ（1箇所）。

---

## 調査で確認した他の候補（除外済み）

| 候補 | 結論 |
|------|------|
| `disabled` 条件の設計ミス | `isSpinning \|\| participants.length < 2 \|\| countdown !== null` — 初期値はすべて false/null。無関係 |
| CountdownOverlay | `countdown === null` 時は何もレンダリングしない。無関係 |
| WinnerCard | `winner === null` の間はレンダリングしない。無関係 |
| Confetti | `pointer-events-none` 済み。無関係 |
| useGroups の isLoaded | SPIN ボタンの `disabled` 条件に含まれない。無関係 |
| RecordingCanvas | `position: fixed; left: -10000px; pointer-events: none`。無関係 |
| outer decorative ring (`inset-[-5px]`) | 5px はみ出しのみ。mb-6=24px の内側。無関係 |

---

## 影響範囲

- `components/roulette-wheel.tsx` のみ
- 視覚的変化なし（glow は `filter: blur(40px)` で視認不可能な要素）
- ホイールの回転・アニメーション動作に影響なし

---

## 受け入れ条件

- [x] 初回表示直後に押せる
- [x] 数秒待ちが発生しない
- [x] UI と状態が一致している
- [x] console error が出ない
- [x] 他機能に影響なし

---

## 再発防止

装飾用 `absolute` 要素（glow、blur、overlay など）を追加する際は必ず `pointer-events-none` を付ける。
視覚的に透明でも DOM 要素はクリックを奪う。
