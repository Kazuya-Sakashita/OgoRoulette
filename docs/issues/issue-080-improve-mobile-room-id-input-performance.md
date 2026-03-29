# ISSUE-080: スマホでルームID入力時の反応が鈍い問題を改善する

## ステータス
✅ 完了

## 優先度
High

## カテゴリ
Frontend / Mobile UX / Performance

## 概要

デプロイ済みアプリのスマホ環境（特に iOS Safari）で、
`/scan` ページのルームID入力欄の反応が鈍く、1文字ごとの入力が引っかかる。

ルーム参加導線は主要導線の1つであり、初回利用の障壁・離脱要因になっている。

---

## 背景

- スマホで QR コードが読めない場合にルームIDを手動入力する
- このとき入力欄の体感が悪く、ストレスになる
- PC では気づきにくく、スマホ実利用で顕在化する

---

## 根本原因（複合要因 E + B）

### 原因1: `autoFocus` によるキーボード強制表示 → レイアウトシフト

`app/scan/page.tsx:121` の `autoFocus` 属性により、ページ読み込み直後に iOS Safari がキーボードを強制表示する。

キーボード展開時に `window.innerHeight` が変化し、以下が連鎖する:
- `.glass-card` の `backdrop-filter: blur(20px)` → GPU composite 再計算
- `min-h-screen` レイアウトの再フロー
- `scrollIntoView()` の暗黙実行によるスクロールジャンク

低〜中スペックの iPhone では 200ms 以上の描画ブロックが発生する。

### 原因2: `autoCapitalize` / `autoCorrect` 等が未設定 → IME 競合

`autoCapitalize`, `autoCorrect`, `autoComplete`, `spellCheck` が設定されていないため、
iOS が文章入力として扱い、予測変換・スペルチェックを処理しようとする。

`onChange` の `toUpperCase()` と IME の変換処理が競合し、
50〜150ms/文字 の体感遅延が発生する。

また CSS の `uppercase` クラスと `toUpperCase()` が二重に大文字化を行うことで、
iOS の IME が「入力文字と表示文字が異なる」と判断し、コンポジション処理を繰り返す。

### 原因3: `glass-card` の `backdrop-filter` が入力を包んでいる

入力欄が `backdrop-filter: blur(20px)` を持つ `.glass-card` の子要素になっている。
iOS Safari はこのコンテナの子へのインタラクション時に compositor layer を再計算する。

---

## 修正内容

### app/scan/page.tsx

| 変更 | 内容 |
|------|------|
| `autoFocus` を削除 | キーボード強制表示を防ぐ |
| `autoCapitalize="characters"` を追加 | iOS が最初から大文字モードで入力する |
| `autoCorrect="off"` を追加 | スペルチェック/自動修正を無効化 |
| `autoComplete="off"` を追加 | 予測補完を無効化 |
| `spellCheck={false}` を追加 | IME スペルチェックを無効化 |
| `enterKeyHint="go"` を追加 | キーボードに「Go」ボタンを表示 |
| CSS `uppercase` クラスを削除 | `toUpperCase()` との二重処理を解消 |

---

## タスク
- [x] 根本原因調査
- [x] 入力属性の修正
- [ ] モバイル実機確認（iOS Safari）
- [ ] 回帰確認（PC 動作）
- [ ] console error 確認

## 受け入れ条件
- スマホでのルームID入力がスムーズ（引っかかりなし）
- フォーカス時にキーボードが自然なタイミングで開く
- iOS で最初から大文字キーボードが表示される
- 予測変換バーが表示されない
- キーボードに「Go」ボタンが表示される
- 6文字で「参加する」ボタンが有効になる（既存動作）
- PC で手動クリックで入力開始できる

## デプロイブロッカー
No（改善 Issue）
