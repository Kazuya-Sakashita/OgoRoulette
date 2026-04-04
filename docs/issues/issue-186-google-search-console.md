# Google Search Console 登録・サイトマップ送信

## 背景

sitemap.ts・robots.ts は ISSUE-185 で実装済みだが、Search Console への登録・サイトマップ送信が未実施。現状 OgoRoulette は検索エンジンにほぼインデックスされていない可能性が高く、AARRR Acquisition（12/20）の最大ボトルネックになっている。

## 問題

- `https://ogo-roulette.vercel.app/` が Google に認識されているか不明
- `https://ogo-roulette.vercel.app/sitemap.xml` が送信されていない
- `/lp` `/how-to-use` などのコンテンツページがインデックスされていない

## 目的

- Google 検索からの自然流入を獲得する
- AARRR Acquisition を 12 → 15 (+3) に改善する

## 対応内容

### Step 1: Search Console 登録

1. https://search.google.com/search-console にアクセス
2. 「URLプレフィックス」ではなく「ドメイン」プロパティとして `ogo-roulette.vercel.app` を登録
3. Vercel プロジェクト設定 → DNS → TXT レコードで所有権確認

### Step 2: サイトマップ送信

1. Search Console → サイトマップ
2. `https://ogo-roulette.vercel.app/sitemap.xml` を入力して送信
3. ステータスが「成功」になることを確認

### Step 3: インデックス申請

URL検査ツールで以下をインデックス申請：
- `https://ogo-roulette.vercel.app/lp`
- `https://ogo-roulette.vercel.app/how-to-use`
- `https://ogo-roulette.vercel.app/` (トップ)

### Step 4: OGP確認

- https://cards-dev.twitter.com/validator で LP の OGP 動作確認
- https://www.opengraph.xyz/ で OGP メタデータ確認

## 完了条件

- [ ] Search Console でドメインが認識されている
- [ ] サイトマップが送信済み（ステータス:成功）
- [ ] `/lp` のインデックス申請完了
- [ ] カバレッジレポートでエラーなし

## 影響範囲

Google Search Console 側の手動作業（コードベース変更なし）

## リスク

低。既存コードへの影響なし。

## ステータス

**未着手** — 2026-04-04

## 優先度

**Critical** — 手動作業30分でSEO流入の基盤が整う。即日実施推奨。

## 期待効果

- AARRR Acquisition: 12 → 15 (+3)
- 総合スコア: 71 → 72〜73

## 関連ISSUE

- issue-185（sitemap/robots実装）
- issue-189（OGP動的画像生成）
