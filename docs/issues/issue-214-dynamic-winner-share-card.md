# ISSUE-214: AARRR-Referral強化 — 当選者名入り動的シェアカード生成

## ステータス
📋 未着手

## 優先度
**Medium** — 感情スコアが 15/20 を超えた後に着手（AARRR-Referral ボトルネック解消）

## カテゴリ
Marketing / SEO / Growth / Referral

## 対象スコア
AARRR-Referral: +2（12→14/20） / AARRR-Acquisition: +1 / G-STACK-Strategy: +0.5

---

## 背景

現在のシェア機能（ISSUE-199 実装済み）：
- 「OgoRouletteで奢りを決めた！」というテキストシェア
- `/opengraph-image` で静的な OGP 画像

問題：シェアされても「誰が当たったか」が見えない。
「田中さんが奢ることになりました！😭」という具体的な情報が SNS に流れないため、
見た人が「気になる！使ってみよう」と思わない。

---

## 問題

### ① OGP 画像が静的で毎回同じ

シェアした人の友人の TL に流れても「また同じ画像」で埋もれる。
「今日も誰かが奢らされてる！」という新鮮さがない。

### ② 当選者名・参加人数・当選回数がシェアに含まれない

バイラルのフックになる情報（「4人で回して田中さんが当選！今日で3回目」）が
URL のプレビューに出てこない。

### ③ シェアカード URL が generic すぎる

`https://ogo-roulette.vercel.app/` をシェアしても
「どんなアプリか」は伝わるが「今起きた出来事」が伝わらない。

---

## 改善内容

### Step 1: スピン結果専用 OGP ページの作成

```
/result/[sessionId] — スピン結果の永続化ページ（24時間有効）
```

```tsx
// app/result/[sessionId]/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export default async function OGImage({ params }: { params: { sessionId: string } }) {
  const result = await getSpinResult(params.sessionId)
  // result: { winnerName, participantCount, spinCount, roomName }

  return new ImageResponse(
    (
      <div style={{ background: '#0f172a', width: '1200px', height: '630px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
        <div style={{ fontSize: '40px', color: '#94a3b8', marginBottom: '20px' }}>
          🎰 OgoRoulette
        </div>
        <div style={{ fontSize: '72px', fontWeight: 900, color: '#60a5fa', marginBottom: '16px' }}>
          {result.winnerName}さんが奢ります！
        </div>
        <div style={{ fontSize: '28px', color: '#64748b' }}>
          {result.participantCount}人で回した結果 · {result.roomName}
        </div>
        <div style={{ fontSize: '22px', color: '#475569', marginTop: '24px' }}>
          あなたのグループでも試してみよう → ogo-roulette.vercel.app
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
```

### Step 2: スピン完了時に結果ページ URL を生成

```tsx
// スピン完了後に WinnerCard で「この結果をシェア」ボタン
const shareUrl = `https://ogo-roulette.vercel.app/result/${sessionId}`
const shareText = `${winnerName}さんが今日のお会計を担当！${participantCount}人でOgoRouletteを回した結果でした。`

<ShareButton url={shareUrl} text={shareText} />
```

### Step 3: 結果ページの実装

```tsx
// app/result/[sessionId]/page.tsx
// - 当選者名・参加者一覧・ルーム名を表示
// - 「このグループで始める」ボタン（グループ情報付きホームへ）
// - 「OgoRouletteを試す」CTA
// - 24時間で自動削除（privacy保護）
```

### Step 4: Prisma スキーマ追加

```prisma
model SpinResult {
  id              String   @id @default(cuid())
  winnerName      String
  participantCount Int
  roomName        String?
  createdAt       DateTime @default(now())
  expiresAt       DateTime // createdAt + 24h
}
```

---

## 影響ファイル

- `app/result/[sessionId]/page.tsx`（新規）
- `app/result/[sessionId]/opengraph-image.tsx`（新規）
- `app/api/spin/complete/route.ts` — SpinResult 保存処理追加
- `components/winner-card.tsx` — シェアURL を result URL に変更
- `prisma/schema.prisma` — SpinResult モデル追加

---

## 完了条件

- [ ] スピン完了後に `/result/{id}` の URL が生成される
- [ ] X（Twitter）でシェアすると当選者名入りの OGP 画像が表示される
- [ ] LINE でシェアすると同様に当選者名入りプレビューが表示される
- [ ] 結果ページに「OgoRouletteを試す」CTA があり、ホームへ誘導される
- [ ] 24時間後に SpinResult が削除される（クリーンアップ cron job）

## 期待スコア上昇

AARRR-Referral: +2（12→14） / AARRR-Acquisition: +1
→ 総合: +2点
