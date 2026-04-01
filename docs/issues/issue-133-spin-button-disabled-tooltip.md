# ISSUE-133: SPINボタン無効時に理由をツールチップで表示する

## 概要

参加者が2人未満でSPINボタンがdisabledの際、理由を伝えるUIを追加する。

---

## 背景

- `app/room/[code]/play/page.tsx:1064` でボタンが `disabled` になるが説明がない
- ISSUE-011で既に実装済み（line 1175〜1180）:
  ```tsx
  {isOwner && (phase === "result" || (phase === "waiting" && participants.length < 2)) && (
    <p className="text-xs text-muted-foreground text-center mt-2">
      {phase === "result"
        ? "結果カードを閉じると再スピンできます"
        : "参加者を2人以上追加してください"}
    </p>
  )}
  ```
- これにより既にツールチップ相当のヒントテキストが表示されている

---

## ステータス

✅ ISSUE-011で実装済み — 追加対応不要
