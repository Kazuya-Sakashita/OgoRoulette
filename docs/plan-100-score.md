# OgoRoulette 100点計画

**作成日:** 2026-04-02  
**現在スコア:** 65/100  
**目標スコア:** 100/100  
**調査方法:** gstack browse によるヘッドレスChrome実機評価（390px / 768px / 1280px）

---

## スコア現状と差分

| 評価軸 | 現在 | 目標 | 差分 |
|--------|------|------|------|
| UIの完成度 (25点) | 18 | 25 | +7 |
| UXフロー (25点) | 17 | 25 | +8 |
| 機能完成度 (25点) | 16 | 25 | +9 |
| 信頼性・プロ感 (25点) | 14 | 25 | +11 |
| **合計** | **65** | **100** | **+35** |

---

## Phase 1 — Quick Wins (65 → 80, +15点)
*実装コスト低・スコア影響大。各1〜2ファイル変更で完結。*

### ISSUE-143: デスクトップ サブページ縦余白 (+4点)

**対象ページ:** `/scan`, `/room/create`, `/join/[code]`, `/room/[code]`  
**問題:** 1280px幅でコンテンツカードが画面上部30%に収まり、下70%が空の暗い背景だけになる。プロが作ったサービスに見えない。  
**証拠:** gstack `responsive` で `scan-desktop.png` を確認。カードの下に広大な余白。  
**修正:** 各ページのラッパーに `min-h-screen flex items-center justify-center` を追加。

```tsx
// Before
<div className="mx-auto max-w-[390px] md:max-w-lg px-5 py-6">

// After
<div className="min-h-screen flex items-center justify-center px-5 py-6">
  <div className="w-full max-w-[390px] md:max-w-lg">
```

**対象ファイル:** `app/scan/page.tsx`, `app/room/create/page.tsx`, `app/join/[code]/page.tsx`, `app/room/[code]/page.tsx`  
**スコア寄与:** UIの完成度 +3 / 信頼性 +1

---

### ISSUE-144: スピン結果に設定金額を表示 (+3点)

**問題:** ユーザーが「金額を設定」で ¥5,000 を入力してSPINしても、結果カードに金額が一切表示されない。「誰が奢り」はわかるが「いくら払うか」がわからない。アプリの中心価値が結果画面で消えている。  
**証拠:** gstack browse でビルスプリット設定後にスピン → result card の text() に金額なし。  
**修正:** `home/page.tsx` の結果表示コンポーネントに `billAmount` と `perPersonAmount` を渡し、winner名の下に「¥5,000 を支払う（1人¥1,250）」を表示。

```tsx
// 結果カード内に追加
{billAmount > 0 && (
  <div className="mt-2 flex items-center justify-center gap-3 py-2 px-4 rounded-xl bg-primary/10">
    <div className="text-center">
      <p className="text-xs text-muted-foreground">支払い金額</p>
      <p className="text-2xl font-black text-primary">¥{billAmount.toLocaleString()}</p>
    </div>
    {participants.length > 1 && (
      <>
        <div className="w-px h-10 bg-white/10" />
        <div className="text-center">
          <p className="text-xs text-muted-foreground">割り勘（{participants.length}人）</p>
          <p className="text-lg font-bold text-foreground">
            ¥{Math.ceil(billAmount / participants.length).toLocaleString()}
          </p>
        </div>
      </>
    )}
  </div>
)}
```

**対象ファイル:** `app/home/page.tsx`（結果カードコンポーネント部分）  
**スコア寄与:** 機能完成度 +2 / UXフロー +1

---

### ISSUE-145: タブレット(768px) ホームレイアウト最適化 (+2点)

**問題:** 768px幅で `md:` ブレークポイントが発動し2カラムになるが、両カラムが狭すぎてルーレットがつぶれる（直径280pxのルーレットを384px幅カラムに収めている）。  
**証拠:** gstack `responsive` で `home-tablet.png` を確認。左カラムのルーレットが窮屈。  
**修正:** `md:` を `lg:` (1024px) に上げるか、タブレットではルーレットサイズを縮小。

