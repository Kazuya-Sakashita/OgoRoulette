# ISSUE-217: UX改善 — WinnerCard Phase A が自動で次画面に進まない

## ステータス
✅ 完了 — 2026-04-06

## 優先度
**High** — 参加者全員が「タップしないと詳細が見えない」状態。飲み会中の操作摩擦が大きい

## カテゴリ
UX / Animation / Multiplayer

## 対象スコア
HEART-Happiness: +1 / HEART-Task success: +0.5 / 感情: +0.5

---

## 背景

### 現象

WinnerCard が表示されたあと、Phase A（当選者発表シネマティック）から
Phase B（金額・シェア・リスピンの詳細）に **自動で遷移しない**。

ユーザーが画面をタップして初めて Phase B に進める。
飲み会中、スマホを置いたまま盛り上がっていると詳細が表示されない。

### 原因

ISSUE-193 の実装で「Phase A → Phase B の自動遷移タイマーを削除し、30秒フォールバックのみ残す」とした。

```typescript
// components/winner-card.tsx L145-146
// ISSUE-193: t6 auto-advance removed — user advances by tap (30s fallback below)
```

ISSUE-193 の意図は「シネマティック演出を邪魔しない」だったが、
30秒はユーザーにとって長すぎる。飲み会の文脈では 5〜8秒が適切。

---

## ユーザー体験の問題

| # | 問題 | 影響 |
|---|------|------|
| ① | 詳細（金額・リスピン）が自動で表示されない | 「どうすれば次に進むの？」と全員が迷う |
| ② | 30秒は長すぎる | 飲み会の空気が途切れる |
| ③ | タップが必要であることが分かりにくい | ヒント（`showHint`）が 1.8 秒後に表示されるが視認されにくい |

---

## 改善内容

### Option A（最小修正）: 自動遷移タイマーを 5〜8秒に短縮

```typescript
// components/winner-card.tsx

useEffect(() => {
  // Phase A を 7秒間楽しんだあと自動で Phase B へ
  const autoAdvance = setTimeout(() => {
    setPhase((prev) => (prev === "reveal" ? "details" : prev))
    onAdvanceToDetails?.()
  }, 7_000)  // 30_000 → 7_000

  return () => clearTimeout(autoAdvance)
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

**メリット:** 最小変更。演出を楽しむ時間（7秒）を確保しつつ自動で進む。  
**デメリット:** タップで即スキップしたいユーザーには問題ない（tap → 即遷移は維持）。

### Option B（本質改善）: 「タップで詳細へ」の視認性向上 + 短縮タイマー

```tsx
// Phase A の下部に「タップで詳細へ →」を pulse アニメーションで表示
{showHint && (
  <motion.div
    className="fixed bottom-10 left-0 right-0 flex justify-center pointer-events-none"
    animate={{ opacity: [0.5, 1, 0.5] }}
    transition={{ repeat: Infinity, duration: 1.5 }}
  >
    <span className="text-sm text-white/70 bg-black/30 px-4 py-2 rounded-full backdrop-blur-sm">
      タップで詳細を見る
    </span>
  </motion.div>
)}
```

---

## 推奨方針

**Option A + B の組み合わせ**：
- 自動遷移タイマー: 30秒 → **8秒**
- ヒントテキスト: 「下へスクロール」 → **「タップで詳細へ →」** に変更（視認性向上）

---

## 影響ファイル

- `components/winner-card.tsx` — 自動遷移タイマーを 30_000 → 8_000 に変更（L158）

---

## 完了条件

- [ ] WinnerCard Phase A が 8秒後に自動で Phase B に遷移する
- [ ] タップで即遷移が引き続き動作する
- [ ] メンバー（非オーナー）も同じ動作になる
- [ ] 5人テスト：「金額は？」「リスピンできる？」という声が 8秒以内に解消される

## 期待スコア

HEART-Happiness: +1 / HEART-Task success: +0.5 / 感情: +0.5 → 総合: +1〜2点
