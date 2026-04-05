# play/page.tsx 分割リファクタ（1278行の単一ファイル解消）

## ステータス
✅ 完了 — 2026-04-05

## 概要

`app/room/[code]/play/page.tsx` が 1278 行に達しており、Phase ステートマシン・Supabase Realtime 購読・API 呼び出し・アニメーション制御・JSX が単一ファイルに集中している。保守性・テスタビリティ・可読性のために責務を分離する。

## 背景

OgoRoulette のルームプレイ画面（play ページ）は以下の関心事が混在している:

- Phase state machine（waiting / preparing / spinning / result）
- Supabase Realtime 購読とイベントハンドリング
- 10秒ポーリングのフォールバック
- オーナー / メンバーの条件分岐ロジック
- スピン完了の 3 リトライロジック
- ビデオ録画のライフサイクル管理
- QR コード表示・スキャン機能
- 金額計算ロジック
- 参加者表示・アバター表示
- 各種 UI コンポーネントの JSX（1000 行超）

これを 1 ファイルに詰め込んだ結果:
- バグ修正時に関係ない行が視野に入り認知負荷が高い
- 新機能追加時にどこに書けばよいか迷う
- unit test が書きにくい（外部依存が絡み合っている）

## 現状の問題

- 1278 行のファイルはスクロールによる認知負荷が高い
- `const spinScheduledRef = useRef(false)` のような guard flag が何のための変数か文脈を追いにくい
- Realtime と polling のデュアルチャンネルロジックが UI 定義と混在している
- TypeScript の型定義（`Phase`, `Member`, `Session` 等）がページコンポーネントの中にある

## 目的

- 関心の分離により各モジュールの責務を明確にする
- バグ修正・機能追加のコストを下げる
- ロジックを custom hook に分離して unit test 可能にする

## 対応内容

### 分離方針

```
app/room/[code]/play/
├── page.tsx          ← UI のみ（200行程度に削減）
│
├── _hooks/
│   ├── use-spin-phase.ts      # Phase state machine（waiting→spinning→result）
│   ├── use-realtime-sync.ts   # Supabase Realtime 購読・イベントハンドリング
│   └── use-spin-complete.ts   # スピン完了 API 呼び出し（3 retry + backoff）
│
└── _types.ts         # Phase, Member, Session, SessionWinner 型定義
```

### 各 hook の責務

**`use-spin-phase.ts`**
- `phase` state の管理（waiting / preparing / spinning / result）
- `pendingWinnerIndex`・`spinSeed`・`spinStartedAtMs` の管理
- Phase 遷移のロジック

**`use-realtime-sync.ts`**
- Supabase Realtime チャンネルの購読・解除
- 10秒ポーリングのフォールバック
- `roomStatusRef` の adaptive polling
- 中途合流メンバーの遅延補正（`ELAPSED_CAP_MS`）

**`use-spin-complete.ts`**
- `POST /api/rooms/${code}/spin-complete` の呼び出し
- 3 リトライ + exponential backoff
- 409 / 404 の特別処理

### 移行手順

1. 型定義を `_types.ts` に抽出
2. `use-spin-complete.ts` を先に抽出（最も独立性が高い）
3. `use-realtime-sync.ts` を抽出（Realtime + polling をまとめる）
4. `use-spin-phase.ts` を抽出
5. `page.tsx` から抽出済み hook を呼び出す形に置き換える
6. 各 hook の unit test を追加

### 注意事項

- ref の受け渡し（`wheelRotationRef` 等）は hook 間の依存を生むため慎重に設計する
- Guard flag（`spinScheduledRef`）は state machine の内部状態として扱う
- Realtime と Phase machine の結合点（Realtime イベント → Phase 変更）を明確な interface で定義する

## 完了条件

- [ ] `_types.ts` に型定義が移動している
- [ ] `use-spin-complete.ts` が分離されている
- [ ] `use-realtime-sync.ts` が分離されている
- [ ] `use-spin-phase.ts` が分離されている
- [ ] `page.tsx` が 300 行以下になっている
- [ ] 既存の動作（オーナー/メンバーの同期・リスピン・エラーハンドリング）が変わらない
- [ ] TypeScript エラーなし・ビルドエラーなし
- [ ] 少なくとも `use-spin-complete.ts` の unit test が追加されている

## 優先度

**Recommended** — 今すぐ壊れるものではないが、Phase 2 以降の機能追加コストを下げるために先行して対応すべき。

## 期待効果

- Engineering スコア: 64 → 70（+6）
- バグ修正時間の短縮
- 新機能（多人数奢りモード等）の追加が安全にできる
- 将来のテスト追加が容易になる

## 関連カテゴリ

Engineering

## 備考

- `home/page.tsx` も改善余地があるが、play/page.tsx の方が複雑度・リスクが高いため優先
- リファクタは既存動作を壊さないことが最優先。機能追加はしない
- 分割後も `"use client"` は page.tsx で指定し、各 hook は普通の TypeScript モジュールとして扱う
- Supabase の Realtime 購読は cleanup が重要（channel の適切な unsubscribe）
