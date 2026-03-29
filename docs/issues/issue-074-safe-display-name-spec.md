# ISSUE-074: SNS共有時の表示名を安全な仕様に変更する（設計・仕様）

## ステータス
🔴 未対応

## 優先度
**Critical**

## デプロイブロッカー
Yes（SNS共有前提アプリとして公開すべきでない状態）

## カテゴリ
Privacy / Design / Architecture

---

## 概要

SNSログイン（Google/LINE）由来のフルネームがそのまま表示・共有されるリスクを防ぐため、
アプリ内表示名（display_name）と認証情報の名前（provider_name）を分離し、
SNS共有時は常に安全な表示名のみを使う仕様に変更する。

---

## 背景

- Google OAuth の `full_name` / LINE の `displayName` をそのまま `Profile.name` に保存している
- 結果画面・シェアテキスト・OGP 画像・動画書き出しでこの名前が外部公開されている
- 「山田太郎さんが奢り！」がそのまま X/LINE に投稿される事故が起きうる
- ユーザーは「ログインしただけ」で本名が SNS に出るとは想定していない

---

## 問題箇所（コード）

| ファイル | 問題 |
|---------|------|
| `app/auth/callback/route.ts:21,27` | `user_metadata.full_name` を `Profile.name` に保存 |
| `app/api/auth/line/callback/route.ts:115` | LINE `displayName` を `full_name` として保存 |
| `app/home/page.tsx:175-177` | ルーム作成時の ownerName に `user_metadata.full_name` を使用 |
| `app/history/[id]/page.tsx:112` | シェアテキストに `winner.name`（フルネームの可能性）を直接使用 |
| `app/join/[code]/page.tsx:187` | 招待ページに `room.owner.name` を表示 |
| `lib/share-service.ts` | `buildShareText` / `buildShareUrl` が winner 名をそのまま使用 |

---

## 採用仕様（C案＋B案ハイブリッド）

### 名前の種類

| 種類 | フィールド | 用途 | 公開可否 |
|------|----------|------|---------|
| provider_name | `Profile.name`（既存） | 内部記録のみ | **非公開** |
| display_name | `Profile.display_name`（新規） | アプリ内・SNS共有 | **公開** |
| fallback | `"ユーザー" + id末尾4文字` | display_name 未設定時 | **公開** |

### デフォルト動作
- `display_name` は NULL からスタート
- NULL 時は fallback を使用（本名は出ない）
- 初回シェアアクション時に公開名の確認ボトムシートを1回表示
- 確認後 `display_name_confirmed_at` を記録（以降は表示しない）

---

## 画面別ルール

| 画面 | 使用する名前 |
|------|------------|
| `/home` ウェルカム文 | `provider_name`（外部非公開のため可） |
| `/result` 結果画面 | `display_name` または fallback |
| シェアテキスト・URL | `display_name` または fallback |
| OGP 画像・動画書き出し | `display_name` または fallback |
| `/history` 履歴 | セッション保存時の名前（保存時に display_name で記録） |
| `/room` ロビー・招待ページ | `nickname` → `display_name` → fallback |

---

## 受け入れ条件

- [ ] ログインユーザーの本名が自動でSNS共有されない
- [ ] display_name 未設定時は fallback が使われる
- [ ] 初回シェア前に公開名確認が1回表示される
- [ ] ユーザーが display_name を変更できる導線がある
- [ ] 既存ユーザーへの移行がスムーズ（バッチ不要）

---

## 関連 Issue

- ISSUE-075: DB migration — Profile に display_name フィールド追加
- ISSUE-076: getDisplayName() ユーティリティ実装
- ISSUE-077: シェア箇所を display_name に切り替え
- ISSUE-078: 初回シェア前の公開名確認ボトムシート実装
- ISSUE-079: プロフィール編集導線の追加
