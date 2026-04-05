# ref=share コンバージョン計測（ウイルスループ効果測定）

## 背景

ISSUE-183 でウイルスループURL（`/join?room=[code]&ref=share`）を実装したが、シェアURLからの流入がどれだけルーム参加に繋がっているかを計測する仕組みがない。ウイルスループの実効性が測定できず、改善のPDCAが回せない。

## 問題

- `ref=share` パラメータがあっても analytics イベントを送っていない
- `/join/[code]` にアクセスした時点でシェア流入か直接アクセスかを区別できない
- Referral Rate（シェア → 参加率）が不明
- シェアカード（ISSUE-183）やプライマリCTA（ISSUE-181）の効果が数値で見えない

## 目的

- ウイルスループの効果を定量測定する
- Referral コンバージョン率を把握し、シェアCTAのA/Bテスト基盤を構築する
- AARRR Referral の計測精度を向上させる

## 対応内容

### Step 1: AnalyticsEvent の追加

```typescript
// lib/analytics.ts
export enum AnalyticsEvent {
  // 既存イベント ...

  // ISSUE-187: シェア流入追跡
  SHARE_JOIN_CLICK = "share_join_click",       // ref=share でjoinページ到達
  SHARE_JOIN_COMPLETE = "share_join_complete", // ルーム参加完了（ref=share経由）
}
```

### Step 2: /join/[code]/page.tsx にイベント追加

```typescript
// app/join/[code]/page.tsx
"use client"

import { useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { trackEvent, AnalyticsEvent } from "@/lib/analytics"

// コンポーネント内
const searchParams = useSearchParams()
useEffect(() => {
  if (searchParams.get("ref") === "share") {
    trackEvent(AnalyticsEvent.SHARE_JOIN_CLICK, {
      room: code,
      winner: searchParams.get("winner") ?? undefined,
    })
  }
}, []) // eslint-disable-line react-hooks/exhaustive-deps

// ルーム参加完了時
const handleJoinComplete = () => {
  if (searchParams.get("ref") === "share") {
    trackEvent(AnalyticsEvent.SHARE_JOIN_COMPLETE, { room: code })
  }
  // 既存の参加完了処理 ...
}
```

### Step 3: /join/page.tsx（コードなし直アクセス）にも対応

```typescript
// app/join/page.tsx
// URL例: /join?room=ABC123&ref=share&winner=さくら
// room パラメータを初期値にセットし、参加フローを即開始
```

## 完了条件

- [x] `ref=share` パラメータ付きアクセス時に `share_join_click` イベントが送信される
- [x] ルーム参加完了時に `share_join_complete` が送信される
- [ ] Vercel Analytics ダッシュボードでイベントが確認できる
- [x] `npm run build` でエラーなし

## 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `lib/analytics.ts` | `SHARE_JOIN_CLICK` / `SHARE_JOIN_COMPLETE` 追加 |
| `app/join/[code]/page.tsx` | ref=share 検出・イベント送信 |
| `app/join/page.tsx` | room パラメータ初期値セット |

## リスク

低。計測追加のみ、既存フローへの影響なし。

## ステータス

**未着手** — 2026-04-04

## 優先度

**Critical** — ISSUE-183（ウイルスループ）の効果測定に必須。計測なしで改善サイクルが回せない。

## 期待効果

- AARRR Referral の計測精度向上（定性→定量）
- シェアCTA改善のA/Bテスト基盤整備

## 関連ISSUE

- issue-183（ウイルスループURL実装）
- issue-181（Phase B シェアCTA）
- issue-190（Analyticsイベント体系）

## ステータス
✅ 完了 — 2026-04-06（app/join/[code]/page.tsx に useSearchParams + trackEvent 追加）
