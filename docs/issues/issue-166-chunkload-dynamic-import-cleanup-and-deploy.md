# ChunkLoadError 根絶 + 未コミット修正のデプロイ

## 概要

ルーレット停止直後に ChunkLoadError でエラー画面に遷移する重大不具合を根絶する。
原因は `home/page.tsx` の `next/dynamic` による chunk 分割。デプロイのたびに stale chunk が 404 となり、ルーレット停止の瞬間（Confetti / WinnerCard の初回 mount タイミング）にエラーが発生する。
修正コード（static import への変換）はローカルに完了しているが、未コミット・未デプロイ。

## 背景

- ISSUE-150 で `RouletteWheel` を `next/dynamic` に変更したことで chunk `ab8635c6e7470436.js` が生成された（その後 `app/page.tsx` では revert 済み）
- しかし `home/page.tsx` では `Confetti`・`WinnerCard`・`RecordingCanvas`・`ShareSheet` が引き続き `next/dynamic` で分割されている
- Vercel は push のたびにビルドを再実行し chunk ハッシュが変わる
- 古い HTML を持つブラウザが stale chunk を参照 → 404 → ChunkLoadError
- ルーレット停止時に `setShowConfetti(true)` / `setWinner(...)` が呼ばれ、それらの component が初めて render される → chunk ロードが発火するため「停止直後にエラー」となる
- `play/page.tsx` では同じ Confetti・WinnerCard を static import しているため同問題は発生しない

## 現状の問題

- ルーレット停止 = OgoRoulette のコア体験の絶頂で、エラー画面が表示される
- Vercel に docs のみの push でも再発しうる構造的問題
- 修正コードはローカルに存在するが未コミット・未デプロイのため本番で問題が継続している

```
// 現在の home/page.tsx（修正済みだが未コミット）
import { Confetti }   from "@/components/confetti"      // static に変更済み
import { WinnerCard } from "@/components/winner-card"   // static に変更済み
// RecordingCanvas / ShareSheet はまだ dynamic のまま
```

## 目的

- ChunkLoadError をデプロイ後でも発生しない構造に変える
- `home/page.tsx` と `play/page.tsx` の import 方針を統一する
- 未コミットの修正を本番に届ける

## 対応内容

### Step 1: RecordingCanvas / ShareSheet も static import に変更

```typescript
// 変更前（home/page.tsx）
const RecordingCanvas = dynamic(() => import("@/components/recording-canvas").then(m => ({ default: m.RecordingCanvas })), { ssr: false })
const ShareSheet = dynamic(() => import("@/components/share-sheet").then(m => ({ default: m.ShareSheet })), { ssr: false })

// 変更後
import { RecordingCanvas } from "@/components/recording-canvas"
import { ShareSheet }      from "@/components/share-sheet"
```

`dynamic` をすべて削除できる場合は `import dynamic from "next/dynamic"` 行も削除する。

### Step 2: TypeScript ビルド確認

```bash
npx tsc --noEmit
npm run build
```

### Step 3: commit & push & deploy

```bash
git add components/prism-burst.tsx app/home/page.tsx app/room/[code]/play/page.tsx
git commit -m "fix: ISSUE-166 — home/page.tsx の dynamic import を static 化し ChunkLoadError を根絶"
git push
```

## 完了条件

- [x] `home/page.tsx` の Confetti・WinnerCard・RecordingCanvas・ShareSheet が全て static import になっている
- [x] `import dynamic from "next/dynamic"` の行が `home/page.tsx` から削除されている（他に dynamic が残っていない場合）
- [x] `npx tsc --noEmit` でエラーなし
- [x] `npm run build` でビルドエラーなし
- [ ] commit & push & Vercel デプロイ完了
- [ ] デプロイ後にルーレットを回してエラー画面にならないことを確認

## ステータス

**完了（コミット待ち）** — 2026-04-04
実装済み。`app/home/page.tsx` の `next/dynamic` を全廃し static import に変換。ISSUE-168（PrismBurst）と同時コミット予定。

## 優先度

**Critical** — ルーレット停止 = コア体験の瞬間にエラーが発生する。最優先で対応が必要。

## 期待効果

- Engineering スコア: 64 → 73（+9）
- UX スコア: 65 → 70（+5）
- ルーレット停止時の ChunkLoadError が根絶される
- デプロイをまたいで古いタブを開いていたユーザーでも自動回復する

## 関連カテゴリ

Engineering / UX

## 備考

- 関連 plan: `glimmering-swinging-scott.md`（ISSUE-152 ChunkLoadError 無限ループ修正）
- `app/error.tsx` と `app/room/[code]/error.tsx` の sessionStorage ガードは本 issue とは独立して有効。引き続き残す。
- `app/page.tsx` の RouletteWheel は既に static import に戻っている（確認済み）
- 修正済み未コミットの対象ファイル:
  - `components/prism-burst.tsx`（新規ファイル、ISSUE-168 と同時にコミット）
  - `app/home/page.tsx`（Confetti・WinnerCard static + PrismBurst 追加 + showPrismBurst state）
  - `app/room/[code]/play/page.tsx`（PrismBurst import + showPrismBurst state）
