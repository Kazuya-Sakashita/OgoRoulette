# ISSUE-083: シェア後にChromeへ戻ると about:blank になる問題を修正する

## ステータス
🔴 未対応

## 優先度
High

## カテゴリ
Frontend / Mobile UX / Share

## デプロイブロッカー
No（UX 品質問題）

---

## 1. 問題概要

### 何が起きているか

X（Twitter）または LINE のシェアボタンを押すと、`window.open(..., "_blank", "noopener,noreferrer")` によって新しいタブが開く。
モバイル Chrome は外部アプリへリダイレクトするが、その新タブは `about:blank` のまま残る。
ユーザーがアプリ（X/LINE）から Chrome へ戻ると、直前にフォーカスされていた「about:blank タブ」が表示される。

### なぜ UX 上重大か

- ユーザーは「OgoRoulette が消えた」と感じる
- 戻り先が存在しているのに視認できない
- SNS 共有前提のプロダクトで、共有体験が不安定になると継続利用を妨げる
- 「壊れたアプリ」という印象を与える

---

## 2. 再現条件

| 条件 | 詳細 |
|------|------|
| 画面 | share-sheet（動画共有）/ winner-card / 結果画面 / 履歴詳細画面 |
| 操作 | 「X」または「LINE」ボタンを押す |
| 端末 | iPhone + Chrome / Android + Chrome（モバイル Chrome 共通） |
| 発生率 | X/LINE アプリがインストールされているとほぼ毎回 |
| Safari | Safari の場合も新タブが残るが挙動が異なる |
| navigator.share ボタン | **発生しない**（OS の Share Sheet を使うため） |

---

## 3. 根本原因候補

### 分類: **A（window.open の使い方ミス）** ← 最有力

**最有力候補:**
`window.open(url, "_blank", "noopener,noreferrer")` による新タブ残留

**発生メカニズム:**

```
1. ユーザーが「X」ボタンをタップ
2. window.open(twitterUrl, "_blank", "noopener,noreferrer") が実行される
3. Chrome が about:blank の新タブを開く
4. Twitter/LINE アプリが起動（OS レベルのリダイレクト）
5. 新タブは about:blank のまま → Chrome タブスタックに残留
6. ユーザーがアプリを終えて Chrome に戻る
7. Chrome は「直前に表示されていたタブ」= about:blank タブへ戻る
8. ユーザーは about:blank を見る
```

**noopener,noreferrer が悪化させる理由:**
- `noopener` により元のページから新タブを閉じる手段が完全に遮断される
- 新タブが孤立し、プログラムで回収できない

### 該当ファイル・箇所

| ファイル | 行 | 内容 |
|---------|-----|------|
| `lib/share-service.ts:103` | `shareToX()` | `window.open(..., "_blank", "noopener,noreferrer")` |
| `lib/share-service.ts:111` | `shareToLine()` | `window.open(..., "_blank", "noopener,noreferrer")` |
| `app/result/_result-content.tsx:196` | X インライン | 同上 |
| `app/result/_result-content.tsx:214` | LINE インライン | 同上 |
| `app/history/[id]/page.tsx:299` | X インライン | 同上 |
| `app/history/[id]/page.tsx:313` | LINE インライン | 同上 |

計 **6 箇所**すべてが同じパターン。

### 分類 G（外部アプリ遷移後の復帰導線未設計）も複合

`window.open` のまま使うことを前提にした設計で、
「外部アプリを経由して戻ったとき何が起きるか」が考慮されていない。

---

## 4. 修正計画

### 応急対応 — `window.open` を `window.location.href` に変更

`_blank` で新タブを開く代わりに、**同一タブで Twitter/LINE ページへ遷移する**。

```ts
// Before（現在）
export function shareToX(text: string, url: string): void {
  const trimmed = trimForX(text)
  window.open(
    `https://twitter.com/intent/tweet?...`,
    "_blank",
    "noopener,noreferrer"
  )
}

// After（修正後）
export function shareToX(text: string, url: string): void {
  const trimmed = trimForX(text)
  window.location.href =
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(trimmed)}&url=${encodeURIComponent(url)}`
}
```

**モバイルでの挙動（修正後）:**
```
1. ユーザーが「X」ボタンをタップ
2. window.location.href = twitterUrl → 同一タブが Twitter Share ページへ遷移
3. Twitter アプリが起動（OS リダイレクト）
4. ユーザーが Chrome へ戻る
5. Chrome は元の OgoRoulette ページ（ブラウザ履歴の前ページ）に戻る ✓
6. about:blank は発生しない ✓
```

