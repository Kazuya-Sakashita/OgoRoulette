# State — 状態管理パターン

## play/page.tsx のカスタムフック構成

```
play/page.tsx（298行）
├── useRoomSync(code)        → room データ・ポーリング・ランキング
├── useBill(participantCount) → 金額入力・割り勘計算
├── useSpin({...})           → スピン制御・カウントダウン・winner確定
└── useVideoRecorder()       → 録画フェーズ管理
```

**ルール:** ロジックはフックに、描画は `RoomPlayBody` / `RoomPlayOverlays` コンポーネントに分離。

## ゲストホスト判定

```ts
// localStorage から読む（SSRでは使わない）
const stored = JSON.parse(localStorage.getItem("ogoroulette_host_rooms") || "[]")
setIsGuestHost(stored.includes(room.inviteCode))
guestHostTokenRef.current = localStorage.getItem(`ogoroulette_host_token_${room.inviteCode}`)
```

**問題:** localStorage 依存のため SSR で参照不可。`isGuestHostResolved` フラグで初期化完了を待つ。

## room の status 遷移

```
WAITING → IN_SESSION（spin開始）→ COMPLETED（winner確定）
                                  → WAITING（respin / reset）
EXPIRED（有効期限切れ）
```

## スピン phase 遷移

```
idle → preparing（カウントダウン）→ spinning → slowing → result → idle
```

## 非同期競合対策

- `isRespinningRef`（useRef）で二重タップによる重複スピン防止（ISSUE-206）
- カウントダウン中の参加者削除ガード — winner index の配列外参照防止（ISSUE-203）
- `clockOffsetMs` でホスト・メンバー間の時刻スキュー補正（ISSUE-202）

## グループ保存

```ts
// lib/group-storage.ts
// ログインユーザー: Supabase DB（user_groups テーブル）
// ゲスト: localStorage
// 同期: useGroups フック
```
