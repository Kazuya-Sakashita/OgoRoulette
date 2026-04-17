# ISSUE-276: 結果URLに HMAC 署名トークンを追加して改ざんを検知する（✅ 修正済み・本番確認済み）

## 概要

`/result` シェアリンクは URL パラメータのみで当選者・金額を表現するため、
第三者が URL を手動で書き換えて「自分が奢りに当たった」以外の結果を捏造できる。

HMAC-SHA256 署名トークンをサーバー側で生成し、URL に含めることで
「このスピンはサーバーが正式に抽選した」ことを検証可能にする。

---

## 問題

- `/result?treater=XXX&total=...` のパラメータは全てクライアントが自由に書き換え可能
- 誰でも任意の当選者名・金額を持つ URL を生成して第三者に見せられる
- 信頼性のある結果共有ができない

---

## 解決策

### HMAC-SHA256 署名トークン

```
token = HMAC-SHA256(RESULT_TOKEN_SECRET, "${sessionId}:${winnerName}")
```

- `RESULT_TOKEN_SECRET` はサーバーのみが保有する秘密鍵
- クライアントは token を生成・偽造できない
- `session` + `token` + `winner` の 3 パラメータを `timingSafeEqual` で検証

### フロー

```
POST /api/rooms/[code]/spin
  → サーバーが当選者を決定
  → signResultToken(sessionId, winnerName) で token 生成
  → レスポンスに { resultToken, sessionId } を含める

WinnerCard シェアボタン
  → buildShareUrl に sessionId / resultToken を渡す
  → /result?...&session=UUID&token=HEX の URL を生成

/result ページ
  → GET /api/result-verify?token=HEX&session=UUID&winner=NAME
  → { valid: true } → ✅ 緑バッジ表示
  → { valid: false } → ⚠️ 黄バッジ表示
  → パラメータなし → バッジなし（ローカルモード・旧URL）
```

---

## 実装内容

### 新規ファイル

| ファイル | 内容 |
|---------|------|
| `lib/result-token.ts` | `signResultToken` / `verifyResultToken` HMAC 実装 |
| `app/api/result-verify/route.ts` | GET エンドポイント — token 検証して `{ valid }` を返す |
| `prisma/migrations/...(なし)` | DB 変更なし |

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `app/api/rooms/[code]/spin/route.ts` | `signResultToken` 呼び出し + try/catch（SECRET 未設定時は undefined） |
| `app/api/rooms/[code]/route.ts` | sessions に `resultToken` を含めてメンバーも verified URL を構築可能に |
| `app/room/[code]/play/types.ts` | `Session` に `resultToken?`、`WinnerData` に `sessionId?` / `resultToken?` |
| `app/room/[code]/play/use-spin.ts` | `resultTokenRef` / `resultSessionIdRef` を保持、WinnerData に渡す |
| `lib/share-service.ts` | `SharePayload` に `sessionId?` / `resultToken?` 追加、`buildShareUrl` に反映 |
| `components/winner-card.tsx` | `sessionId` / `resultToken` prop 追加、sharePayload に渡す |
| `app/room/[code]/play/_components/room-play-overlays.tsx` | WinnerCard に `sessionId` / `resultToken` を渡す |
| `app/result/_result-content.tsx` | `verification` state 追加、`/api/result-verify` 呼び出し、バッジ表示 |

---

## 本番デプロイ時の注意事項

**`RESULT_TOKEN_SECRET` を Vercel の Environment Variables に登録する必要がある。**

`.env.local` に存在するが Vercel には自動同期されない。
未登録の場合 `signResultToken()` が throw → try/catch → `resultToken = undefined` → URL に `token` パラメータなし → バッジ非表示。

```
Vercel ダッシュボード → Project → Settings → Environment Variables
  RESULT_TOKEN_SECRET = <.env.local の値>
  Environment: Production + Preview
```

---

## 受け入れ条件

- [x] `lib/result-token.ts` — HMAC-SHA256 sign/verify 実装
- [x] `GET /api/result-verify` — token 検証エンドポイント実装
- [x] spin API レスポンスに `resultToken` / `sessionId` を含める
- [x] WinnerCard シェア URL に `session` / `token` パラメータを含める
- [x] `/result` ページで `verification` バッジを表示（valid: ✅ / invalid: ⚠️ / none: 非表示）
- [x] `SECRET` 未設定時はスピンが壊れないこと（try/catch で graceful degradation）
- [x] `vitest` 193件 全パス
- [x] Vercel に `RESULT_TOKEN_SECRET` を登録後、シェアURLで ✅ バッジ表示を本番確認済み

---

## 優先度: Medium

- セキュリティ改善（信頼性向上）
- 感情スコアには直接影響しないが、シェアの「信頼感」に寄与
- コアフロー（スピン・WinnerCard）への影響はゼロ（graceful degradation）

## 関連 ISSUE

- ISSUE-245: HMAC トークン padding 対策（先行 HMAC 実装）
- ISSUE-214: `/result` シェアURL 統一
- ISSUE-094: result ページ room join CTA
