# [ISSUE-008] WinnerCard を閉じなければ SPIN を再押しできないことが伝わらない

## 🧩 概要

スピン完了後、`phase = "result"` になり SPIN ボタンは disabled になる。しかし SPIN ボタンは画面上に `opacity-50` で表示されたまま、クリックが無効の状態が続く。「もう一回！」ボタンは WinnerCard の Phase B（details シート）の下部にしかなく、Phase A（フルスクリーン演出）の間は再スピン手段が見つからない。ユーザーは「ボタンが壊れている」と誤解する可能性がある。

## 🚨 背景 / なぜ問題か

**フロー上の問題:**

1. アニメーション完了 → `handleSpinComplete` → `phase = "result"`
2. SPIN ボタンが `opacity-50` で無効化（ただし表示はされている）
3. WinnerCard Phase A（フルスクリーン演出）が表示される（z-50）
4. Phase A は 4 秒後に Phase B へ自動遷移（または画面タップで遷移）
5. Phase B のスクロール最下部に「もう一回！」ボタンがある

**問題点:**
- Phase A の間（4秒）、再スピンの手段が完全に隠れている
- `disabled:opacity-50 disabled:cursor-not-allowed` のみで「なぜ押せないか」の説明がない
- SPIN ボタンが画面に見えているのにクリックできないため、「壊れた」と感じるユーザーがいる
- Phase B での「もう一回！」は画面下部にありスクロールが必要な場合がある

## 🎯 目的

SPIN ボタンが押せない理由を明示し、再スピンへの導線を分かりやすくする。

## 🔍 影響範囲

- **対象機能:** スピン完了後の再スピンフロー
- **対象画面:** `/room/[code]/play`
- **対象コンポーネント:**
  - `app/room/[code]/play/page.tsx`（SPIN ボタン部分）
  - `components/winner-card.tsx`（Phase A・Phase B）

## 🛠 修正方針

**修正1: SPIN ボタンに disabled 理由のヒントを追加**

`phase === "result"` のとき、ボタン下部に小さいテキストを追加:

```tsx
{/* SPIN ボタン直下 */}
{phase === "result" && (
  <p className="text-xs text-muted-foreground text-center mt-2 animate-pulse">
    結果を確認してから再スピンできます
  </p>
)}
```

**修正2: WinnerCard Phase A に「タップで結果 → 再スピンへ」ヒントを改善**

現状の Phase A 下部の「タップして内訳を確認 →」テキストを「タップで確認・再スピン →」に変更。また、Phase A の段階でも「閉じる（✕）」ボタンを右上に表示し、`onClose` を呼べるようにする。

**修正3: Phase B の「もう一回！」ボタンを常に見える位置に固定**

Phase B の `bottom sheet` 内で「もう一回！」ボタンを固定フッターに配置する（スクロールに関わらず常に表示）。

```tsx
{/* Phase B: 固定フッター */}
{isOwner && onRespin && (
  <div className="sticky bottom-0 pt-4 pb-safe bg-gradient-to-t from-[#0B1B2B] to-transparent">
    <Button onClick={onRespin} className="w-full h-12 ...">
      <RotateCcw className="w-4 h-4 mr-2" />
      もう一回！
    </Button>
  </div>
)}
```

## ⚠️ リスク / 副作用

- Phase A にクローズボタンを追加すると、演出のフルスクリーン感が少し損なわれる。デザイン調整が必要
- `sticky bottom-0` のスタイルは `overflow-y-auto` コンテナ内で正しく動作するか確認が必要

## ✅ 確認項目

- [ ] `phase === "result"` のとき SPIN ボタン下に説明テキストが表示される
- [ ] WinnerCard Phase A に「閉じる」ボタンが表示され、タップで `onClose` が呼ばれる
- [ ] Phase B の「もう一回！」ボタンがスクロール不要で見える位置にある
- [ ] `isOwner = false`（メンバー）の場合「もう一回！」が表示されない

## 🧪 テスト観点

**手動確認:**
1. スピン完了 → Phase A が表示 → 閉じるボタン（✕）をタップ → WinnerCard が消えて SPIN が有効化される
2. Phase A → Phase B 遷移後 → 「もう一回！」がスクロールなしで見える
3. メンバー側で「もう一回！」が表示されないことを確認

## 📌 受け入れ条件（Acceptance Criteria）

- [ ] `phase === "result"` のとき SPIN ボタンが押せない理由が表示される
- [ ] WinnerCard の任意のフェーズから「閉じる」または「もう一回！」にアクセスできる
- [ ] Phase B の「もう一回！」が初期表示でスクロール不要の位置にある

## 🏷 優先度

**High**

## 📅 実装順序

**8番目**

## 🔗 関連Issue

- [ISSUE-001] isOwner フリッカー（SPIN ボタンが disabled になる別原因）
