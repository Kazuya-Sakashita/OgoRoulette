# OGP動的画像生成（X Card・当選者名入り）

## 背景

ISSUE-183 で Canvas 静止画シェアカードを実装したが、X（Twitter）に URL をシェアした際に表示される OGP Card 画像（`summary_large_image`）は静的 OGP のまま当選者名が入らない。X の Timeline に「○○さんが奢り確定！」という画像付き Card が表示されれば、タップ率・クリック率が大幅に向上する。

## 問題

- `/result?winner=さくら` にアクセスしても OGP 画像が固定の静的画像
- X の Card 形式でブランドが伝わらない（当選者名が表示されない）
- `app/opengraph-image.tsx` が当選者名パラメータに未対応
- Twitter Card Validator でプレビューしても素の OGP 画像しか出ない

## 目的

- X シェア時に「○○さんが奢り確定！」入りの画像 Card を表示する
- AARRR Referral を 16 → 18 (+2) に改善する
- X Timeline でのタップ率を向上させる

## 対応内容

### Step 1: `/result/opengraph-image.tsx` の新規作成

```typescript
// app/result/opengraph-image.tsx
import { ImageResponse } from "next/og"

export const runtime = "edge"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const winner = searchParams.get("winner") ?? "○○"
  const participants = searchParams.get("participants")?.split(",") ?? []

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0F2236 0%, #0B1B2B 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* ブランド */}
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 24, marginBottom: 24 }}>
          🎰 OgoRoulette
        </div>

        {/* 当選者名 */}
        <div style={{ color: "#FFFFFF", fontSize: 72, fontWeight: 900, marginBottom: 16 }}>
          {winner}さん
        </div>

        {/* コピー */}
        <div style={{ color: "#F59E0B", fontSize: 40, fontWeight: 700, marginBottom: 32 }}>
          奢り確定！🎉
        </div>

        {/* 参加者数 */}
        {participants.length > 0 && (
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 22 }}>
            {participants.length}人の中から選ばれました
          </div>
        )}

        {/* URL */}
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 18, marginTop: 32 }}>
          ogo-roulette.vercel.app
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
```

### Step 2: `/result/page.tsx` の generateMetadata を更新

```typescript
// app/result/page.tsx
import type { SearchParams } from "next/dist/server/request/search-params"

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const winner = params.winner ?? params.treater ?? "当選者"
  const participants = params.participants

  const ogImageUrl = new URL("/result/opengraph-image", "https://ogo-roulette.vercel.app")
  ogImageUrl.searchParams.set("winner", String(winner))
  if (participants) ogImageUrl.searchParams.set("participants", String(participants))

  return {
    title: `${winner}さんが奢り確定！— OgoRoulette`,
    openGraph: {
      title: `${winner}さんが今日の奢り担当に決定！`,
      description: "OgoRoulette で飲み会のおごりを公平に決めよう",
      images: [
        {
          url: ogImageUrl.toString(),
          width: 1200,
          height: 630,
          alt: `${winner}さんが奢り確定！`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${winner}さんが奢り確定！`,
      images: [ogImageUrl.toString()],
    },
  }
}
```

### Step 3: 確認

```bash
# Twitter Card Validator
open "https://cards-dev.twitter.com/validator"
# URL: https://ogo-roulette.vercel.app/result?winner=さくら

# OGP確認
open "https://www.opengraph.xyz/url/https%3A%2F%2Fogo-roulette.vercel.app%2Fresult%3Fwinner%3D%E3%81%95%E3%81%8F%E3%82%89"
```

## 完了条件

- [ ] `/result?winner=さくら` にアクセスすると OGP 画像に「さくらさんが奢り確定！」が表示される
- [ ] Twitter Card Validator で `summary_large_image` として認識される
- [ ] 1200×630px の画像が Edge Runtime で生成される
- [ ] `npm run build` でエラーなし

## 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `app/result/opengraph-image.tsx` | 新規作成（動的OGP画像生成） |
| `app/result/page.tsx` | `generateMetadata` で動的OGP画像URLを指定 |

## リスク

低。既存機能への影響なし。Vercel Edge Runtime で動作（レイテンシ最小）。

日本語フォントは Edge Runtime では `next/og` 標準フォントでカバーできない場合があるため、ひらがな・カタカナ・漢字の表示確認が必要。必要に応じて `@fontsource/noto-sans-jp` をフェッチする。

## ステータス

**未着手** — 2026-04-04

## 優先度

**Recommended** — X シェアの視覚的インパクトを最大化。ISSUE-186（Search Console）と並行して実施。

## 期待効果

- AARRR Referral: 16 → 18 (+2)
- X Timeline でのクリック率向上
- 総合スコア: 71 → 72

## 関連ISSUE

- issue-183（シェアカード・ウイルスループURL）
- issue-181（Phase B シェアCTA）
- issue-186（Search Console登録・OGP確認）
