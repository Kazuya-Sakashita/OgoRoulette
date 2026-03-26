# ISSUE-034: PWA manifest のアイコン設定不備で Chrome インストール基準を満たさない

## 概要

`public/manifest.json` のアイコンが 192x192 の 1サイズのみで、`"purpose": "any maskable"` を1つのアイコンに組み合わせて指定している。Chrome の PWA インストール基準（512x512 アイコン必須）を満たさず、Android でのホーム画面追加時にアイコンが崩れる可能性がある。

## 背景

`"purpose": "any maskable"` の組み合わせは、1つのアイコンを「通常表示」と「マスク表示（セーフゾーン80%）」の両方に使うことを意味する。マスク表示ではアイコンの外周20%がトリミングされるため、ロゴが見切れる可能性がある。また 512x512 アイコンがないと Chrome が PWA インストールボタンを表示しない場合がある。

## 問題点

- 現在何が起きているか: manifest.json のアイコンが 1種類（192x192）のみ
- ユーザー影響: Android でホーム画面追加時にアイコンが低解像度または切り取られて表示される。Chrome の「インストール」バナーが表示されない可能性
- 技術的影響: ISSUE-016 で実装した PWA 機能が本来の品質で機能しない

## 修正方針

1. 512x512 アイコンを追加する
2. `"purpose"` を `"any"` と `"maskable"` に分離する:

```json
{
  "icons": [
    { "src": "/images/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/images/icon-192-maskable.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/images/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/images/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

maskable アイコンはセーフゾーン（中央 80%）にロゴが収まるようにデザインすること。

## タスク

- [ ] 512x512 アイコン画像を作成・追加（`public/images/icon-512.png`）
- [ ] maskable 用アイコン（セーフゾーン対応）を作成・追加
- [ ] `public/manifest.json` を更新
- [ ] Chrome DevTools の Lighthouse PWA 監査を実行して基準を満たすことを確認

## 受け入れ条件

- Chrome が PWA インストールバナーを表示する
- Android ホーム画面のアイコンが正しく表示される
- Lighthouse PWA 監査がパスする

## 優先度

Low

## デプロイブロッカー

No（ホーム画面追加は機能するが品質が低い）
