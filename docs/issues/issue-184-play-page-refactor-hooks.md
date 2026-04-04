# play/page.tsx リファクタ（custom hooks分離・1296行解消）

## 概要

`app/room/[code]/play/page.tsx` が1296行に達しており、Phase ステートマシン・Supabase Realtime購読・ポーリング・スピンロジック・ビデオ録画・JSX が単一ファイルに混在している。issue-172の実装計画を踏まえ、責務ごとにcustom hookへ分離してファイルサイズを400行以下に削減する。

## 背景

G-STACK Architecture スコア（13/20）の最大の減点要因が play/page.tsx の保守性問題。1296行の巨大ファイルは:
- バグ修正時に無関係な300行を読み飛ばす必要がある
- `spinScheduledRef` 等の guard flag がなぜ必要かを追うのに文脈全体が必要
- Realtime購読コードと JSX が隣接しており責務が不明確
- unit test が書けない（外部依存が絡み合っている）

issue-177（同期修正）が完了した今、アーキテクチャ整備のタイミングとして最適。

## 問題

- Phase machine（waiting/preparing/spinning/result）の遷移ロジックが300行超にわたって分散
- Supabase Realtime購読とポーリングのデュアルチャンネルロジックが200行を占める
- ビデオ録画ライフサイクル・金額計算・グループ保存・QR表示が同じファイルにある
- TypeScript型定義（Phase/Member/Session/Room/WinnerData）がページコンポーネント内にある

## 目的

- play/page.tsx を400行以下に削減し、認知負荷を下げる
- ロジックをcustom hookに分離してunit test可能にする
- 将来の機能追加コストを下げる

## 対応内容

### Step 1: 型定義の分離

```
app/room/[code]/play/
├── page.tsx          # 400行以下（UIのみ）
├── types.ts          # Phase / Member / Session / Room / WinnerData
├── use-room-sync.ts  # Realtime購読・ポーリング・fetchRoom
├── use-spin.ts       # スピンロジック・Phase machine
└── use-bill.ts       # 金額計算・billInput state
```

### Step 2: use-room-sync.ts（Realtime + polling）

```typescript
// app/room/[code]/play/use-room-sync.ts
export function useRoomSync(code: string) {
  // fetchRoom, Realtime購読, 10秒ポーリング
  // roomStatusRef, prevSessionIdRef を内包
  return { room, loading, error, fetchRoom, fetchRanking, roomRanking }
}
```

### Step 3: use-spin.ts（Phase machine）

```typescript
// app/room/[code]/play/use-spin.ts
export function useSpin(room: Room | null, currentUser: User | null, ...) {
  // phase, winner, spinScheduledRef
  // handleSpin（オーナー）
  // handleMemberSpin（メンバー）
  // Phase A → Phase B 遷移
  return { phase, winner, setPhase, handleSpin, ... }
}
```

### Step 4: page.tsx をUI専用に

インポートと JSX のみで400行以下。State はhookから受け取る。

### Step 5: types.ts の作成

`Phase`, `Member`, `Session`, `Room`, `WinnerData` インターフェースを `types.ts` に移動。

## 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `app/room/[code]/play/page.tsx` | 400行以下にダウンサイズ（UIのみ） |
| `app/room/[code]/play/types.ts` | 新規作成（型定義） |
| `app/room/[code]/play/use-room-sync.ts` | 新規作成（Realtime/polling） |
| `app/room/[code]/play/use-spin.ts` | 新規作成（Phase machine） |
| `app/room/[code]/play/use-bill.ts` | 新規作成（金額計算） |

## 完了条件

- [ ] `app/room/[code]/play/page.tsx` が400行以下になる
- [ ] `types.ts` に Phase/Member/Session/Room/WinnerData が定義されている
- [ ] `use-room-sync.ts` に Realtime購読・ポーリングロジックが分離されている
- [ ] `use-spin.ts` にPhase machine・スピンロジックが分離されている
- [ ] `npm run build` / `npx tsc --noEmit` でエラーなし
- [ ] マルチプレイ動作確認（リファクタ前後で挙動変化なし）

## ステータス

**未着手** — 2026-04-04

## 優先度

**Recommended** — 保守性改善。issue-177完了後の次のEngineeringタスク。

## 期待効果

- G-STACK Architecture: 13 → 16 (+3)
- G-STACK 総合: 68 → 70 (+2)
- 総合スコア: 65 → 66 (+1)

## 関連カテゴリ

Engineering / Architecture / Refactoring

## 関連ISSUE

- issue-172（play/page.tsx分割の既存計画）
- issue-177（ルーレット同期修正・先行完了）
- issue-009（polling/Realtime二重化設計）
