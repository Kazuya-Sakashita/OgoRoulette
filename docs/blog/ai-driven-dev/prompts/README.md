# AI駆動開発 プロンプト集

> OgoRoulette（1ヶ月ハッカソン）で実際に使用したプロンプトを体系化した資産です。  
> コピペで使える状態を前提に整理しています。

---

## このディレクトリの目的

AI駆動開発において、プロンプトは**コードと同じくらい重要な設計物**です。

- 良いプロンプトは再現性の高い結果を出す
- 悪いプロンプトはAIを迷子にする
- プロンプトを資産として蓄積することで、次のプロジェクトが速くなる

このコレクションは「実際に動いたプロンプト」のみを収録しています。

---

## カテゴリ一覧（全11カテゴリ・13ファイル）

| カテゴリ | ファイル | レベル | 再利用性 |
|---------|---------|--------|---------|
| [design/](design/icon-replacement.md) | SVGアイコン→実画像差し替え | 初級 | 高 |
| [ui-ux/](ui-ux/lp-layout-improvement.md) | LP UX評価・CTA改善 | 中級 | 高 |
| [frontend/](frontend/pc-layout-2col.md) | PC 2カラムレイアウト化 | 中級 | 高 |
| [frontend/](frontend/accessibility-fix.md) | A11y問題一括修正 | 初級 | 高 |
| [backend/](backend/api-room-management.md) | Realtime/ポーリング状態同期 | 中級 | 中 |
| [debugging/](debugging/chunk-load-error.md) | ChunkLoadError無限ループ診断 | 上級 | 中 |
| [debugging/](debugging/polling-animation-skip.md) | ポーリング遅延アニメーションスキップ | 上級 | 中 |
| [refactor/](refactor/static-import-vs-dynamic.md) | 静的import vs 動的importの判断 | 中級 | 高 |
| [testing/](testing/deployment-verification.md) | デプロイ後の変更反映確認 | 初級 | 高 |
| [marketing/](marketing/lp-creation.md) | LP HTML生成・PDF出力 | 上級 | 中 |
| [blog/](blog/story-article.md) | 開発体験→ストーリー記事 | 初級 | 高 |
| [blog/](blog/methodology-article.md) | 開発手法→メソドロジー記事 | 中級 | 高 |
| [gstack/](gstack/lighthouse-evaluation.md) | Lighthouse評価→ISSUE自動生成 | 中級 | 高 |
| [gstack/](gstack/browse-qa.md) | ブラウザ自動操作QA | 中級 | 高 |
| [general/](general/issue-decomposition.md) | 評価結果→ISSUEドキュメント化 | 初級 | 高 |
| [general/](general/plan-mode-request.md) | 実装前の設計承認（PlanMode） | 中級 | 高 |

---

## 特に強力なプロンプト TOP5

| # | プロンプト | なぜ強いか |
|---|-----------|----------|
| ⭐1 | [gstack/lighthouse-evaluation.md](gstack/lighthouse-evaluation.md) | 定量評価→ISSUE自動生成まで1セット。スコア +6点を実現 |
| ⭐2 | [debugging/chunk-load-error.md](debugging/chunk-load-error.md) | 無限ループを40分で診断・修正。本番障害対応の型 |
| ⭐3 | [general/issue-decomposition.md](general/issue-decomposition.md) | すべての改善起点になるISSUE管理の核心 |
| ⭐4 | [frontend/pc-layout-2col.md](frontend/pc-layout-2col.md) | モバイル影響ゼロでPC UX を刷新 |
| ⭐5 | [blog/story-article.md](blog/story-article.md) | 開発体験を30分で読まれる記事に変換 |

---

## 使い方

### ステップ1: カテゴリを選ぶ
今やりたいことのカテゴリのフォルダを開く。

### ステップ2: プロンプトをコピーする
各ファイルの「## プロンプト」セクションをそのままコピーする。

### ステップ3: 変数を埋める
`{your-app-url}` などの `{}` で囲まれた部分を自分のプロジェクトの値に書き換える。

### ステップ4: AIに渡す
そのまま Claude Code（またはClaude）に貼り付けて実行する。

---

## レベル凡例

| レベル | 目安 |
|--------|------|
| 初級 | そのままコピペで使える。前提知識不要 |
| 中級 | プロジェクトの文脈（ファイル名・コード）を提供する必要がある |
| 上級 | 複数の情報を組み合わせる必要がある。状況判断が求められる |

---

## 関連資産

- [methodology/ai-driven-development-guide.md](../methodology/ai-driven-development-guide.md) — このプロンプト集の使い方を含む開発手法全体
- [../../issues/](../../issues/) — このプロンプトで生成されたISSUEファイル群
- [stories/](../stories/) — このプロンプトで生成されたストーリー記事

---

*最終更新: 2026-04-03 | プロジェクト: OgoRoulette*