```tsx
// home/page.tsx のブレークポイントを変更
// Before: md:grid md:grid-cols-2
// After:  lg:grid lg:grid-cols-2

// 合わせて RouletteWheel の size prop を動的に
<RouletteWheel size={isLargeScreen ? 320 : 240} ... />
```

**対象ファイル:** `app/home/page.tsx`  
**スコア寄与:** UIの完成度 +2

---

### ISSUE-146: ランディングページ FOIC 解消 (+2点)

**問題:** `mounted` state が `useEffect` で `true` になるまでの約300〜700ms、ページ全体が `opacity-0` になる。ヘッドレスブラウザの評価でほぼ真っ黒なスクリーンショットになっており、実ユーザーも初回ロード時に一瞬白紙を見る。  
**証拠:** gstack `goto http://localhost:3000` → `screenshot` で真っ黒な画面が撮影される。  
**修正:** `mounted` チェックを削除し、代わりに CSS `@keyframes fadeInUp` をグローバルに定義して適用。SSR/CSRで一貫したアニメーションになる。

```tsx
// Before: mounted による opacity-0 → opacity-100
<div className={`... ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

// After: CSS animation（SSR-safe）
<div className="animate-fade-in-up">
```

```css
/* globals.css に追加 */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(2rem); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up {
  animation: fadeInUp 0.5s ease-out forwards;
}
```

**対象ファイル:** `app/page.tsx`, `app/globals.css`  
**スコア寄与:** UIの完成度 +1 / 信頼性 +1

---

### ISSUE-147: 404 / エラーページのスタイリング (+2点)

**問題:** 存在しないURLにアクセスするとNext.jsのデフォルト404ページが表示され、アプリのデザインと全く異なる白背景の英語ページになる。ブランド体験が途切れる。  
**修正:** `app/not-found.tsx` を作成し、ダークテーマ + OgoRouletteロゴ + ホームへ戻るボタンを実装。

```tsx
// app/not-found.tsx (新規作成)
export default function NotFound() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-4">🎰</div>
      <h1 className="text-2xl font-bold text-foreground mb-2">ページが見つかりません</h1>
      <p className="text-muted-foreground mb-8">そのページは存在しないか、移動した可能性があります</p>
      <Link href="/home" className="btn-primary">ホームへ戻る</Link>
    </main>
  )
}
```

**対象ファイル:** `app/not-found.tsx`（新規）  
**スコア寄与:** UXフロー +1 / 信頼性 +1

---

### ISSUE-148: スピン結果デスクトップレイアウト改善 (+2点)

**問題:** 1280px幅でスピン結果オーバーレイが画面左半分に押し込まれ、右側が空になる。ホームの2カラムレイアウトと結果オーバーレイが干渉している。  
**証拠:** `plan_spin_desktop_result2.png` で確認。右側が完全に空。  
**修正:** 結果オーバーレイを `position: fixed` のフルスクリーンモーダル化し、デスクトップでは `max-w-lg` で中央配置。

```tsx
// 結果オーバーレイを fixed モーダルに変更
<div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto
                bg-background/95 backdrop-blur-sm pt-8 pb-16">
  <div className="w-full max-w-lg mx-auto px-4">
    {/* 結果カード */}
  </div>
