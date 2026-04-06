# ISSUE-225: UX改善(P1) — メンバー待機中UX：受け身から能動的参加へ

## ステータス
📋 未着手

## 優先度
**P1 / High** — HEART-Engagement 6/10 のボトルネック。飲み会の場でメンバーが「何もできない」状態

## カテゴリ
UX / Engagement / Multiplayer / Emotion

## 対象スコア
HEART-Engagement: +1.5（6→7.5/10）/ HEART-Happiness: +0.5 / 感情: +0.5 → 総合 +2〜3点

---

## Summary

現在のメンバー（非オーナー）体験はルーレットが回るのを「待つだけ」。
絵文字リアクション機能（ISSUE-213）は実装済みだが視認性が低く、
メンバーが能動的に場に参加できていない。
飲み会の盛り上がりを全員で作るための仕組みが不足している。

---

## Background

### 現状のメンバー体験フロー

```
1. ルームに参加
2. 参加者リストに自分の名前が表示される
3. オーナーがSPINするのを待つ（"誰が奢る…？オーナーの回転を待っています"）
4. ルーレットが回るのを見る
5. 結果が表示される
```

**問題**: ステップ2〜4で「見る」以外の行動がない。
同席者と盛り上がる手段が画面上にない。

### 絵文字リアクションの現状（ISSUE-213実装済み）

- 絵文字パレットは実装されている
- しかし **画面上の視認性が低い**（どこにあるか気づかない）
- 送信してもフィードバックが自分にもあるが、他者への送信感が薄い
- スピン中にしか使えない（待機中は使えない）

### 退室ボタンの欠如

メンバーが誤って参加したり、別の予定ができたりした場合に
**ルームから離脱する手段がない**。
ブラウザのバックボタンかタブを閉じるしかなく、
参加者リストには名前が残り続ける（オーナーから見て混乱）。

---

## Current Behavior

1. メンバーがルームに参加 → 参加者リストに表示
2. "誰が奢る…？" の待機画面のみ
3. 絵文字リアクションボタンは小さく目立たない位置にある
4. スピン中しかリアクションできない
5. 退室手段なし

---

## Expected Behavior

### A. 待機中の絵文字リアクション

- スピン **前**（waiting 状態）からリアクション可能
- 「🔥」「😂」「😱」「👀」ボタンを目立つ位置（画面下部）に大きく表示
- 誰かがリアクションしたとき、画面中央からフローティング絵文字が上昇（既存アニメーション流用）
- 「全員で盛り上がる」感を演出

### B. 退室ボタン

- `/room/[code]/play` の非オーナー側に「ルームを離脱する」ボタンを追加
- 確認ダイアログ（「離脱すると参加者リストから削除されます」）
- API: `DELETE /api/rooms/[code]/members/me` または退室フラグ更新
- 退室後は `/home` にリダイレクト

### C. スピン中のカウントダウン共有（任意）

- オーナー側に内部的なカウントダウンがある
- メンバー側にも「あと3秒…2秒…1秒…」的な演出があるとドキドキ感が増す

---

## Scope

### 優先実装: B（退室ボタン）

影響範囲が小さく確実に UX 改善になる。

- `app/room/[code]/play/_components/spin-controls.tsx` — 非オーナー向けに退室ボタン追加
- `app/api/rooms/[code]/members/me/route.ts` — 新規: 自分の退室 API
- `app/room/[code]/play/page.tsx` — 退室後のリダイレクト処理

### 次優先: A（待機中リアクション）

- `app/room/[code]/play/_components/room-play-body.tsx` — waiting フェーズでのリアクションUI
- `app/room/[code]/play/_components/room-play-overlays.tsx` — `handleReact` を waiting フェーズにも対応

---

## Root Cause Hypothesis

メンバー体験は「サービスの受益者」として設計されており、「参加者」として設計されていない。
飲み会という文脈では、全員が演出に参加することが盛り上がりの本質。

---

## Proposed Fix

### 退室ボタン（spin-controls.tsx）

```tsx
// 非オーナー向け waiting 状態に追加
{!isOwner && phase === "waiting" && (
  <button
    onClick={handleLeaveRoom}
    className="text-xs text-muted-foreground underline mt-2"
  >
    ルームを離脱する
  </button>
)}
```

### 待機中リアクション（room-play-body.tsx）

```tsx
// waiting + spinning 両方でリアクションパレットを表示
{(phase === "waiting" || phase === "spinning") && !isOwner && (
  <div className="flex gap-3 justify-center mt-4">
    {["🔥", "😂", "😱", "👀"].map(emoji => (
      <button
        key={emoji}
        onClick={() => onReact(emoji)}
        className="text-2xl"
      >
        {emoji}
      </button>
    ))}
  </div>
)}
```

---

## Acceptance Criteria

- [ ] 非オーナーのメンバーが waiting 状態でリアクション絵文字を送れる
- [ ] 退室ボタンが非オーナーのwaiting/result状態で表示される
- [ ] 退室後に参加者リストから名前が削除される
- [ ] 退室後に `/home` にリダイレクトされる
- [ ] オーナー側の体験に変更なし

## Priority
**P1**

## Impact
HEART-Engagement +1.5、HEART-Happiness +0.5、感情スコア +0.5 → 総合 +2〜3点

## Risk / Notes
- 退室APIは「ルームからメンバーを削除する」の権限設計に注意（自分だけが自分を削除できる）
- メンバー退室後もオーナーはスピン可能であること（参加者数が2以上なら）
- 待機中リアクションは ISSUE-213 の `reactChannelRef` を活用する
- スピン中のカウントダウン共有は Phase C として別ISSUEに分離しても良い
