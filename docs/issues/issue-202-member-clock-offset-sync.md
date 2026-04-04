# ISSUE-202: メンバークライアントの clockOffsetMs が常に 0（マルチプレイ同期ズレ）

## ステータス
✅ 完了 — 2026-04-05

## 優先度
**Major**

## カテゴリ
Bug / Multiplayer / Sync

## 概要
`app/room/[code]/play/use-spin.ts` では、サーバー時刻とのオフセット（`clockOffsetMsRef`）を使って演出開始タイミングを補正している。しかし、このオフセットはホストが `/api/rooms/[code]/spin` を POST した際にのみセットされる。メンバークライアントはこの API を呼ばないため、`clockOffsetMsRef.current` が常に 0 のまま。

## 問題のコード

```typescript
// use-spin.ts — ホストのみが実行する handleSpin 内
const serverTime = Number(res.headers.get("X-Server-Time") ?? Date.now())
const offset = serverTime - Date.now()
clockOffsetMsRef.current = offset  // ← メンバーは絶対ここに来ない
```

```typescript
// use-spin.ts — メンバーの scheduleSpin 内
const adjustedNow = now + clockOffsetMsRef.current  // ← 常に now + 0
const elapsed = Math.max(0, adjustedNow - startMs)
```

メンバーの `clockOffsetMsRef.current` は 0 のため、補正なしで経過時間を計算してしまう。  
ホストと参加者の端末間でシステム時刻が1〜3秒ずれている場合、演出開始タイミングが同様にズレる。

## 影響
- 4〜5人で使用したとき、ホストと参加者で当選演出が1〜3秒ズレる
- 参加者によってはすでに結果が出た後に演出が始まる（または演出がスキップされる）
- HEART Task Success スコアに直接影響（マルチプレイが売りのアプリとして致命的）

## 修正方針

### Option A: メンバーも独立して時刻同期する
```typescript
// メンバー用の時刻同期 — コンポーネントマウント時に一度実行
useEffect(() => {
  if (isOwner) return
  const t0 = Date.now()
  fetch("/api/time").then((res) => {
    const serverTime = Number(res.headers.get("X-Server-Time") ?? Date.now())
    const rtt = Date.now() - t0
    clockOffsetMsRef.current = serverTime - Date.now() + rtt / 2
  })
}, [isOwner])
```

### Option B: `/api/time` エンドポイント追加
`X-Server-Time` ヘッダーのみを返すエンドポイントを追加して ping-pong 方式で RTT を補正する。

```typescript
// app/api/time/route.ts
export function GET() {
  return new Response(null, {
    headers: { "X-Server-Time": Date.now().toString() }
  })
}
```

## 影響ファイル
- `app/room/[code]/play/use-spin.ts` — メンバー用時刻同期 useEffect 追加
- `app/api/time/route.ts` — 新規エンドポイント（Option B の場合）

## 参照
- ISSUE-200（第4回評価）で BUG-02 として特定
