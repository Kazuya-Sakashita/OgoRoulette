# ISSUE-237: EEM(P1) — メンバー設定 Valley 解消：前回グループを起動時に即表示

## ステータス
🔲 TODO

## 優先度
**P1 / High**

## カテゴリ
UX / Onboarding / Emotional Experience / Retention

## 対象スコア
EEM-Valley: +8 / AARRR-Activation: +0.5 → 総合 +0.5点

---

## Summary

Emotional Experience Map の評価で、メンバー設定フェーズが唯一の「Valley（感情の谷）」として検出された。  
ルーレットを毎回使う飲み会ユーザーが、前回と同じメンバーを再入力する手間で離脱する。  
「前回のメンバー」または「最後に使ったグループ」を起動時に即表示することで、谷を埋める。

---

## Background

2026-04-16 統合評価（6軸+JTBD+EEM+NSM）で判明。  
EEM のメンバー設定フェーズ強度: 6/10（他フェーズは7〜10）。  
じゃんけんとの JTBD 比較でセットアップ速度が唯一の劣後点（OgoRoulette: ★★★ vs じゃんけん: ★★★★★）。

---

## Current Behavior

1. `/home` を開く
2. デフォルトメンバー「さくら・たろう・はな・けんた」が表示される
3. 実際のメンバー名を毎回入力し直す（グループ保存済みなら選択、未保存なら手入力）

---

## Expected Behavior

1. `/home` を開く
2. **前回使ったグループ or メンバー構成が自動的に復元されている**
3. 「このメンバーでスタート」→ 即 SPIN できる

### 実装方針

```tsx
// localStorage から前回のメンバー構成を復元
const LAST_MEMBERS_KEY = 'ogoroulette_last_members'

// スピン完了時に保存
localStorage.setItem(LAST_MEMBERS_KEY, JSON.stringify(participants))

// /home 初期化時に復元（デフォルトメンバーより優先）
const lastMembers = localStorage.getItem(LAST_MEMBERS_KEY)
if (lastMembers) {
  setParticipants(JSON.parse(lastMembers))
}
```

ゲストでも localStorage は使えるため、ログイン不要で動作する。

---

## Scope

- `app/home/page.tsx` — 初期化時に `ogoroulette_last_members` を読み込む
- `app/home/page.tsx` の `handleSpinComplete` — スピン完了時に現在のメンバーを保存

---

## Acceptance Criteria

- [ ] 2回目以降の `/home` 起動時、前回スピン時のメンバーが自動表示される
- [ ] 初回（`last_members` 未保存）はデフォルトメンバーが表示される
- [ ] メンバーを変更した後にスピンすると、次回はその変更後の構成が表示される
- [ ] グループ保存済みメンバーとの競合なし（グループ選択した場合はそちらを優先）
- [ ] モバイル・デスクトップ両方で動作

## Priority
**P1**

## Impact
EEM-Valley解消 +8pt / AARRR-Activation +0.5 → 総合 +0.5点  
JTBD セットアップ速度改善（★★★ → ★★★★）

## Risk / Notes
- ゲストが前回と異なるシーンで使う場合、不要なメンバーが残る → 削除は簡単なので許容範囲
- `ogoroulette_last_members` と `ogoroulette_local_history` は別キーで管理する
