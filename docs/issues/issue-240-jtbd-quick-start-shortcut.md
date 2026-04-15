# ISSUE-240: JTBD(P2) — 「このメンバーで即スタート」ショートカット

## ステータス
🔲 TODO

## 優先度
**P2 / Medium**

## カテゴリ
UX / JTBD / Onboarding / Group Management

## 対象スコア
JTBD-セットアップ速度: +5 / AARRR-Activation: +0.3 → 総合 +0.3点

---

## Summary

JTBD 評価でセットアップ速度が OgoRoulette の唯一の劣後点と判明  
（OgoRoulette: ★★★ vs じゃんけん: ★★★★★）。  
保存済みグループを「1タップ即スタート」できるショートカットボタンを追加することで、  
「グループを選んで SPIN まで3タップ以上」を「2タップ」に短縮する。

---

## Background

2026-04-16 JTBD 評価で確認。グループ保存機能（ISSUE-175/182 等）は実装済みだが、  
現状フロー:
1. `/home` を開く（1タップ）
2. 「いつものメンバー」セクションを展開（1タップ）
3. グループを選択（1タップ）
4. SPIN（1タップ）→ **計4タップ**

期待フロー:
1. `/home` を開く（1タップ）
2. 直前に使ったグループのショートカットが即見える
3. SPIN（1タップ）→ **計2タップ**

---

## Expected Behavior

### ホーム画面の変更

グループが保存済みの場合、SPIN ボタン上部に「クイックスタート」バナーを表示：

```
┌──────────────────────────────────────┐
│  ⚡ 先週の飲み会メンバーで始める      │
│  さくら・たろう・はな・けんた (4人)   │
│              [ すぐスタート ]         │
└──────────────────────────────────────┘
```

「すぐスタート」押下 → 該当グループのメンバーを即ロードして SPIN 可能状態にする。

---

## Scope

- `app/home/page.tsx` — 最後に使用したグループ or `ogoroulette_last_members` を元に表示
- ISSUE-237（前回メンバー復元）と組み合わせると効果大

---

## 実装方針

```tsx
// 最後に使ったグループを特定
const lastUsedGroup = savedGroups.find(g =>
  g.id === localStorage.getItem('ogoroulette_last_group_id')
)

// クイックスタートバナーを表示（グループ保存済み or 前回メンバーあり）
{lastUsedGroup && !isSpinning && !winner && (
  <div className="mb-3 p-3 rounded-2xl border border-white/10 bg-white/5">
    <p className="text-xs text-white/50 mb-1">⚡ 前回のグループ</p>
    <p className="text-sm font-bold text-white mb-2">{lastUsedGroup.name}</p>
    <p className="text-xs text-white/40 mb-2">
      {lastUsedGroup.participants.slice(0,4).join('・')}
      {lastUsedGroup.participants.length > 4 && ` 他${lastUsedGroup.participants.length - 4}人`}
    </p>
    <button
      onClick={() => handleSelectGroup(lastUsedGroup.id)}
      className="w-full py-2 rounded-xl bg-primary/20 text-primary text-sm font-bold"
    >
      このメンバーで始める
    </button>
  </div>
)}
```

---

## Acceptance Criteria

- [ ] グループ保存済みユーザーに「前回のグループ」ショートカットが表示される
- [ ] 「このメンバーで始める」1タップでメンバーがロードされ SPIN 可能になる
- [ ] グループ未保存ユーザーにはバナーが表示されない
- [ ] ISSUE-237 の `last_members` と競合なし（保存グループ優先）
- [ ] モバイル 375px でレイアウト崩れなし
- [ ] ブラウザで目視確認してからコミット

## Priority
**P2**

## Impact
JTBD セットアップ速度: ★★★ → ★★★★ / AARRR-Activation +0.3 → 総合 +0.3点

## Risk / Notes
- ログイン済みユーザーのみグループ保存可能のため、ゲストにはデフォルト非表示
- ISSUE-237（前回メンバー localStorage 復元）と組み合わせることで、ゲストにも同等体験を提供できる
