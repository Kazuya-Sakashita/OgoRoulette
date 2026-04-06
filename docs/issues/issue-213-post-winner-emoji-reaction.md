# ISSUE-213: 感情スコア向上 — 当選発表後の全員参加型絵文字リアクション

## ステータス
📋 未着手

## 優先度
**High** — 感情スコアが閾値 15/20 に届いた後の次フェーズ。「一体感の祝祭化」

## カテゴリ
UX / Emotion / Multiplayer / Kano

## 対象スコア
感情: +2（15.5→17.5） / Kano魅力品質: +1 / HEART-Engagement: +1 / HEART-Happiness: +0.5

---

## 背景

ISSUE-207（停止演出）・ISSUE-212（入場演出）で感情スコアが 14→15.5 まで改善見込み。
しかし「当選発表後」のシーンがまだ一方通行だ。

現在の当選発表フロー：
```
ルーレット停止 → WinnerCard 表示（ホスト端末のみ） → 「閉じる」
```

当選者を見た瞬間の「ええー！笑」「かわいそう！」「やった逃げた！」という感情が、
参加者の端末でリアルタイムに表現できない。
飲み会の盛り上がりが端末の中に閉じ込められている。

---

## 問題

### ① 他の参加者が当選発表に参加できない

WinnerCard はホストの端末のみ。メンバーは結果を口頭で聞くか、
ホストの画面を覗き込む必要がある。

### ② 「勝者への祝福/哀悼」が記録されない

「今日の名シーン：田中さん4回目の当選」という記憶になるには、
その瞬間の全員のリアクションが必要。絵文字は記憶を刻む。

### ③ リシェア動機が弱い

「この盛り上がりを見て！」という動画になる要素がない。
全員のリアクション絵文字がふわふわ浮かぶシーンは SNS 映えする。

---

## 改善内容

### Step 1: WinnerCard を全員に表示

```tsx
// Supabase Realtime でホストが当選者を broadcast
// members も "winner_revealed" イベントを受信して WinnerCard 相当の画面を表示
const [showWinnerReveal, setShowWinnerReveal] = useState(false)

channel.on('broadcast', { event: 'winner_revealed' }, ({ payload }) => {
  setWinner(payload.winner)
  setShowWinnerReveal(true)
})
```

### Step 2: 絵文字リアクションパレット

```tsx
// WinnerCard 最下部 or オーバーレイに絵文字パレット
const REACTIONS = ['😂', '🎉', '😭', '👏', '🔥', '💸', '😤', '🫡']

const ReactionPanel = ({ onReact }: { onReact: (emoji: string) => void }) => (
  <div className="flex gap-3 justify-center flex-wrap mt-4">
    {REACTIONS.map(emoji => (
      <motion.button
        key={emoji}
        whileTap={{ scale: 1.5 }}
        className="text-2xl p-2 rounded-full hover:bg-white/10 transition"
        onClick={() => onReact(emoji)}
      >
        {emoji}
      </motion.button>
    ))}
  </div>
)
```

### Step 3: リアクション絵文字をフローティング表示

```tsx
// 他のメンバーがリアクションを送信すると、画面上を絵文字がふわっと浮かぶ
const FloatingEmoji = ({ emoji, x }: { emoji: string; x: number }) => (
  <motion.div
    className="fixed text-3xl pointer-events-none z-50"
    style={{ left: `${x}%`, bottom: '20%' }}
    initial={{ opacity: 1, y: 0, scale: 1 }}
    animate={{ opacity: 0, y: -200, scale: 1.5 }}
    transition={{ duration: 2, ease: 'easeOut' }}
  >
    {emoji}
  </motion.div>
)

// Supabase Realtime で broadcast
channel.on('broadcast', { event: 'reaction' }, ({ payload }) => {
  addFloatingEmoji(payload.emoji, Math.random() * 80 + 10)
})
```

### Step 4: リアクション集計をスピン履歴に記録

```
スピン履歴: 「田中さん 😂×3 🎉×2 💸×1」
```

---

## 影響ファイル

- `app/room/[code]/play/page.tsx` — winner_revealed broadcast + WinnerCard 全員表示
- `components/winner-card.tsx` — ReactionPanel 追加
- `components/room/floating-emoji.tsx`（新規）
- `lib/realtime.ts` — reaction イベント型定義追加

---

## 完了条件

- [ ] ホスト以外のメンバーも当選発表時に WinnerCard 相当の画面が表示される
- [ ] WinnerCard に絵文字パレット（8種）が表示される
- [ ] タップした絵文字が全員の画面にフローティング表示される（2秒で消える）
- [ ] Realtime latency < 500ms（日本国内）
- [ ] 5人テスト：「😂」が流れた時に笑い声が生まれることを確認

## 期待スコア上昇

感情: +2（15.5→17.5） / Kano魅力品質: +1 / HEART-Engagement: +1
→ 総合: +3点
