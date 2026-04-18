---
name: ISSUE-290
type: bug
priority: Critical
status: 🔲 未対応
---

# ISSUE-290: Critical — OG画像エンドポイントが本番で0バイトを返す（SNS共有の視覚プレビュー全滅）

## ステータス
🔲 未対応 — 本番実機確認で発覚。`/opengraph-image` と `/api/og` の両エンドポイントが HTTP 200 を返しながら Content-Length: 0（ボディ空）。SNS共有のプレビュー画像がすべてブランクになっている。

## 優先度
**Critical / バイラル / 収益性**

## カテゴリ
Bug / OG Image / Edge Runtime / Satori / 本番のみ再現

---

## 問題

本番環境（https://ogo-roulette.vercel.app）で確認：

```bash
curl -s https://ogo-roulette.vercel.app/opengraph-image | wc -c
# → 0

curl -s "https://ogo-roulette.vercel.app/api/og?winner=田中&color=%23FF5733&count=4" | wc -c
# → 0
```

HTTP ステータスは 200、`Content-Type: image/png` は正しく返るがボディが空。

---

## 影響

- X（Twitter）でシェアしたとき → 画像なし、テキストのみ
- LINE でシェアしたとき → プレビュー画像なし
- Slack / iMessage でリンク展開 → ブランク
- `/result` ページのシェアリンク → 当選者名入り OG 画像が表示されない
- **バイラルループの核心部分が完全に機能していない**

---

## 推定原因

`app/opengraph-image.tsx` と `app/api/og/route.tsx` はどちらも Satori（next/og の ImageResponse）を使い edge runtime で動作する。

**仮説 A（最有力）: 絵文字レンダリングの失敗**

`opengraph-image.tsx` に `🎰` 絵文字、`api/og/route.tsx` に `👑` 絵文字がある。
Satori は絵文字フォント（Twemoji 等）を別途ロードしなければ絵文字を描画できない。
フォントなしで絵文字を含む JSX をレンダリングしようとすると ImageResponse がクラッシュし、
edge runtime がエラーを飲み込んで空レスポンスを返す場合がある。

**仮説 B: Google Fonts fetch がタイムアウト**

どちらのエンドポイントも Google Fonts CSS API を fetch してフォントデータを取得する。
edge runtime からの外部 fetch がタイムアウトした場合、フォントデータなしで ImageResponse を
構築しようとして失敗する可能性がある（catch ブロックで無視されている）。

**仮説 C: ISSUE-274 の color バリデーション変更による副作用**

`api/og` は ISSUE-274 で color パラメータの正規表現バリデーションが追加された。
テンプレートリテラル内の `color` 変数が template literal injection を引き起こす可能性（低）。

---

## 修正方針

### 優先: 絵文字を削除またはテキスト代替に変換

```tsx
// Before
<span style={{ fontSize: 68 }}>🎰</span>

// After（絵文字なし）
<span style={{ fontSize: 68, color: "#F97316" }}>★</span>
```

または twemoji フォントを追加ロードする（サイズが大きくなるトレードオフあり）。

### Google Fonts fetch のデバッグ

```typescript
// loadFont() の catch に詳細ログを追加して Vercel Functions ログで確認
} catch (err) {
  console.error("[og] font load failed:", err)
  return null
}
```

### ローカル再現手順

```bash
# next/og の edge runtime 動作はローカルでは `next dev` で確認可能
npm run dev
curl -s http://localhost:3000/opengraph-image | wc -c
# 0 なら絵文字問題、正常なら本番環境特有の問題
```

---

## 受け入れ条件

- [ ] `curl https://ogo-roulette.vercel.app/opengraph-image | wc -c` が 0 以外を返すこと
- [ ] X Card Validator で OG 画像が表示されること
- [ ] `/result` ページのシェアリンクで当選者名入り OG 画像が表示されること
- [ ] `npm run build` でエラーなし、`npx tsc --noEmit` でエラーなし

## 関連ファイル

- `app/opengraph-image.tsx`
- `app/api/og/route.tsx`

## 関連 ISSUE

- ISSUE-274: GET /api/og color パラメータバリデーション（直前の変更）
- ISSUE-289: CSP フォントブロック修正（前回の OG 関連修正）
