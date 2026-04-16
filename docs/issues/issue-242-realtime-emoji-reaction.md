# ISSUE-242: 感情(P1) — 当選発表時のリアルタイム絵文字リアクション

## ステータス
🔲 TODO

## 優先度
**P1 / High**

## カテゴリ
感情設計 / Realtime / Winner Reveal / Multiplayer

## 対象スコア
感情: +0.5 / Kano-魅力品質: +0.3 → 総合 +0.5点

---

## Summary

当選者が発表された瞬間、ルームに参加している全員がスマホで絵文字リアクションを送れるようにする。
「さくらさん 👏👏👏」「ごちそうさま！🍺」などの反応が全員の画面に降ってくることで、
物理的に同じ場にいる飲み会の盛り上がりをデジタルで増幅できる。
感情スコア 19.5/20 → 20/20 の最後の 0.5 点を埋める。

---

## Background

2026-04-16 統合評価（感情 19.5/20）で残存ギャップとして検出。
「会場全員が同時に声を上げる」体験の最終 0.5 点。
ISSUE-213（絵文字リアクション）として過去に設計されたが未実装。
Supabase Realtime Broadcast が既にルーム同期（ISSUE-221）で使用されており、
同じチャンネルに reaction イベントを流すだけで実装できる。

---

## Expected Behavior

### ルームプレイ画面（`/room/[code]/play`）

当選者発表後（Phase A 表示中）、画面下部にリアクションボタンが出現：

```
┌──────────────────────────────────┐
│       🎉 さくらさんが奢ります！   │
│                                  │
│  [👏] [🍺] [😂] [🎉] [😭]       │
│   ↑ タップで全員の画面に降ってくる │
└──────────────────────────────────┘
```

ボタンをタップすると、全参加者の画面に絵文字が 2〜3秒間フロート表示される。

---

## Scope

- `app/room/[code]/play/_components/` — リアクションボタン UI 追加
- `app/room/[code]/play/use-room-sync.ts` — Broadcast で reaction イベントを送受信
- `components/emoji-rain.tsx` — 新規コンポーネント（絵文字が上から降るアニメーション）

---

## 実装方針

### Broadcast 送信

```typescript
// use-room-sync.ts のチャンネルに追加
channel.on('broadcast', { event: 'emoji_reaction' }, ({ payload }) => {
  triggerEmojiRain(payload.emoji)  // 全員の画面で発火
})

// リアクションボタン押下時
channel.send({
  type: 'broadcast',
  event: 'emoji_reaction',
  payload: { emoji: '👏', senderName: currentUser.name }
})
```

### EmojiRain コンポーネント

```tsx
// components/emoji-rain.tsx
// 絵文字が画面上部からランダム位置に降ってくる CSS animation
// PrismBurst と同様に createPortal で z-index 高めに表示
```

### リアクション絵文字候補

```
👏  🍺  🎉  😂  😭  🙏  💸  👑
```

---

## Acceptance Criteria

- [ ] 当選発表後（Winner 確定時）、リアクションボタンが参加者全員の画面に表示される
- [ ] ボタンをタップすると、全員の画面で絵文字が 2〜3秒間降ってくる
- [ ] ネットワーク遅延 < 200ms で全員に届く（Broadcast 利用）
- [ ] 参加者が1人の場合はリアクションボタンが表示されない
- [ ] ゲストルームでも動作する
- [ ] モバイル 375px で絵文字が画面に収まる

## Priority
**P1**

## Impact
感情 19.5 → 20.0 / Kano-魅力品質 +0.3 → 総合 +0.5点

## Risk / Notes
- ホームモード（`/home` ソロプレイ）にはリアクション機能は不要（相手がいない）
- Supabase Broadcast は既に ISSUE-221 で利用実績あり → 新規チャンネル作成不要
- スパム対策: 1人あたり連続タップは 1秒に1回まで（クライアント側 throttle）
- 絵文字の同時多発で重くなる場合は requestAnimationFrame でバッチ処理