</div>
```

**対象ファイル:** `app/home/page.tsx`  
**スコア寄与:** UIの完成度 +1 / UXフロー +1

---

## Phase 2 — Feature Completion (80 → 91, +11点)
*機能の完成度と信頼性を高める。中程度の実装コスト。*

### ISSUE-149: スケルトンローダー追加 (+3点)

**問題:** ページロード時にグループ一覧・プロフィールが一瞬 `null` or 空状態になり、コンテンツが「ガクッ」と出現する。  
**修正:** グループ一覧とプロフィールアバターにスケルトンUIを追加。`loading` prop が `true` の間は骨格を表示。

```tsx
// group-list.tsx: loading=true のとき
if (loading) {
  return (
    <section className="mb-5">
      <div className="h-4 w-24 bg-white/10 rounded animate-pulse mb-2" />
      {[1,2].map(i => (
        <div key={i} className="h-14 rounded-2xl bg-white/5 animate-pulse mb-2" />
      ))}
    </section>
  )
}
```

**対象ファイル:** `components/group-list.tsx`, `app/home/page.tsx`  
**スコア寄与:** 信頼性・プロ感 +2 / UXフロー +1

---

### ISSUE-150: SEO / OGP メタタグ (+3点)

**問題:** `/home`, `/room/[code]` 等にOGP metaがなく、SNSシェア時に画像・説明が出ない。「動画でシェア」「X/LINEでシェア」を機能として持っているのにリンクプレビューが貧弱。  
**修正:** `app/layout.tsx` に適切な `metadata` を設定し、各動的ページも `generateMetadata` を追加。

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  title: 'OgoRoulette — おごりをルーレットで決めよう',
  description: '飲み会・合コン・社内ランチ。おごりを公平にルーレットで決める無料アプリ',
  openGraph: {
    title: 'OgoRoulette',
    description: 'おごりをルーレットで決めよう',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
}
```

**対象ファイル:** `app/layout.tsx`, `app/home/page.tsx`, `public/og-image.png`（新規）  
**スコア寄与:** 信頼性・プロ感 +2 / 機能完成度 +1

---

### ISSUE-151: グループ保存フロー完成（スピン後CTA強化） (+2点)

**問題:** スピン結果に「このメンバーを次回も使う」ボタンがあるが、未ログイン時はログインを求められるだけ。ゲスト状態でもローカル保存できる体験にすれば定着率が上がる。  
**修正:** `localStorage` ベースのグループ保存を未ログインでも即時実行できるようにし、「保存しました！」フィードバックを追加。ログイン後にSupabaseへ同期する既存フローと連携。

**対象ファイル:** `app/home/page.tsx`, `lib/group-storage.ts`  
**スコア寄与:** 機能完成度 +1 / UXフロー +1

---

### ISSUE-152: ルームフロー E2E 動作確認・修正 (+3点)

**問題:** ルーム作成 → QR生成 → 参加 → SPIN のフローを本評価では未テスト。ルーム機能はアプリの差別化機能であり、バグがあれば大きなスコアロス。  
**修正手順:**
1. `/room/create` でルーム作成・名前入力・QR生成を確認
2. 生成されたQRコードの `/join/[code]` URLでゲスト参加フローを確認  
3. 参加者待機 → オーナーSPIN → 結果共有の一連フローをgstackで実行

**対象ファイル:** 問題発見次第対応  
**スコア寄与:** 機能完成度 +2 / UXフロー +1

---

## Phase 3 — Deep Polish (91 → 100, +9点)
*アクセシビリティ・パフォーマンス・細部の磨き込み。*

### ISSUE-153: アクセシビリティ基礎対応 (+3点)

**問題:** gstack snapshot でいくつかのボタンがラベルなし (`[button]` のみ)。特に「削除」ボタンが4つ並んでいるが、スクリーンリーダーには「どれを削除するのか」が不明。  
**修正:**
- 削除ボタンに `aria-label="さくらを削除"` を追加
- ルーレット回転中は `aria-busy="true"` を SPIN ボタンに設定
- 結果モーダル表示時は `aria-live="polite"` で当選者をアナウンス
- キーボード操作でメニューが閉じるよう `Escape` キー対応

**対象ファイル:** `components/group-list.tsx`, `app/home/page.tsx`  
**スコア寄与:** 信頼性・プロ感 +2 / UXフロー +1

---

### ISSUE-154: Core Web Vitals 最適化 (+3点)

