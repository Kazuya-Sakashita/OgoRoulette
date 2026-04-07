# ISSUE-228: UX改善(P1) — スピン結果後のリエンゲージメントCTA強化

## ステータス
📋 未着手

## 優先度
**P1 / High** — AARRR-Retention が最大のボトルネック。結果後に「また使おう」の動線がない

## カテゴリ
UX / Retention / CTA / Re-engagement

## 対象スコア
HEART-Retention: +1 / AARRR-Retention: +1 / G-STACK-Goal: +0.5 → 総合 +2点

---

## Summary

飲み会でルーレットを使った後、ユーザーはアプリを閉じる。
WinnerCard の結果表示後に「グループを保存してまた使う」という具体的な導線がなく、
次回の飲み会でもう一度使おうとなったときに「あのアプリ何だっけ？」となってしまう。
リテンションの最大のボトルネック。

---

## Background

### 現状のスピン後フロー

```
スピン → WinnerCard 結果表示 → 「もう一回」or 「ホームへ」
```

- WinnerCard には「グループを保存」ボタンが存在するが、Phase B 以降に埋もれている
- 「保存すると何が便利か」が伝わらない（「次回すぐ使える」というコンテキストなし）
- 結果を見た後のメンバーにも「このアプリを保存して次も使って」という動線がない

### /history ページの現状

- ゲストユーザーには「ルーレットを回すとここに履歴が表示されます」のみ
- ログインインセンティブとして「クラウド保存」を訴求するが、価値訴求が弱い
- 「次の飲み会で同じメンバーをすぐ呼び出せる」という具体的ユースケースがない

### なぜ今重要か

OgoRoulette は飲み会という「一時的な場」向けのツール。
毎週/毎月開催される飲み会グループに「また次回も使う」と思わせることが
AARRR の Retention を上げる唯一の手段。

---

## Current Behavior

1. スピン完了 → WinnerCard 表示
2. Phase B でグループ保存ボタンが表示されるが、他の要素と同格
3. 閉じると play ページに戻る
4. 「ホームへ戻る」ボタンのみ

---

## Expected Behavior

### A. WinnerCard Phase B 後のリエンゲージCTA

結果確認後（Phase B 移行後）に、以下を強調表示:

```
✅ 今日の奢りが決定！

╔═══════════════════════════════════╗
║  🔖 このメンバーを保存する         ║
║  次回の飲み会ですぐ呼び出せます     ║
╚═══════════════════════════════════╝

  ↑ グループ未保存の場合のみ表示
```

### B. メンバー向けシェア訴求

結果カードの下部に:

```
📱 友達に共有して盛り上がろう
  → シェアボタン（既存）
  → 「OgoRouletteを試す」CTA（非メンバーへ）
```

### C. /history ページ改善

空状態のメッセージを変更:

```
現在: 「ルーレットを回すとここに履歴が表示されます」

変更後:
🎯 次の飲み会もルーレットで決めよう！
グループを保存すると、毎回名前を入力せずにすぐ回せます。
[ルームを作る] ボタン
```

---

## Scope

- `app/room/[code]/play/_components/room-play-overlays.tsx` — WinnerCard Phase B 後のリエンゲージCTA追加
- `app/history/page.tsx` — 空状態メッセージとグループ保存訴求CTA改善
- `components/winner-card.tsx`（参照）— Phase B の表示タイミング確認

---

## Root Cause Hypothesis

アプリ設計が「使う瞬間」に最適化されており、「また使う動機づけ」が後回しになった。
グループ保存機能(ISSUE-210)は実装済みだが、最も効果的なタイミング（スピン直後）での訴求が弱い。

---

## Proposed Fix

### room-play-overlays.tsx（WinnerCard 後の追加UI）

```tsx
// Phase B 移行後（isDetailsPhase = true）、かつグループ未保存時
{isDetailsPhase && !isCurrentGroupSaved && participants.length >= 2 && (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 1.5 }}
    className="mt-4 p-4 rounded-2xl bg-primary/10 border border-primary/20"
  >
    <p className="text-xs text-muted-foreground mb-2">次の飲み会でもすぐ使う</p>
    <button
      onClick={() => { /* handleSaveGroup */ }}
      className="w-full h-10 rounded-xl bg-gradient-accent text-white text-sm font-bold"
    >
      🔖 このメンバーを保存する
    </button>
  </motion.div>
)}
```

---

## Acceptance Criteria

- [ ] WinnerCard Phase B 後に「グループを保存する」CTAが表示される（未保存時のみ）
- [ ] CTAに「次回すぐ使える」という具体的メリットが記載されている
- [ ] グループ保存済みの場合はCTAが表示されない
- [ ] /history の空状態にグループ保存の価値訴求が含まれる
- [ ] 既存のグループ保存ロジックに変更なし

## Priority
**P1**

## Impact
HEART-Retention +1、AARRR-Retention +1、G-STACK-Goal +0.5 → 総合 +2点

## Risk / Notes
- WinnerCard の Phase B タイミングは `handleDetailsPhase` callback で検知可能
- `isCurrentGroupSaved` は page.tsx で既に計算済み
- グループ保存ボタンがすでに WinnerCard 内にある場合、重複に注意
- モバイルでは画面が狭いためCTAの配置に注意
