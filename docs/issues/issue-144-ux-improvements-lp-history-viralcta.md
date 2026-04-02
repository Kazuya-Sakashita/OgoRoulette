# ISSUE-144: UX改善 — ランディングページ・履歴ページ・バイラルCTAの強化

## 概要

gstack による品質評価（74/100）の結果を受けて、Adoption・Retention・Engagement に関わる 4 つの UX 改善を実装した。

---

## 背景

- gstack 評価で「ランディングページに実際のルーレット演出がない」「履歴ページでゲストがスピナーを長時間見る」「スピン後のバイラル拡散導線がない」という課題が特定された
- これらは初見ユーザーの離脱・リテンション低下・口コミ拡散力の低下につながっていた

---

## 変更内容

### 変更1: ランディングページのデモを実 RouletteWheel に置き換え

**該当箇所:** `app/page.tsx`

**変更前:**
- テキストバブル（「さくら」「たろう」「はな」）がシーケンシャルにハイライトされる簡易アニメーション
- アプリの本質的な演出が伝わらない

**変更後:**
- 実際の `RouletteWheel` SVG コンポーネントを使用
- スピンボタンで本物のルーレットが回転し、`onSpinComplete` で当選者を表示
- 初見ユーザーがアプリの体験を登録前に実感できる

```typescript
// 変更前: テキストバブル
const [demoHighlight, setDemoHighlight] = useState(-1)
// ... tick() 関数で index をシフト

// 変更後: 実コンポーネント
const [demoWinnerIdx, setDemoWinnerIdx] = useState<number>(0)
const handleDemoSpin = () => {
  const idx = Math.floor(Math.random() * DEMO_NAMES.length)
  setDemoWinnerIdx(idx)
  setDemoSpinning(true)
}
const handleDemoComplete = (name: string) => {
  setDemoSpinning(false)
  setDemoWinner(name)
}
```

---

### 変更2: ランディングページにルーム機能訴求セクションを追加

**該当箇所:** `app/page.tsx`

**変更前:** ルーム/QR機能への言及なし。ソロプレイの印象しか与えられていなかった。

**変更後:**
- 「友達みんなで参加できる」セクションを追加
- QR コードで全員が参加できる点を強調
- 「詳しく →」で `/how-to-use` へ誘導

---

### 変更3: 履歴ページのゲスト即時表示

**該当箇所:** `app/history/page.tsx`

**問題:**
- 初期状態: `loading=true`, `isLoggedIn=true`
- API が 401 を返すまでスピナーが表示され続ける（最大 2〜3 秒）
- ゲストは「壊れているのか」と誤認するリスクがあった

**修正:**
- API 呼び出し前に `supabase.auth.getSession()` でローカルセッションを確認
- セッションなし → `setIsLoggedIn(false)` + `setLoading(false)` を即時実行
- ゲスト UI（ローカル履歴 + ログイン CTA）がほぼ 0ms で表示される

```typescript
// 修正前: API の 401 を待つ
const res = await fetch("/api/sessions")
if (res.status === 401) setIsLoggedIn(false)

// 修正後: Supabase キャッシュで先読み（near-instant）
const { data: { session } } = await supabase.auth.getSession()
if (!session) {
  setIsLoggedIn(false)
  setLoading(false)
  return  // API 呼び出しをスキップ
}
```

---

### 変更4: WinnerCard にバイラル CTA「友達に教える」を追加

**該当箇所:** `components/winner-card.tsx`

**変更前:**
- スピン結果シェアボタン（X・LINE・動画）はあったが、アプリ自体を拡散する導線がなかった
- 既存のシェアは「この結果」の共有であり「このアプリ」の紹介ではない

**変更後:**
- 「次のアクション」セクションの直前に「友達に教える」バナーを配置
- Web Share API が使えるデバイスでは OS ネイティブのシェアシートを表示
- 非対応デバイスでは X（Twitter）での投稿にフォールバック

```typescript
if (navigator.share) {
  navigator.share({ title: "OgoRoulette", text, url }).catch(() => {})
} else {
  window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text + url)}`, "_blank", "noopener")
}
```

---

## 受け入れ条件

- [x] ランディングページでスピンボタンを押すと実際のルーレット SVG が回転する
- [x] ランディングページにルーム/QR 機能の紹介セクションが表示される
- [x] 未ログインユーザーが履歴ページを開いた際、スピナーが出ずに即座にゲスト UI が表示される
- [x] WinnerCard の詳細フェーズに「友達に教える」ボタンが表示される
- [x] 「友達に教える」ボタンは Web Share API 対応端末ではネイティブシェートを表示する
- [x] TypeScript 型エラーなし

---

## ステータス

✅ 完了（commit: 30c69bb）
