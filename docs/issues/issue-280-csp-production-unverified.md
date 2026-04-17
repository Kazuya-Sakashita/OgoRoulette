# ISSUE-280: High — CSP 本番未検証（ISSUE-263 追加分）

## ステータス
🔲 手動検証待ち — ISSUE-289 で Vercel Analytics とフォントブロックは修正済み。残りのフロー（OAuth・Realtime・MediaRecorder・QRスキャン）はブラウザDevToolsでの手動確認が必要。自動化不可。

## 優先度
**High / セキュリティ / 回帰確認**

## カテゴリ
Security / CSP / Production Verification / Regression

---

## 問題

ISSUE-263 で `Content-Security-Policy` ヘッダーを `next.config.mjs` に追加したが（commit 5f4c330）、
Report-Only フェーズをスキップして直接 Enforcement モードで適用した。
本番環境での全フローに対する動作確認が実施されていない。

CSP 設定ミス（許可ドメインの漏れ・ディレクティブ不足）が発生した場合、
機能がサイレントに壊れる（ブラウザが CSS/JS/画像をブロックする）。

---

## なぜ危険か

- `connect-src` に漏れがあると Supabase Realtime（WebSocket）が切断される
- `img-src` に漏れがあると LINE/Google アバター画像が表示されない
- `media-src` に漏れがあると MediaRecorder 録画が動作しない
- `worker-src` の `blob:` がないと Web Worker が起動しない
- エラーはブラウザコンソールにのみ出力され、ユーザーには無音で壊れたように見える

---

## 発生条件

本番デプロイ後の全フロー実行時。

---

## 要検証フロー

| フロー | 確認すべき CSP ディレクティブ |
|--------|-------------------------------|
| Google OAuth ログイン | `connect-src 'self' https://*.supabase.co` |
| LINE OAuth ログイン | `connect-src 'self'`、`img-src https://profile.line-sc.com https://obs.line-apps.com https://*.line-scdn.net` |
| X（Twitter）シェア | `connect-src`（外部 API は使わないが確認） |
| LINE シェア | 同上 |
| Supabase Realtime（スピン同期） | `connect-src wss://*.supabase.co` |
| 絵文字リアクション（Realtime） | 同上 |
| QR スキャン（カメラ） | Permissions-Policy は別だが CSP の `media-src` も確認 |
| MediaRecorder 録画 | `media-src 'self' blob:` |
| OG 画像生成（/api/og） | `img-src 'self' data:` |
| LINE アバター表示 | `img-src https://profile.line-sc.com https://obs.line-apps.com https://*.line-scdn.net` |
| Google アバター表示 | `img-src https://lh3.googleusercontent.com` |
| Next.js Image コンポーネント | `img-src 'self' data: blob:` |

---

## 影響範囲

全フロー（CSP は全レスポンスに付与される）

---

## 修正方針

1. 本番環境の DevTools → Console でCSP 違反エラー (`Refused to ...`) を確認
2. 違反があれば `next.config.mjs` の CSP ディレクティブに許可エントリを追加
3. 各フローを再確認してから ISSUE をクローズ

### もし修正箇所が多い場合

一時的に `Content-Security-Policy-Report-Only` に戻し、違反を収集してから再適用する。

---

## 受け入れ条件

- [ ] 上記全フローを本番環境で実行し、CSP 違反エラーが 0 件であること
- [ ] DevTools Console に `Refused to load` / `Refused to connect` が出ないこと
- [ ] 確認結果をこの ISSUE にコメントとして記録すること

## 関連 ISSUE

- ISSUE-263: CSP 追加（実装 ISSUE）
