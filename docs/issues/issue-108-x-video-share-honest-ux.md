# issue-108: Xへの動画シェア仕様を再評価し、実態に合う形へ修正する

## 概要

動画シェア時にXへ正しく動画共有できていない可能性があるため、
実際の共有挙動を再評価し、仕様と実装を整合させる。

調査結果: **Xへの動画直接共有は技術的に不可能**（intent URL制約）。
コードはこれを正しく認識しているが、UIがユーザーに伝えていないことが本質的な問題。

---

## 背景

- ユーザーは「X」ボタンを押すと動画付きでX投稿されると期待している可能性がある
- 実際にはテキスト+URLのみ（動画はX intentに渡せない）
- Xボタン押下時に動画が**無予告で自動ダウンロード**される（驚き体験）
- 端末によって主ボタン「動画をシェア」の挙動が大きく異なる
- Share / Growth導線として重大な齟齬

---

## 調査結果

### プラットフォーム別挙動

#### ShareSheet 主ボタン「動画をシェア」/ 「画像をシェア 📸」

| プラットフォーム | 実際の挙動 |
|---|---|
| PC (Chrome/Firefox) | `navigator.canShare({files})` が false → URL+テキストのみシェア。動画はXへ渡らない |
| iPhone (Safari/Chrome) | `captureStream()` 非対応 → 動画録画不可 → PNG fallback。`navigator.share({files:[png]})` → iOSシェアシート → Xアプリに**画像**が渡る可能性あり（保証なし） |
| Android (Chrome) | WebM動画録画。`navigator.share({files:[webm]})` → Androidシェアシート → Xアプリに**動画**が渡る可能性あり（Xアプリのwebm受け入れ次第） |

#### ShareSheet 「X」ボタン（セカンダリ）

| プラットフォーム | 実際の挙動 |
|---|---|
| すべて | 動画/画像を**無予告でダウンロード** → `twitter.com/intent/tweet?text=...&url=...` を開く。Xへ渡るのはテキスト+URLのみ |

#### result ページ「Xで共有」ボタン

| プラットフォーム | 実際の挙動 |
|---|---|
| すべて | `twitter.com/intent/tweet?text=...&url=...` → テキスト+URLのみ。これはこのページに動画がないため正しい設計 |

### 技術的成立性

**X intent URL で動画共有は成立しない（仕様上不可能）。**
- `twitter.com/intent/tweet` は `text` と `url` パラメータのみサポート
- ファイル（動画/画像）を渡す仕組みは存在しない
- `share-service.ts:8` にも明記されている

**Web Share API 経由で動画共有は条件付きで成立する可能性がある。**
- 成立条件: iOS 15+ / Android Chrome、Xアプリインストール済み、OSシェアシートでXを選択、XアプリがそのMIMEタイプを受け入れる
- 成立しない条件: PC、Xアプリ未インストール、Android WebMをXアプリが拒否

**iOS で動画録画は成立しない。**
- `HTMLCanvasElement.captureStream()` が iOS Safari 非対応
- `canRecord()` → false → 録画スキップ → PNG fallback（`use-video-recorder.ts:62-66`）
- 正しく実装されているが「動画」ではなく「静止画」

---

## 問題点

### 根本原因分類

| 分類 | 内容 | 該当箇所 |
|---|---|---|
| **C（最有力）** | X intent URL で動画添付は不可能。既知・意図的 | `lib/share-service.ts:8, 111-121` |
| **D（有力）** | Web Share API file share が端末依存で不確実 | `lib/share-service.ts:137-176` |
| **E（有力）** | iOS Safari で captureStream 非対応 → 動画録画不可 → PNG fallback | `lib/video-recorder.ts:29`, `lib/use-video-recorder.ts:62-66` |
| **F（有力）** | Xボタン文言とツールチップの不一致（PC: hover でしか見えない） | `components/share-sheet.tsx:357` |
| **H** | C+D+E+F の複合要因 | — |

### 具体的な Xボタン挙動フロー

```
ユーザーが「X」ボタンを押す
  ↓
shareToX() 実行 (lib/share-service.ts:111)
  ↓ blob がある場合
downloadVideo(blob, winner)  ← 動画が突然・無予告でダウンロードされる
  ↓
window.location.href = "twitter.com/intent/tweet?text=...&url=..."
                                ↑
                         動画は含まれない（intent URL制約）
```

ユーザー体験: 「Xでシェアしようとしたら動画がダウンロードされた」「Xが開いたが動画が添付されていない」→ 混乱・不満

