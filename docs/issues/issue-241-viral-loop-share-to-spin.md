# ISSUE-241: G-STACK(P1) — バイラルループ：シェアから新規ユーザーが即スピンできる動線

## ステータス
🔲 TODO

## 優先度
**P1 / High**

## カテゴリ
Viral / Growth / G-STACK / AARRR-Referral

## 対象スコア
G-STACK: +1.5 / AARRR-Referral: +0.5 → 総合 +2点

---

## Summary

現状、X/LINE でシェアされたリンクを踏んだ新規ユーザーは `/result` か `/` に到達するが、
「そのまま自分もルーレットを試せる」動線がない。
シェアリンクから `/home?ref=share&winner={name}` に誘導し、
「{name}さんが奢りに決定！あなたも試してみる？」→ 即スピンできる体験を作ることで、
シェア1件が新規ユーザーの獲得に直結するバイラルループを完成させる。

---

## Background

2026-04-16 統合評価（G-STACK 13/15）で残存ギャップとして検出。
G-STACK -2 の主因は「バイラルループの欠如」。
シェア機能（X/LINE/Web Share API）は実装済みだが、流入後の体験設計がない。
AARRR-Referral は現状 4/5 → 動線を完成させれば 5/5 に到達できる。

---

## Current Behavior

1. ユーザーが X に「さくらさんが奢りに決定！ #OgoRoulette」を投稿
2. 友人がリンクをタップ → `/` (Welcome ページ) または `/result` に到達
3. ログインかゲスト選択のみ表示され、「自分も試せる」導線がない
4. 離脱率が高い

---

## Expected Behavior

```
シェアリンク: https://ogo-roulette.vercel.app/home?ref=share&winner=さくら

↓ タップ

/home?ref=share&winner=さくら に到達

[バナー表示]
┌──────────────────────────────────────┐
│  🎉 さくらさんが奢りに決定！         │
│  あなたのグループでも試してみる？     │
│  [今すぐスピン]  ← 大きなCTA        │
└──────────────────────────────────────┘

→ バナーを閉じると通常の /home と同じ
→ ゲストモードで即スピン可能
```

---

## Scope

- `app/home/page.tsx` — URL パラメータ `ref=share` / `winner` を読み取りバナー表示
- `lib/share-service.ts` — シェアURLに `ref=share&winner={name}` を付与（既存 `buildShareUrl` を拡張）
- `lib/analytics.ts` — `SHARE_JOIN_CLICK` / `SHARE_JOIN_COMPLETE` は既存。バナー表示イベントを追加

---

## 実装方針

```tsx
// app/home/page.tsx — useEffect でURLパラメータ確認
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const ref = params.get('ref')
  const winner = params.get('winner')
  if (ref === 'share' && winner) {
    setShareRefBanner({ winner: decodeURIComponent(winner) })
    trackEvent(AnalyticsEvent.SHARE_JOIN_CLICK, { winner })
  }
}, [])

// lib/share-service.ts — buildShareUrl に ref=share を追加
const url = new URL(`${baseUrl}/home`)
url.searchParams.set('ref', 'share')
url.searchParams.set('winner', encodeURIComponent(payload.winner))
```

---

## Acceptance Criteria

- [ ] `?ref=share&winner={name}` 付き URL で `/home` を開くと、バナーが表示される
- [ ] バナーから即スピンできる（ゲストモード）
- [ ] バナーを閉じると通常の `/home` として機能する
- [ ] シェアURL（X/LINE/Web Share）に `ref=share&winner=` が含まれる
- [ ] `SHARE_JOIN_CLICK` イベントが Analytics に送信される
- [ ] モバイル 375px でバナーが崩れない

## Priority
**P1**

## Impact
G-STACK +1.5（バイラルループ完成でブランド強度が上がる）
AARRR-Referral +0.5 → 総合 +2点

## Risk / Notes
- `winner` パラメータは表示のみに使用。URLから当選者を操作することはできない（サーバー側抽選は変わらない）
- `decodeURIComponent` を必ず通す（日本語名のエンコード対応）
- 既存の `SHARE_JOIN_CLICK` / `SHARE_JOIN_COMPLETE` イベント（ISSUE-187）と整合させる
