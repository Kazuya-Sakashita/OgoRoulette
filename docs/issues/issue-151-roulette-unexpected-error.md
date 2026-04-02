# ISSUE-151: ルーレット終了時に「予期しないエラーが発生しました」が表示される

## 概要

ルーレット終了後に `app/error.tsx`（React Error Boundary）が発動し、「予期しないエラーが発生しました」というフルページエラー画面が表示される。ルーレット結果が消え、UX が破壊される。

## 症状

- ルーレット終了後（`handleSpinComplete` 呼び出し後）にエラー画面が表示される
- 特にメンバー（参加者）側で発生しやすい
- 低速回線やポーリング遅延時に再現しやすい
- 成功しているにもかかわらずエラーが表示される場合がある

## ユーザー影響

- 盛り上がりが台無しになる
- アプリが壊れている印象を与える
- 信頼性が著しく低下する
- **デプロイブロッカー相当**

---

## 根本原因（3つ）

### ① エラー境界の粒度が粗すぎる（主因）

**分類: F — エラーハンドリング設計ミス**

`app/error.tsx` のみが存在し、`/room/[code]/play` 専用の error boundary がない。
レンダリング中に例外が1つでも投げられると、ページ全体がエラー画面に差し替わる。

```
app/error.tsx:31  ← "予期しないエラーが発生しました" の出所
app/room/[code]/error.tsx  ← 存在しない（問題）
```

### ② Member パスの winner null 競合状態

**分類: G — null/undefined アクセス**

`handleSpinComplete` が呼ばれた時点で `pendingMemberWinnerRef.current === null` の場合：
- `setPhase("result")` は実行される（`play/page.tsx:675`）
- `setWinner()` は実行されない（`play/page.tsx:726-734` の if ガードを通過できない）
- 結果: `phase="result"` かつ `winner=null` → WinnerCard が表示されない

**発生条件**: Realtime/ポーリングで `scheduleSpin` が呼ばれる前にアニメーションが完了した場合（低速回線 or ポーリング 2s 間隔のタイミング競合）

該当コード: `app/room/[code]/play/page.tsx:723-734`

### ③ `spin-complete` リトライ IIFE の例外逃げ

**分類: F — エラーハンドリング設計ミス**

```typescript
;(async () => { ... })()  // play/page.tsx:697
// ↑ .catch() がないため未処理の Promise rejection になる
```

リトライ内の `fetch()` や `fetchRanking()` が予期しない例外をスローした場合、
Next.js ランタイムの unhandledRejection ハンドラに伝播し、
エラーバウンダリをトリガーする可能性がある。

---

## 修正内容

### 応急対応: ルーム専用エラーバウンダリを追加

`app/room/[code]/error.tsx` を新規作成。
- エラーが発生しても「ルーレット結果は保存されています」と案内
- 再試行ボタンで回復可能

### 安全修正: Member race condition の解消

`handleSpinComplete` の Member パス（`play/page.tsx:723-734`）に fallback を追加：

```typescript
} else {
  // フォールバック: pendingMemberWinnerRef が null の場合、room state から当選者を取得
  showResult()
}
```

`showResult()` は既存関数（`play/page.tsx:658-672`）で `room.sessions[0].participants.find(p => p.isWinner)` から winner を設定する。

### 安全修正: IIFE に `.catch()` を追加

```typescript
;(async () => { ... })().catch((err) => {
  console.error("[OgoRoulette] spin-complete unexpected error:", err)
  setSpinError("結果の保存に失敗しました。ページを再読み込みしてください")
})
```

---

## 影響範囲

- `app/room/[code]/error.tsx`（新規作成）
- `app/room/[code]/play/page.tsx`（4行修正）
- `app/error.tsx`（ログ強化 1行）

---

## タスク

- [x] 調査: 根本原因の特定
- [x] `app/room/[code]/error.tsx` 作成
- [x] Member race condition 修正
- [x] IIFE `.catch()` 追加
- [x] `app/error.tsx` ログ強化
- [ ] 本番でエラーが解消されたことを確認

## 受け入れ条件

- ルーレット終了後にエラー画面が表示されない
- Member として参加した場合も WinnerCard が正常に表示される
- エラーが発生した場合でも「ルームの読み込みに失敗しました」という専用メッセージが表示され、再試行できる

## 優先度

Critical — デプロイブロッカー相当

## ステータス

✅ 修正済み（commit 予定）