### コードは正直だがUIが伝えていない

- `share-service.ts:8` に `no video via intent` と明記
- `share-sheet.tsx:357` に `title="Xにテキストをシェア（動画なし）"` と tooltip あり
- しかしこの tooltip は PC の hover でしか見えない。モバイルでは見えない
- 「X」ボタンラベルだけでは何が共有されるか伝わらない

---

## 修正方針

### 応急対応（UX誤認を防ぐ）

1. **Xボタンに「テキストのみ」を明示する**
   - ボタンラベルを「X（テキスト）」等に変更、またはボタン下に注記
   - `※ 動画は保存して手動添付` 等の説明文を表示

2. **自動ダウンロードをXボタンから分離する**
   - Xボタン: テキスト+URL投稿のみ
   - 保存ボタン: 動画/画像ダウンロードのみ
   - 責務を明確に分離する

### 安全修正（現実的に成立する共有仕様へ）

1. **PC環境での主ボタン表示を正直にする**
   - PC では `navigator.canShare({files})` が false → URL共有のみ
   - ボタン名を「URLをシェア / コピー」にするか、PC検出してラベルを変える

2. **主ボタンのプラットフォーム別説明を整える**
   - iOS: 「画像をシェア 📸」（すでに実装済み、正しい）
   - Android: 「動画をシェア」（条件付きで動画渡せる）
   - PC: 「URLをシェア」または「リンクをコピー」

### 理想修正（バズ導線として強い体験へ）

**「動画を保存 → Xアプリで投稿」の2ステップガイドUI**

```
[動画をダウンロード 📥]  ← 明示的な保存ボタン
↓
ガイドテキスト: 「保存した動画をXアプリから投稿するとバズれる！」
↓
[Xでテキストを投稿 →]  ← X intent で compose画面を開く（動画添付はユーザーに委ねる）
```

これは現在の実装と実質同じだが、ユーザーが意図して動画を保存し、意図してXに投稿するという流れになる。

---

## UX改善案

### ボタン文言

| 場所 | 現状 | 改善案 |
|---|---|---|
| ShareSheet 主ボタン (PC) | 「動画をシェア」 | 「URLをシェア / コピー」（PC判定して変える）|
| ShareSheet Xボタン | 「X」 | 「X（テキスト）」または「Xに投稿」 |
| ShareSheet X tooltip | `title="Xにテキストをシェア（動画なし）"` | ボタン下に `※ 動画は保存して手動添付` を常時表示 |
| result ページ | 「Xで共有」 | そのまま（動画なし文脈なので正しい）|

### 失敗・fallback 時のメッセージ

- 主ボタンが URL 共有のみになった場合（PC）: 「リンクをコピーしました！ Xアプリに動画を手動で添付するとさらにバズれます！」
- Web Share API 未対応: 「クリップボードにコピーしました」（現状通り）

---

## タスク

- [ ] Xボタンのラベルに「テキストのみ」を明示する
- [ ] Xボタンから自動ダウンロードを分離する（またはユーザーに予告する）
- [ ] PC環境での主ボタン表示をプラットフォーム判定で変える
- [ ] ボタン下注記 `※ 動画は保存して手動添付` を常時表示する
- [ ] 理想的には「動画保存 → Xで投稿」2ステップガイドUIを実装
- [ ] PC / iPhone / Android での実機確認
- [ ] 回帰確認

---

## 受け入れ条件

- ユーザー期待と実挙動が一致する（「Xに動画が付く」と誤解させない）
- Xボタンで何が共有されるか、モバイルでも伝わる
- 動画共有できない場合（PC等）も誤解を生まない案内がある
- バズ導線として「動画ダウンロード → 手動添付」の2ステップが自然に行える

---

## 調査日

2026-03-31

## 優先度

High

## デプロイブロッカー

No（UX改善。機能自体は動いており、コードは技術的に正直な実装になっている）

---

## 参考: 調査対象ファイル

- `lib/share-service.ts` — Xシェア関数、Web Share API、ダウンロード処理
- `components/share-sheet.tsx` — シェアシートUI、ボタン群
- `lib/use-video-recorder.ts` — 録画ライフサイクル、PNG fallback
- `lib/video-recorder.ts` — MediaRecorder wrapper、canRecord()、getSupportedMimeType()
- `components/recording-canvas.tsx` — Hidden canvas、captureStream() の呼び出し元
- `app/result/_result-content.tsx` — result ページの「Xで共有」ボタン
