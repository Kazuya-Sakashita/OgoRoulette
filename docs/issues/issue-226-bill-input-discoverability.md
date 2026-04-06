# ISSUE-226: UX改善(P1) — 請求額入力の視認性向上：折りたたみ解除と入力促進

## ステータス
✅ 完了 2026-04-07

## 優先度
**P1 / High** — OgoRoulette の差別化機能（金額計算）が使われていない可能性が高い

## カテゴリ
UX / Clarity / Discoverability / Feature Adoption

## 対象スコア
G-STACK-Clarity: +1 / G-STACK-Goal: +0.5 / HEART-Task success: +0.5 → 総合 +1点

---

## Summary

OgoRoulette の最大の差別化機能は「奢り金額の自動計算」だが、
`/room/[code]/play` の請求額入力セクションは折りたたまれた状態で表示され、
多くのユーザーがこの機能に気づかないまま使っている。
「金額を設定」ボタンが目立たず、展開しても何を入力すればよいか分かりにくい。

---

## Background

### 現状

`/room/[code]/play` ページの請求額入力:
- `BillInputSection` コンポーネントは折りたたまれた状態でレンダリング
- ボタンラベルは「💰 金額を設定」— クリックしても何が起きるか不明
- 展開後: 「合計金額」「奢り割合」の2入力フィールド
- 入力値がないとWinnerCardに金額が表示されない
- **ユーザーは金額機能の存在に気づかないままSPINしている可能性が高い**

### 問題の影響

- WinnerCard Phase B に「¥〇〇 → 1人あたり¥〇〇」が表示されない
- アプリの差別化機能が使われない = リテンション低下
- SNSシェア時の「金額付き結果」がないため、シェア価値も下がる

### デスクトップオーナー体験

オーナーはPCから操作することが多い。
PCでは画面が広いが、請求額入力セクションは `/home` と同様に折りたたみ優先設計のまま。

---

## Current Behavior

1. `/room/[code]/play` を開く
2. 「💰 金額を設定」ボタンが折りたたまれた状態
3. ボタンに気づかないまま SPIN
4. WinnerCard に金額が表示されない

---

## Expected Behavior

### A. 初回はデフォルト展開（またはアニメーション訴求）

- ルームに2人以上が参加した時点で、請求額入力セクションを自動展開（一度だけ）
- または「スピン前に金額を入力するとWinnerCardに表示されます」のツールチップを追加

### B. 入力フィールドのプレースホルダー改善

```
合計金額: ¥4,500（例: 飲み会代）
奢り割合: 100%（幹事が全額 or 20%ずつ）
```

### C. 「入力すると得られるもの」を示す

展開ボタンの近くに:
```
💰 金額を設定すると奢り金額が自動計算されます
```

---

## Scope

- `app/room/[code]/play/_components/bill-input-section.tsx` — プレースホルダー改善
- `app/room/[code]/play/_components/room-play-body.tsx` — 自動展開トリガー追加
- `app/room/[code]/play/_components/bill-input-section.tsx` — 説明テキスト追加

---

## Root Cause Hypothesis

請求額入力は後から追加された機能で、「邪魔にならないよう折りたたむ」という設計判断がなされた。
しかし飲み会では請求額入力こそが最重要情報であり、
「邪魔にならないよう隠す」ことで逆に重要機能が埋もれてしまっている。

---

## Proposed Fix

### 自動展開トリガー（room-play-body.tsx）

```tsx
// 参加者が2人以上になったら1度だけ金額入力セクションを展開
useEffect(() => {
  if (participants.length >= 2 && !hasAutoOpenedBill.current) {
    hasAutoOpenedBill.current = true
    setShowBillInput(true)  // 自動展開
  }
}, [participants.length])
```

### 展開ボタンの説明改善（bill-input-section.tsx）

```tsx
<button onClick={toggle}>
  💰 金額を設定
  {!isOpen && (
    <span className="text-xs text-muted-foreground ml-2">
      → WinnerCardに金額が表示されます
    </span>
  )}
</button>
```

---

## Acceptance Criteria

- [ ] 参加者が2人以上になったとき、金額入力セクションが自動で展開される（初回のみ）
- [ ] 展開ボタンに「WinnerCardに金額が表示されます」の説明が追加される
- [ ] プレースホルダーに具体的な例（¥4,500 など）が入る
- [ ] 手動で折りたたんだ場合は自動展開しない
- [ ] 既存の金額計算ロジックに変更なし

## Priority
**P1**

## Impact
G-STACK-Goal +0.5、G-STACK-Clarity +1、HEART-Task success +0.5 → 総合 +1点

## Risk / Notes
- 自動展開は `useRef` フラグで「1度だけ」制御すること（毎回展開はうるさい）
- モバイルでは展開により画面が押し下げられるため、スクロール量に注意
- `home/page.tsx` の同コンポーネントにも同様の改善を適用するか検討