**問題:** `network` コマンドで確認した通り、Next.js の JS バンドルが1MB超のチャンクを複数ロードしている。LCP・FID に影響する可能性。  
**修正:**
- ルーレットアニメーション用の Canvas ライブラリを dynamic import に変更
- `next/image` の priority 設定確認（ロゴは `priority` 済み）
- フォントの `display: swap` 設定確認

```tsx
// 重いコンポーネントを遅延ロード
const RouletteWheel = dynamic(() => import('@/components/roulette-wheel'), {
  ssr: false,
  loading: () => <div className="w-[320px] h-[320px] rounded-full bg-white/5 animate-pulse" />
})
```

**対象ファイル:** `app/home/page.tsx`  
**スコア寄与:** 信頼性・プロ感 +2 / UIの完成度 +1

---

### ISSUE-155: アニメーション品質向上 (+3点)

**問題:** ルーレットスピン後の「当選者登場」アニメーションが、スクリーンキャプチャーでは途中で止まったように見える瞬間がある（`sleep 5` で待っても中間状態を撮影することがある）。  
**修正:**
- スピン完了の Promise を適切に await して状態遷移を管理
- 当選者カードの `scale` + `opacity` 入場アニメーションをより滑らかに（`spring` イージング）
- ルーレット停止後 → 当選者表示までの「間」（300ms silence）を調整（ISSUE-122で定義済みのパターンを参照）

**対象ファイル:** `app/home/page.tsx`, `components/roulette-wheel.tsx`  
**スコア寄与:** 信頼性・プロ感 +2 / UIの完成度 +1

---

## 実装優先順位まとめ

| # | ISSUE | 難易度 | スコア | 対象ファイル数 |
|---|-------|--------|--------|---------------|
| 1 | ISSUE-143: サブページ縦余白 | 低 | +4 | 4 |
| 2 | ISSUE-144: 結果に金額表示 | 低 | +3 | 1 |
| 3 | ISSUE-145: タブレットレイアウト | 低 | +2 | 1 |
| 4 | ISSUE-146: FOIC解消 | 低 | +2 | 2 |
| 5 | ISSUE-147: 404ページ | 低 | +2 | 1 |
| 6 | ISSUE-148: 結果画面デスクトップ | 中 | +2 | 1 |
| 7 | ISSUE-149: スケルトンローダー | 中 | +3 | 2 |
| 8 | ISSUE-150: SEO/OGP | 中 | +3 | 2 |
| 9 | ISSUE-151: グループ保存CTA | 中 | +2 | 2 |
| 10 | ISSUE-152: ルームフローE2E | 中〜高 | +3 | TBD |
| 11 | ISSUE-153: アクセシビリティ | 中 | +3 | 2 |
| 12 | ISSUE-154: Core Web Vitals | 中 | +3 | 1 |
| 13 | ISSUE-155: アニメーション品質 | 高 | +3 | 2 |
| **合計** | | | **+35** | |

---

## スコア推移予測

```
Phase 1完了: 65 → 80  (ISSUE-143〜148: Quick Wins)
Phase 2完了: 80 → 91  (ISSUE-149〜152: Feature Completion)
Phase 3完了: 91 → 100 (ISSUE-153〜155: Deep Polish)
```

---

## 根拠となった gstack 観察

| 観察 | 影響ISSUE |
|------|-----------|
| scan-desktop.png: コンテンツ上部30%、下70%空 | ISSUE-143 |
| home-tablet.png: 768pxでルーレット圧迫 | ISSUE-145 |
| plan_01_landing_desktop.png: 真っ黒（opacity-0） | ISSUE-146 |
| billsplit_result text: 設定金額がresultに不在 | ISSUE-144 |
| spin_desktop_result2.png: 結果カードが左寄り細幅 | ISSUE-148 |
| snapshot: `[button]` ラベルなし削除ボタン×4 | ISSUE-153 |
| network: 1MB超JSチャンク複数 | ISSUE-154 |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**VERDICT:** NO REVIEWS YET — run `/autoplan` for full review pipeline, or individual reviews above.
