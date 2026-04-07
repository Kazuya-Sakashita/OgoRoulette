# ISSUE-231: AARRR改善(P2) — シェアURL経由の新規ユーザー参加フロー最適化

## ステータス
✅ 完了 2026-04-07

## 優先度
**P2 / Medium** — AARRR-Referral の改善。シェアカードを見た非メンバーが参加しやすくなる

## カテゴリ
AARRR / Referral / Share / Viral Loop

## 対象スコア
AARRR-Referral: +1 / AARRR-Acquisition: +0.5 → 総合 +1.5点

---

## Summary

ルーレット結果のシェアカードをSNSで見た人が「面白そう！次の飲み会で使おう」と思っても、
現状シェアURL（OGP画像のリンク）はルームページ or LPに遷移するだけで、
「自分も参加できる / 次回ルームを作る」という行動に結びつく導線がない。

---

## Background

### 現状のシェアフロー

```
オーナーがシェア → X/LINEに投稿 → 見た人がリンクをタップ
→ /room/[code] または LP に遷移（ルームは既に COMPLETED）
→ 「参加できない」「何するアプリか分からない」で離脱
```

### OGPとシェアの現状

- `ISSUE-214` で動的OGPは実装済み（winner名 + 金額表示）
- シェアカードは視覚的に魅力的
- ただし、リンク先で「次のアクション」が明確でない

### ウイルス係数の構造

```
スピン1回 → シェア → 閲覧者N人 → アプリ認知 → 次の飲み会で利用
```

この「アプリ認知 → 次の飲み会で利用」の変換率を上げることが Referral 改善の核心。

---

## Current Behavior

1. 結果シェアURLを踏む
2. ルームページ（COMPLETED状態）に遷移
3. 「このルームは終了しています」のような表示
4. 「ホームへ戻る」→ LP or ホームで迷子

---

## Expected Behavior

### シェアURLの遷移先最適化

結果シェアリンクのランディング先を最適化:

```
シェアURL: https://ogo-roulette.vercel.app/result?winner=山田&session=xxx

遷移先ページ:
┌────────────────────────────────┐
│  🎉 山田さんが奢りに決定！       │
│  OgoRoulette のルーレットで決めた│
│                                │
│  次の飲み会でも使う？            │
│  ↓                             │
│  [ルームを作る →]               │
│  [まず試してみる]               │
└────────────────────────────────┘
```

### 既存の /result ページ強化

`/result` ページ（ISSUE-094で実装済み）のCTAを「アプリを使ってみる」に誘導:

```tsx
// 現状: ホーム or 新しいルーレット
// 改善: シェア経由フラグを検知して、より魅力的なCTAを表示

{isShareLanding && (
  <div className="text-center">
    <p className="text-muted-foreground mb-4">
      このルーレットは OgoRoulette で決めました
    </p>
    <Button asChild className="bg-gradient-accent text-white w-full h-14">
      <Link href="/room/create">次の飲み会で使ってみる →</Link>
    </Button>
  </div>
)}
```

### WinnerCard シェアボタンのURL改善

現在のシェアURLは `/room/[code]` → COMPLETED ルームへ遷移。
改善: シェアURLを `/result?session=[id]` 形式に変更し、専用ランディングページへ誘導。

---

## Scope

- `app/result/page.tsx` — シェア経由フラグ検知 + CTA改善（最小変更）
- `app/room/[code]/play/_components/room-play-overlays.tsx` — シェアURLのパス変更（`/result?session=xxx`）
- `app/api/og/route.ts` — OGP 生成の確認（変更不要の可能性あり）

---

## Root Cause Hypothesis

シェア機能は「現在のルームURL」をそのままシェアする設計になっており、
「見た人がアプリを試す」という変換を意識した設計になっていない。

---

## Proposed Fix

### Step 1（最小改善）: /result ページのCTA強化

```tsx
// app/result/page.tsx
// URLパラメータ ?ref=share があれば「シェア経由」として扱う

const isShareLanding = searchParams.get("ref") === "share"

// CTA変更
<Button asChild>
  <Link href={isShareLanding ? "/room/create" : "/home"}>
    {isShareLanding ? "次の飲み会で使ってみる →" : "ホームへ戻る"}
  </Link>
</Button>
```

### Step 2: シェアURL変更

```typescript
// WinnerCard のシェアURL生成
const shareUrl = `https://ogo-roulette.vercel.app/result?session=${sessionId}&ref=share`
```

---

## Acceptance Criteria

- [ ] シェアURLを踏んだユーザーが「このアプリを使ってみる」CTAを見られる
- [ ] 結果ページで「ルームを作る」へのクリック率が改善される（計測可能）
- [ ] 既存のシェアフロー（自分の振り返り用）に影響なし
- [ ] OGPプレビュー画像は変更なし

## Priority
**P2**

## Impact
AARRR-Referral +1、AARRR-Acquisition +0.5 → 総合 +1.5点

## Risk / Notes
- `/result` ページの現状実装（ISSUE-094）を確認すること
- `session` パラメータが有効でない場合のフォールバック表示が必要
- シェアURLの変更はすでにシェアされたURLの遷移先が変わるため、後方互換性を確認
