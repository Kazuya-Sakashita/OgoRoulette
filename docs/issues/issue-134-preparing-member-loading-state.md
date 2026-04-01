# ISSUE-134: preparingフェーズでspinStartedAt待ち中の表示を改善する

## 概要

メンバーが preparing phase に入った直後、`spinStartedAtMs` がポーリング待ちの間（最大5秒）に
カウントダウンが表示されず「スピン中！」表示になっていた問題を改善する。

---

## 背景

- オーナーはAPI応答と同時に `spinStartedAtMs` を取得するためカウントダウンがすぐ表示される
- メンバーは次のポーリング（最大5秒）まで `spinStartedAtMs` が null のまま
- その間 `countdownValue === null` のため CountdownOverlay に何も表示されない
- メンバー待機表示は「スピン中！」になるが、実際はまだスピンが始まっていない

---

## 修正内容

### `app/room/[code]/play/page.tsx`

```tsx
{/* preparingフェーズでspinStartedAt待ち中は「ホストが準備中...」を表示 */}
<p className="text-sm font-semibold text-primary">
  {phase === "preparing" && countdownValue === null
    ? "ホストが準備中..."
    : "スピン中！"}
</p>
```

---

## ステータス

✅ 完了（commit: 0830173）