この変更により `about:blank` タブ問題は解消される。

### 安全修正 — インライン `window.open` も統一

`lib/share-service.ts` の修正だけでは `result/_result-content.tsx` と `history/[id]/page.tsx` のインライン実装は直らない。
これら 4 箇所も同様に修正するか、`shareToX` / `shareToLine` を呼び出す形に統一する。

**推奨: インライン実装を share-service の関数に統一**

```tsx
// app/result/_result-content.tsx（修正後）
import { shareToX, shareToLine } from "@/lib/share-service"

// Before
window.open(`https://twitter.com/...`, "_blank", "noopener,noreferrer")

// After
shareToX(text, url)
```

### 理想修正 — シェア手段の整理

| シェア方法 | 修正方針 |
|-----------|---------|
| 「動画をシェア」ボタン | `navigator.share` → 変更不要（OS Sheet 使用） |
| X ボタン | `window.location.href` に変更 |
| LINE ボタン | `window.location.href` に変更 |
| navigator.share fallback（clipboard） | 変更不要 |

---

## 5. 実装時の注意点

### 触ると危険な箇所

- `shareToX` / `shareToLine` は複数箇所から呼ばれる。関数を直せば一括修正できるが、インライン実装は別途修正が必要
- `window.location.href` で遷移後、ユーザーが「戻る」を押すと OgoRoulette の元のページに戻る → シェアシートが再表示されるかどうか状態管理を確認すること

### ブラウザ差異

| ブラウザ | `window.open(_blank)` 挙動 | `location.href` 挙動 |
|---------|--------------------------|---------------------|
| Chrome モバイル | 新タブ + about:blank 残留 | 同一タブ遷移 → 戻るで戻れる |
| Safari モバイル | 新タブ（Safariは better） | 同一タブ遷移 → 戻るで戻れる |
| PC Chrome | 通常の新タブ（問題なし） | 同一タブ → 戻るで戻れる |

PC では `_blank` が快適だが、モバイル主体のプロダクトでは `location.href` が安全。

### `noopener,noreferrer` について

- `_blank` を使わないなら `noopener,noreferrer` も不要になる
- セキュリティ上の問題はなし（同一タブ遷移はリファラーコントロール不要）

---

## 6. 検証計画

### 修正後の実機確認

1. [ ] iPhone Chrome + X ボタン → X アプリが開く → Chrome 戻る → OgoRoulette が表示される
2. [ ] iPhone Chrome + LINE ボタン → LINE アプリが開く → Chrome 戻る → OgoRoulette が表示される
3. [ ] iPhone Safari + X ボタン → 同様に確認
4. [ ] Android Chrome + X/LINE ボタン → 同様に確認
5. [ ] PC Chrome + X ボタン → Twitter タブが開く（同一タブ遷移でも可）

### シェアキャンセル・失敗時

6. [ ] X アプリでシェアせずにキャンセル → Chrome に戻る → OgoRoulette が表示される
7. [ ] LINE アプリでキャンセル → Chrome に戻る → OgoRoulette が表示される

### 回帰確認

8. [ ] 「動画をシェア」（navigator.share）が引き続き正常動作する
9. [ ] 履歴詳細ページの X/LINE ボタンが動作する
10. [ ] 結果ページの X/LINE ボタンが動作する

---

## 7. 推奨アクション

### 最初にやること
`lib/share-service.ts` の `shareToX` / `shareToLine` の `window.open` を `window.location.href` に変更する。
これで share-sheet.tsx と winner-card.tsx は一括修正される。

### その次
`app/result/_result-content.tsx` と `app/history/[id]/page.tsx` のインライン `window.open` を `shareToX` / `shareToLine` 呼び出しに統一する（もしくは同様に `window.location.href` に変更）。

---

## タスク
- [ ] `lib/share-service.ts:shareToX` を `window.location.href` に変更
- [ ] `lib/share-service.ts:shareToLine` を `window.location.href` に変更
- [ ] `app/result/_result-content.tsx` のインライン window.open を修正
- [ ] `app/history/[id]/page.tsx` のインライン window.open を修正
- [ ] iPhone 実機確認（X / LINE ボタン → アプリ → 戻る）
- [ ] Android 実機確認
- [ ] PC 回帰確認

## 受け入れ条件
- X / LINE ボタン押下後に Chrome へ戻ると OgoRoulette のページが表示される
- `about:blank` タブが残らない
- シェアキャンセル後も正常に戻れる
- PC での動作に副作用がない

## 保存ファイル名
`docs/issues/issue-083-fix-share-return-about-blank.md`
