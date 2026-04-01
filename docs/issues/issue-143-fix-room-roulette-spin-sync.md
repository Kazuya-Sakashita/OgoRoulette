# ISSUE-143: ルーム内オーナー・メンバー間のルーレット回転同期ズレを修正する

## 概要

ルームプレイ時、オーナーのルーレットが止まった後もメンバーのルーレットが回り続けるズレが発生していた。また、回転中の速度感がクライアント間で異なって見える問題もあった。

---

## 背景

- ルーム機能のコア体験はオーナー・メンバー全員が「同じ瞬間」に結果を見ること
- 数秒のズレは「誰が勝ったかわからない」「盛り上がりが壊れる」体験につながる
- サーバー側の `spinStartedAt` によるタイミング共有の仕組みはあったが、メンバー側の受信遅延が考慮されていなかった

---

## 原因

### 問題1（主因）: メンバーの遅延受信 → フル 4.5 秒アニメーション実行

**該当箇所:** `app/room/[code]/play/page.tsx`

- サーバーは `spinStartedAt = now + 3000ms` を設定
- オーナーは API レスポンスで即座に受け取り、3 秒後にアニメーション開始
- メンバーは 10 秒ポーリング or Supabase Realtime 依存 → 受信が `spinStartedAt` より後になることが多い
- `delay = Math.max(0, 負の値) = 0` となり、受信後即座にアニメーション開始
- **メンバーは受信時点から 4.5 秒フルアニメーション実行** → オーナーより数秒遅れて終了

タイムライン例:
- T+0: オーナーがスピン → `spinStartedAt = T+3000`
- T+3000: オーナーのアニメーション開始（4.5 秒）→ T+7500 に終了
- T+6000: メンバーがポーリングで受信（`spinStartedAt` は 3 秒前）
- T+6000: メンバーのアニメーション開始（4.5 秒）→ T+10500 に終了
- **ズレ: 3 秒**

### 問題2（副因）: `minSpins` がクライアントごとにランダム

**該当箇所:** `components/roulette-wheel.tsx:98`（修正前）

```typescript
const minSpins = 5 + Math.floor(Math.random() * 3) // 5 | 6 | 7
```

- オーナーが 5 回転、メンバーが 7 回転を選んだ場合、同じ 4.5 秒で異なる速度で回転
- 最終停止角度は同じだが、**回転中の視覚的な速度感が全く異なって見える**

---

## 修正内容

### `components/roulette-wheel.tsx`

**1. `spinElapsedMs` / `spinSeed` props を追加**

```typescript
interface RouletteWheelProps {
  /** ルーム同期: spinStartedAt から遅れてアニメーション開始した場合の経過 ms */
  spinElapsedMs?: number
  /** ルーム同期: minSpins 決定論化のための seed（spinStartedAt ms）。全クライアントで同値 */
  spinSeed?: number
}
```

**2. `minSpins` を決定論化（`spinSeed` 使用時）**

```typescript
const minSpins = spinSeedRef.current !== undefined
  ? 5 + (Math.floor(spinSeedRef.current / 1000) % 3)
  : 5 + Math.floor(Math.random() * 3)  // solo play はランダムのまま
```

**3. duration を経過時間に応じて短縮**

```typescript
const FULL_DURATION = 4.5
const elapsedSec = Math.max(0, (spinElapsedMsRef.current ?? 0) / 1000)
const duration = Math.max(0.5, FULL_DURATION - elapsedSec)
```

**4. `slowDownTimer` のタイミングを `duration` に合わせる**

```typescript
const slowDownTimer = setTimeout(() => { ... }, Math.max(0, (duration - 1.2) * 1000))
```

---

### `app/room/[code]/play/page.tsx`

**1. `spinElapsedMs` state を追加**

```typescript
const [spinElapsedMs, setSpinElapsedMs] = useState<number>(0)
```

**2. メンバーの `scheduleSpin` を修正**

アニメーション開始直前に `elapsed = Date.now() - spinStartedAt` を計算し:
- elapsed < 5000ms → `setSpinElapsedMs(elapsed)` → 短縮 duration でアニメーション開始
- elapsed ≥ 5000ms → アニメーションをスキップして直接 result 表示

```typescript
const TOTAL_ANIM_MS = 5000
setTimeout(() => {
  const elapsed = Math.max(0, Date.now() - startMs)
  if (elapsed >= TOTAL_ANIM_MS) {
    const winnerData = pendingMemberWinnerRef.current
    if (winnerData) {
      setWinner(winnerData)
      setPhase("result")
      spinScheduledRef.current = false
    }
    return
  }
  setSpinElapsedMs(elapsed)
  setPhase("spinning")
}, delay)
```

**3. オーナー `handleSpin` / `handleRespin` に `setSpinElapsedMs(0)` を追加**

**4. `RouletteWheel` に props を追加**

```tsx
<RouletteWheel
  spinElapsedMs={spinElapsedMs}
  spinSeed={spinStartedAtMs ?? undefined}
  // ...既存 props...
/>
```

---

## 受け入れ条件

- [x] オーナーとメンバーのルーレットがほぼ同時に（誤差 < 0.5s）止まる
- [x] 回転中の速度感がクライアント間で一致する（同じ minSpins）
- [x] メンバーが 5 秒以上遅れて受信した場合、アニメーションなしで直接結果表示される
- [x] solo play（ルームなし）の `minSpins` ランダム挙動は変わらない
- [x] TypeScript 型エラーなし

---

## ステータス

✅ 完了（commit: 未コミット）
