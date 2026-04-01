# ISSUE-120: 参加者向け「ホスト待ち」メッセージをロビーに追加する

## 概要

ゲストユーザーがルーム参加後のロビー（waiting room）で何も案内がなく、
次に何が起きるか分からない問題を解消する。
ホストがゲームを開始するまでの待機状態を明示するUIを追加する。

---

## 背景

- ゲスト参加者はルームに入ると「ルーム画面」が表示されるが、次のアクションが不明
- ホストがSPINボタンを押すまで何も起きないが、その旨が伝わっていない
- 「壊れている？」と思って離脱するユーザーがいる可能性

---

## 修正内容

### `app/room/[code]/page.tsx`

`!isOwner && room.status === "WAITING"` の条件で以下のバナーを表示:

```tsx
<div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/50 border border-white/10 text-sm text-muted-foreground">
  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
  ホストがゲームを開始するのを待っています
</div>
```

- `animate-pulse` のドットインジケーターでアクティブな待機状態を表現
- ホスト（`isOwner === true`）には表示しない
- `status === "WAITING"` のみに限定（ゲーム中・終了後は非表示）

---

## 影響範囲

- `app/room/[code]/page.tsx`
- ゲスト参加者の離脱率改善
- 待機状態の明示化

---

## ステータス

✅ 完了（commit: 35790a1）
