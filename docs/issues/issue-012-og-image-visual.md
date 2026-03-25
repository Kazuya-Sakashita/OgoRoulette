# [ISSUE-012] OG 画像のビジュアルが弱く SNS でのクリック率が低い

## 🧩 概要

`/api/og` で生成される OG 画像は動的に生成されているが、テキストと勝者カラーの背景のみで視覚的なインパクトが弱い。「〇〇さんが奢り確定！」という強いコンテンツにも関わらず、X・LINE でシェアされたリンクのプレビューが地味で、クリック率・シェア率が低くなっている可能性がある。

## 🚨 背景 / なぜ問題か

**現在の OG 画像の内容:**
- 背景: 勝者のセグメントカラー（グラデーション）
- テキスト: 勝者名 + 「今日の奢り神様！」
- サイズ: 1200×630px（OG 標準）

**問題:**
- SNS のフィードで他の投稿と差別化できない
- 絵文字・クラウン・ルーレットホイール等の視覚要素がない
- 金額情報（`¥15,000 奢り確定！`）が表示されていないケースがある
- OgoRoulette のブランドが伝わらない（ロゴなし）

## 🎯 目的

OG 画像を視覚的にインパクトがあるものにリニューアルし、SNS でのシェア時のクリック率・口コミ拡散率を向上させる。

## 🔍 影響範囲

- **対象機能:** OG 画像生成 / SNS シェア
- **対象画面:** `/result`
- **対象コンポーネント:** `app/api/og/route.ts`（Satori / ImageResponse）

## 🛠 修正方針

**新しい OG 画像のデザイン要件:**

1. **勝者名を大きく中央に**（現状維持だが文字サイズを大きく）
2. **クラウン絵文字（👑）を勝者名の上に大きく表示**
3. **背景に暗いグラデーション** + 勝者カラーのグロー効果
4. **金額情報**（`treatAmount` がある場合）を目立つ位置に
5. **OgoRoulette ロゴ** を右下に小さく
6. **「🎰 奢り確定！」テキスト**（固定コピー）を副見出しに

**Satori（Next.js ImageResponse）での実装:**

```tsx
// app/api/og/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const winner = searchParams.get("winner") ?? "???"
  const color = searchParams.get("color") ?? "#F97316"
  const amount = searchParams.get("amount")

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
          background: `radial-gradient(ellipse at center, ${color}40 0%, #0B1B2B 60%)`,
          fontFamily: "Noto Sans JP",
        }}
      >
        <div style={{ fontSize: 80 }}>👑</div>
        <div style={{ fontSize: 72, fontWeight: 900, color: "white", marginTop: 16 }}>
          {winner}
        </div>
        <div style={{ fontSize: 32, color: color, marginTop: 8 }}>
          🎰 今日の奢り確定！
        </div>
        {amount && (
          <div style={{ fontSize: 48, color: "white", fontWeight: 700, marginTop: 16 }}>
            ¥{Number(amount).toLocaleString()}
          </div>
        )}
        <div style={{ position: "absolute", bottom: 24, right: 24, fontSize: 18, color: "rgba(255,255,255,0.5)" }}>
          OgoRoulette
        </div>
      </div>
    ),
    { width: 1200, height: 630, ... }
  )
}
```

## ⚠️ リスク / 副作用

- Satori でサポートされる CSS プロパティは限定的（`flex`, `position: absolute` 等）
- 絵文字のレンダリングにはフォントファイルが必要（`noto-color-emoji` 等）
- 既存の OG URL のキャッシュが Vercel Edge / CDN に残っている場合、変更が即座に反映されないことがある

## ✅ 確認項目

- [ ] 新しい OG 画像が 1200×630 で正しく生成される
- [ ] 勝者名・クラウン・金額が表示される
- [ ] X でシェアしたときに画像プレビューが表示される
- [ ] LINE でシェアしたときに画像プレビューが表示される

## 🧪 テスト観点

**手動確認:**
1. `/api/og?winner=田中&color=%23F97316&amount=15000` に直接アクセスして画像を確認
2. X Card Validator（`cards-dev.twitter.com`）で OG タグとプレビューを確認
3. LINE でリンクをシェアしてプレビューを確認

## 📌 受け入れ条件（Acceptance Criteria）

- [ ] OG 画像に勝者名・クラウン絵文字・「奢り確定！」テキストが含まれる
- [ ] `amount` パラメータがある場合は金額が表示される
- [ ] X・LINE でシェアしたときに OG 画像プレビューが表示される

## 🏷 優先度

**Medium**

## 📅 実装順序

**12番目**

## 🔗 関連Issue

- [ISSUE-007] iOS 動画シェア（バイラル施策の並行対応）
