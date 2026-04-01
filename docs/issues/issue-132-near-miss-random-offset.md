# ISSUE-132: near-missセグメントのオフセットをランダム化する

## 概要

`components/roulette-wheel.tsx` のnear-miss演出で、本当の当選者の「1〜3つ前」のセグメントをランダムに選ぶよう変更する。毎回1つ前に固定されていたため、数回使うと予測可能になっていた。

---

## 背景

- ISSUE-098でnear-miss演出を実装
- `(resolvedIdx - 1)` 固定のため、ユーザーが「1つ前が光ったら次が当選者」と覚えてしまう
- ランダム化により毎回「どこが光るか」の緊張感が継続する

---

## 修正内容

### `components/roulette-wheel.tsx`

```ts
// Before
const neighborIdx = (resolvedIdx - 1 + snapshotParticipants.length) % snapshotParticipants.length

// After
const nearMissOffset = 1 + Math.floor(Math.random() * 3)  // 1, 2, 3のどれか
const neighborIdx = (resolvedIdx - nearMissOffset + snapshotParticipants.length) % snapshotParticipants.length
```

---

## ステータス

✅ 完了（commit: 0830173）
