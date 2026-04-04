# SNSシェアカード完成（静止画・ブランド入り・ウイルスループ）

## 概要

「○○さんが奢り確定！」ブランド入り静止画カードをWeb Share API / Canvas で生成し、X・LINE・インスタグラムでシェアしたユーザーのタイムラインから新規ユーザーが流入するウイルスループを完成させる。issue-174（シェアカード映え化）の実装を完遂する。

## 背景

AARRR Referral スコア（12/20）の主なボトルネックは「シェアしてもブランドが伝わらない」こと。動画シェア（issue-091/092）は実装されているが、iOS のShare Sheetで画像+テキストを同時にシェアする静止画フローが未完成（issue-174）。結果として:
- 静止画シェアの離脱率が高い
- シェアされたXのタイムラインに「OgoRouletteとは何か」が伝わらない
- タイムラインからタップして参加するフローがない（URLにルーム情報がない）

## 問題

- 静止画シェアカード（Canvas生成）が未完成
- シェアURLにルーム招待コードが含まれていない
- 「シェアを見た人がタップ → そのままルームに参加できる」フローがない
- X（Twitter）へのシェアはテキストのみで画像がつかない

## 目的

- シェアしたXポストに「OgoRoulette」のブランドと当選者名入り画像を添付する
- シェアURLからワンタップでルーム参加できるウイルスループを設計する
- AARRR Referral を 12 → 17 (+5) 、Acquisition を 10 → 13 (+3) に改善する

## 対応内容

### Step 1: 静止画カード生成（Canvas API）

```typescript
// lib/share-card-generator.ts
// Canvas 400x400 px で以下を描画:
// - OgoRoulette ロゴ + グラデーション背景
// - 「🎉 ○○さんが奢り確定！」（大きなテキスト）
// - 「飲み会・ランチはOgoRouletteで」（サブコピー）
// - ルーレット絵文字 + 小さなURL
```

### Step 2: Share Sheet への静止画統合

現在の `ShareSheet` コンポーネントに「画像付きでシェア」フローを追加。iOS では Web Share API（`files: [imageBlob]`）、Android はCanvas → blob → share。

### Step 3: ウイルスループURL設計

```
https://ogo-roulette.vercel.app/join?room=[code]&ref=share
```

- シェアURLにルームコードを含め、タップすると直接ルーム参加フローへ
- `ref=share` パラメータで流入元をトラッキング
- ルームが期限切れの場合は「新しいルームを作る」CTAに遷移

### Step 4: X シェア改善

X の Card を活用するため OGP 画像を動的生成（`app/opengraph-image.tsx` の拡張）。勝者名・ルームコードをクエリパラメータで受け取り、個別の画像を生成する。

### Step 5: シェア後のサクセス状態

シェア完了後に「シェアしました！友達が参加するとここに表示されます」という軽いフィードバックを表示。

## 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `lib/share-card-generator.ts` | 新規作成（Canvas 静止画生成） |
| `components/share-sheet.tsx` | 静止画シェアフロー追加 |
| `app/opengraph-image.tsx` | 勝者名・ルームコード対応の動的OGP |
| `app/room/[code]/play/page.tsx` | シェアURLにルームコード付与 |
| `app/home/page.tsx` | シェアURLにref=shareパラメータ付与 |

## 完了条件

- [ ] Canvas 400x400px の静止画カードがOgoRouletteロゴ+当選者名+URLで生成される
- [ ] iOS の Web Share API で画像ファイルを添付してシェアできる
- [ ] Android でも同様に画像シェアできる（blob download フォールバック）
- [ ] シェアURLに `?room=[code]&ref=share` が含まれる
- [ ] シェアURLからアクセスした場合、ルーム参加フローに誘導される
- [ ] `npm run build` でエラーなし

## ステータス

**完了** — 2026-04-05

## 優先度

**Recommended** — ウイルスループの核心機能。Referral スコアの最大改善ポイント。

## 期待効果

- AARRR Referral: 12 → 17 (+5)
- AARRR Acquisition: 10 → 13 (+3)
- 総合スコア: 65 → 67 (+1.5)

## 関連カテゴリ

Growth / Referral / UX

## 関連ISSUE

- issue-067（シェアペイロード設計）
- issue-069（シェアシートUX）
- issue-070（シェアサービスコア）
- issue-071（勝者カード統合）
- issue-097（XシェアOGP強化）
- issue-173（ウイルスループ設計）
- issue-174（シェアカード映え化の既存計画）
