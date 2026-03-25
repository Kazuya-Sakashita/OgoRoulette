# [ISSUE-001] ゲストホストの `isOwner` フリッカーによる SPIN ボタン永続無効化

## 🧩 概要

ゲストホストがプレイページ（`/room/[code]/play`）を開いたとき、`isGuestHost` が localStorage から非同期（useEffect）で読み込まれるため、最初のレンダリングで `isOwner === false` になる。この隙間にメンバー用エフェクトが誤発火し、`phase` が `"waiting"` 以外の値に遷移して SPIN ボタンが無効化される。

## 🚨 背景 / なぜ問題か

- `isGuestHost` の初期値は `false`（`useState(false)`）
- localStorage 読み込みは `useEffect` 内（非同期）のため、最初のレンダリング完了後に `true` になる
- loading guard（`if (loading || !authLoaded)`）は `isGuestHost` の解決を待たない
- loading guard をパスした直後に `isOwner === false` でメンバー用エフェクト（`play/page.tsx:283`）が発火する
- `room.status === "IN_SESSION"` の場合、`scheduleSpin()` が呼ばれ `phase = "preparing"`・`spinScheduledRef.current = true` がセットされる
- その後 `isGuestHost = true` になり `isOwner = true` になるが、`phase !== "waiting"` のため SPIN ボタンは disabled のまま押せない

**再現条件:**
1. ゲストホストとしてルームを作成し、SPIN を一度実行する
2. 結果表示中（または `room.status = "IN_SESSION"` の状態）でページをリロードする
3. プレイページを再度開く

## 🎯 目的

ゲストホストがプレイページを開いたとき、`isOwner` が確定するまでメンバー用エフェクトが発火しないようにする。最初から SPIN ボタンが正しく有効化された状態で表示される。

## 🔍 影響範囲

- **対象機能:** SPIN ボタン / ルーレット開始フロー
- **対象画面:** `/room/[code]/play`
- **対象コンポーネント:** `app/room/[code]/play/page.tsx`
  - `isGuestHost` useEffect（`line:260`）
  - メンバー用スピン検知 useEffect（`line:283`）
  - loading guard（`line:498`）
- **影響ユーザー:** ゲストホスト全員（認証ユーザーは非影響）

## 🛠 修正方針

`isGuestHostResolved` という boolean state を追加し、loading guard に含める。localStorage の読み込みは同期処理のため実質的な遅延はほぼ 0ms。

**修正箇所:** `app/room/[code]/play/page.tsx`

```tsx
// 1. state 追加
const [isGuestHost, setIsGuestHost] = useState(false)
const [isGuestHostResolved, setIsGuestHostResolved] = useState(false)

// 2. useEffect に resolved フラグ追加（line:260 付近）
useEffect(() => {
  if (!room) return
  const stored: string[] = JSON.parse(
    localStorage.getItem("ogoroulette_host_rooms") || "[]"
  )
  setIsGuestHost(stored.includes(room.inviteCode))
  guestHostTokenRef.current = localStorage.getItem(
    `ogoroulette_host_token_${room.inviteCode}`
  )
  setIsGuestHostResolved(true)  // ← 追加
}, [room?.inviteCode])

// 3. loading guard に追加（line:498 付近）
if (loading || !authLoaded || !isGuestHostResolved) {
  return <Spinner />
}
```

## ⚠️ リスク / 副作用

- 認証ユーザーも `isGuestHostResolved` が `true` になるまでスピナーを表示する。ただし `room?.inviteCode` が取得できれば即座に resolved になるため、体感遅延はほぼない
- `room` が null の場合は effect が走らない（`if (!room) return`）ため、`isGuestHostResolved = false` のままスピナーが出続ける可能性がある。`currentUser` がある場合は `isGuestHostResolved` を即時 `true` にする分岐が必要

**修正の追加考慮:**
```tsx
// 認証ユーザーは localStorage チェック不要なので即 resolved
useEffect(() => {
  if (currentUser) {
    setIsGuestHostResolved(true)
    return
  }
  if (!room) return
  // ... localStorage チェック
  setIsGuestHostResolved(true)
}, [room?.inviteCode, currentUser])
```

## ✅ 確認項目

- [ ] ゲストホストがリロード後、SPIN ボタンが正常に有効化されて表示される
- [ ] ゲストホストがリロード後、「準備中...」状態で止まらない
- [ ] 認証ユーザーの挙動に変化がない
- [ ] 非ログインメンバー（メンバー側）の挙動に変化がない
- [ ] room が null の場合に無限スピナーにならない

## 🧪 テスト観点

**自動テスト:**
- `isGuestHostResolved` が `true` になる前は loading 画面が表示されることの unit test
- `currentUser` あり / なし それぞれで `isGuestHostResolved` が正しく設定されること

**手動確認:**
1. ゲストホストでルーム作成 → SPIN 実行 → `room.status = "IN_SESSION"` の状態でリロード → SPIN ボタンが有効で表示される
2. ゲストホストでルーム作成 → SPIN 完了 → `room.status = "COMPLETED"` の状態でリロード → 「結果を見る」が表示される（SPIN は表示されない）
3. 認証ユーザーとして同じフローを確認 → 変化なし

## 📌 受け入れ条件（Acceptance Criteria）

- [ ] ゲストホストがプレイページをリロードしたとき、SPIN ボタンが有効な状態で表示される
- [ ] `phase` が `"waiting"` のまま初期描画される
- [ ] `spinScheduledRef.current` が `false` のまま初期化される
- [ ] 認証ユーザー・メンバーのフローに影響がない
- [ ] `isGuestHostResolved` の追加により無限スピナーが発生しない

## 🏷 優先度

**Critical**

## 📅 実装順序

**1番目**（最優先。ゲストホスト全員に影響する致命バグ）

## 🔗 関連Issue

- [ISSUE-002] spinScheduledRef 競合による setPhase("spinning") ブロック（本 Issue の副作用として発生）
- [ISSUE-003] phase="spinning" タイムアウト安全網の追加
