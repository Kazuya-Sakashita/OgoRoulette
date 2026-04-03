# ケーススタディ 002: 感情設計
## ― ISSUE-060: スピン後の祝祭感設計とAI共創による感情工学 ―

---

## 概要

| 項目 | 内容 |
|------|------|
| 対象ISSUE | ISSUE-060（感情設計）+ ISSUE-061〜065（関連デザイン） |
| 発生フェーズ | UX強化期（MVP完成後） |
| 問題の種類 | 機能はある。でも「感情」がない |
| 難易度 | ★★★☆☆（技術的難易度は低い。難しいのは「何を作るか」の定義） |
| 解決期間 | 約1週間（設計 + 実装 + 検証） |
| AIの貢献 | 感情設計の言語化・実装方針の提案・confetti ライブラリ選定 |

---

## 背景

### OgoRouletteの「勝負どころ」

OgoRouletteは飲み会の奢りをルーレットで決めるアプリ。アプリの価値は「誰が奢るかが決まる瞬間」に集約される。この一瞬が盛り上がれば、口コミが生まれる。地味なら「まあ使えるね」で終わる。

MVPリリース直後、友人グループで実際に使ってもらった。フィードバックは:

- 「便利だけど、なんか地味だね」
- 「当たった人が分かりにくい」
- 「これシェアしたいけど、スクショしても映えない」

**機能として完成しているのに、体験として不完成だった。**

### 感情設計とは何か

「感情設計」とは、ユーザーが特定の感情を体験するようにインターフェースを設計すること。OgoRouletteの場合:

- 当選者が分かった瞬間 → **驚き・興奮・笑い**
- 当選者以外 → **ほっとした感・次への期待**
- 全体として → **また使いたい・人に勧めたい**

この感情が生まれないと、アプリは「便利なツール」止まりになる。

---

## 問題

### ISSUE-060 が記録した具体的な問題

**当時の当選発表フロー（問題のある状態）:**
1. ルーレットホイールがスローダウン
2. 止まる
3. WinnerCard（当選者名のカード）がフェードインで表示される
4. 以上

**欠けていた演出:**

| 演出要素 | 現状 | 理想 |
|---------|------|------|
| confetti（紙吹雪） | なし | スピン完了時に画面全体で爆発 |
| 当選セグメントのハイライト | なし | グロー・パルスアニメーション |
| 当選者名のフォントサイズ | 小さい（text-xl程度） | 極大（text-5xl以上） |
| 背景演出 | なし | グラデーション・オーバーレイ |
| 音 | なし | ファンファーレ（オプション） |
| SNSシェア誘導 | なし | 「Xでシェア」ボタン |

**デザイン評価（gstack / design-shotgun レビューより）:**
> 「当選発表のインパクトが低い。スピンが止まった後、何が起きたか分かりにくい。祝祭感がゼロ。これではSNSシェアのモチベーションが生まれない。」

---

## 感情設計のプロセス

### Step 1: 「感じてほしい感情」を言語化する（ISSUE化）

AIに渡す前に、まず「このアプリで起こしたい感情」を言語化した。

**感情設計の目標:**
```
当選発表の瞬間に:
1. 当選者 → 「うわ、自分だ！」という驚きと笑い
2. 非当選者 → 「セーフ！次は頑張れ（笑）」という連帯感
3. 全員 → 「これはシェアしたい」という衝動

この3つの感情が同時に生まれると、口コミとSNSシェアが生まれる
```

### Step 2: AIへの感情設計相談

**プロンプト（実際に使ったもの）:**
```
OgoRouletteというアプリのルーレット結果発表画面を改善したいです。

現状: ルーレットが止まるとWinnerCardが表示されるだけ
目標: 「誰が奢るか決まった！」という感情的ハイライトを演出する

実現したいこと:
1. confettiアニメーション（ドラマチックな演出）
2. 当選者名を大きく見せる
3. SNSシェアへの自然な誘導

技術制約:
- Next.js 14 (App Router)
- TypeScript
- canvas-confettiライブラリは許容（バンドルサイズを確認する）

以下を提案してください:
1. 実装ライブラリの選定（canvas-confetti vs react-confetti の比較）
2. confetti の起動タイミングとパラメータ（particleCount, spread など）
3. WinnerCard の改善案（コピー・フォントサイズ・アニメーション）
4. SNSシェアテキストのフォーマット案
```

### Step 3: AIの提案

**ライブラリ比較（AIが提示）:**

| ライブラリ | バンドルサイズ | 制御性 | SSR対応 |
|-----------|------------|-------|--------|
| canvas-confetti | 約14KB | 高い | 要注意（ブラウザのみ） |
| react-confetti | 約20KB | 中程度 | 対応 |
| tsparticles | 約100KB+ | 非常に高い | 対応 |

AIの推薦: `canvas-confetti`（最軽量・制御性が高い・OgoRouletteの用途に最適）

**confetti パラメータ案（AIが複数提示）:**

```typescript
// パターン1: 爆発型（ドラマチック）
confetti({
  particleCount: 150,
  spread: 70,
  origin: { y: 0.6 }
})

// パターン2: 両側から降らせる
const end = Date.now() + 2000
const colors = ['#F97316', '#EC4899', '#FBBF24']
const frame = () => {
  confetti({ particleCount: 2, angle: 60, spread: 55, origin: { x: 0 }, colors })
  confetti({ particleCount: 2, angle: 120, spread: 55, origin: { x: 1 }, colors })
  if (Date.now() < end) requestAnimationFrame(frame)
}
frame()

// パターン3: シンプル（モバイル負荷を抑える）
confetti({ particleCount: 80, spread: 60, origin: { y: 0.5 } })
```

**WinnerCard 改善案（AIが提示）:**

```tsx
// Before（改善前）
<div className="text-xl font-bold">{winner.name}</div>

// After（AIの提案ベース）
<div className="flex flex-col items-center gap-4">
  <div className="text-6xl font-black tracking-tight">{winner.name}</div>
  <div className="text-2xl font-bold text-orange-400">
    🎰 今日のおごり確定！
  </div>
  <div className="text-base text-slate-400">
    {roomName} の {totalMembers}人の中から選ばれました
  </div>
</div>
```

**SNSシェアテキスト案（AIが複数生成）:**

```
案1（事実型）:
OgoRoulette で今日のおごりが決まりました 🎰
{roomName} → {winnerName} さんが奢ります！

案2（煽り型）:
{winnerName} さん、今日はありがとう 🎉
OgoRoulette が公平に決めました #飲み会 #ランチ

案3（拡散狙い）:
みんなで楽しく奢り決め 🎰 OgoRoulette
{winnerName} さんが当選 → ご馳走様になります🍜
https://ogo-roulette.vercel.app/
```

### Step 4: 人間による評価と取捨選択

AIの提案をそのまま採用せず、以下の観点で評価した:

**confetti パラメータの選択:**
- パターン1（爆発型）を採用。理由: OGPとしてスクリーンショットされる瞬間に最もインパクトがある
- ただし `particleCount: 150` はモバイルで重いため `100` に削減
- OgoRouletteのブランドカラー（オレンジ・ピンク・ゴールド）を colors に指定

**WinnerCard の変更:**
- AIの案は `text-6xl` だが、モバイル（375px幅）では名前が長い場合に折り返す
- `text-5xl` かつ `break-all` を設定。長い名前でも崩れない設計を優先
- 「🎰 今日のおごり確定！」のコピーは採用。ただし絵文字は可読性テストをしてから

**SNSシェアテキスト:**
- 案2（煽り型）の語感を採用しつつ、URL必須・ハッシュタグはオプション
- Twitterの140文字制限を計算に入れてAIに再調整を依頼

---

## 実装

### confetti の実装

```typescript
// components/winner-card.tsx

import confetti from 'canvas-confetti'

const CONFETTI_COLORS = ['#F97316', '#EC4899', '#FBBF24', '#ffffff']

export const triggerCelebration = () => {
  // メインの爆発
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: CONFETTI_COLORS,
  })

  // 少し遅れて二発目（余韻）
  setTimeout(() => {
    confetti({
      particleCount: 50,
      spread: 90,
      origin: { y: 0.5 },
      colors: CONFETTI_COLORS,
      startVelocity: 20,
    })
  }, 400)
}
```

### 呼び出しタイミング

```typescript
// app/room/[code]/play/page.tsx

const handleSpinComplete = useCallback((winner: Member) => {
  setPhase("result")
  setWinner(winner)
  triggerCelebration() // スピン完了 → 即座に confetti
}, [])
```

### WinnerCard の改善

```tsx
// components/winner-card.tsx

export function WinnerCard({ winner, totalMembers, roomName }: WinnerCardProps) {
  return (
    <div className="flex flex-col items-center text-center gap-6 py-8">
      {/* 当選者名（極大） */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-slate-400 uppercase tracking-widest">
          今日のおごり
        </p>
        <h1 className="text-5xl font-black tracking-tight text-white break-all leading-tight">
          {winner.name}
        </h1>
        <p className="text-xl font-bold text-orange-400">
          さん！
        </p>
      </div>

      {/* コンテキスト情報 */}
      <p className="text-sm text-slate-400">
        {roomName} の {totalMembers}人の中から選ばれました
      </p>

      {/* SNSシェアボタン */}
      <ShareButton winner={winner} roomName={roomName} />
    </div>
  )
}
```

---

## 検証

### 定性的な検証

**検証方法:** 友人グループ5名に改善前・改善後を見せて比較

| 項目 | 改善前 | 改善後 |
|------|------|------|
| 「すごい！」という反応 | 0/5名 | 4/5名 |
| スクショしたいと思う | 1/5名 | 5/5名 |
| 人に勧めたいと思う | 2/5名 | 5/5名 |
| アプリを記憶しているか（翌日確認） | 2/5名 | 4/5名 |

### gstackによる数値確認

confetti 追加後のLighthouseスコアへの影響:
- Performance: 変化なし（confetti は `canvas-confetti` = 14KB、lazy load）
- `canvas-confetti` は動的インポートでバンドルに含めない設計

```typescript
// 動的インポートでバンドルサイズへの影響ゼロ
const triggerCelebration = async () => {
  const confetti = (await import('canvas-confetti')).default
  confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
}
```

---

## AI活用方法（詳細）

### 効果的だったプロンプトパターン

**感情設計の言語化プロンプト:**
```
OgoRouletteの当選発表画面を設計します。

ユーザーが「この瞬間」に感じてほしい感情を3つ定義してください:
1. 当選者が感じること
2. 非当選者が感じること
3. SNSでシェアしたくなるのはどんな感情か

次に、その感情を引き出すUIの要素を具体的に提案してください。
（アニメーション・コピー・色・サイズ・タイミング）
```

**AIの回答（要約）:**

> 当選発表の「感情的ピーク」を作るには以下が必要:
>
> 1. **驚きの演出**: 予期せず降り注ぐ confetti がサプライズの感情を増幅させる
> 2. **当選者名の「主役化」**: テキストを大きくするだけで「見られている感」が生まれる
> 3. **コンテキストの強調**: 「N人の中から選ばれた」という文脈が運命感を生む
> 4. **シェアへのトリガー**: 「この瞬間を誰かに見せたい」という衝動を作るのは笑い・共感・驚き

このAIの分析を受けて「N人の中から選ばれた」というコピーを追加した。これは当初のISSUE-060には入っていなかった要素で、AIとの対話から生まれた改善点。

**バリエーション生成プロンプト:**
```
以下のSNSシェアテキストを5パターン生成してください。

条件:
- 日本語 Twitter/X 向け
- 140文字以内
- OgoRouletteのURL（https://ogo-roulette.vercel.app/）を含む
- {winnerName}・{roomName} を変数として使う
- 「飲み会・奢り・ランチ」のユーザー文脈を想定
- 拡散されやすいトーン（軽い・笑える・共感できる）

NG: 押しつけがましいCTA・過度な絵文字
```

---

## 感情設計の一般化した教訓

### 感情設計の3原則

**原則1: 感情を先に定義する**
「何を作るか」ではなく「どんな感情を起こすか」を先に言語化する。実装はその後。

**原則2: 感情のピークタイミングを特定する**
ユーザーが最も感情が動く瞬間はどこか。OgoRouletteでは「ルーレットが止まる瞬間」。このタイミングに演出を集中させる。

**原則3: 過剰演出は逆効果**
confetti を毎回出すと慣れる。「初回のみ」「大当たりのみ」などのレアリティ設計も検討する。OgoRouletteでは毎回出すことで「儀式感」を演出したが、これはユーザーリサーチの結果。

### AIと感情設計を共創する方法

AIは「感情の定義」と「その感情を引き出すUIの要素の列挙」が得意。一方、「この感情が実際に生まれるか」の判断は人間にしかできない。

**AIに聞くと良いこと:**
- 「この感情を引き出すUI要素をリストアップして」
- 「アニメーションのタイミングと速度の組み合わせを提案して」
- 「このコピー案を5パターン生成して」
- 「競合アプリの感情設計を分析して」

**人間が判断すること:**
- 「どの感情を優先するか」
- 「過剰演出と適切な演出の境界線」
- 「自社ブランドとのトーン整合性」
- 「実際にユーザーに見せて感情が生まれるか」

---

## 副次効果

感情設計の改善がもたらした想定外の効果:

**SNSシェア率の変化（推定）**
- 改善前: ほぼゼロ（計測困難）
- 改善後: 友人グループでのシェアが自然に発生

**セッション時間への影響**
- WinnerCard の滞在時間が増加（confetti を見る時間が増えた）
- 再スピンへの遷移が早くなった（「もう一回やりたい」が増加）

**バグ報告への副次効果**
- 感情が生まれたユーザーは「バグを報告したい」という動機を持つ
- 改善後に ISSUE として上がってきた細かいUXバグが増えた（良いサイン）

---

## 関連ドキュメント

- [ISSUE-060](../../issues/issue-060-design-result-celebration-missing.md) — 感情設計の元ISSUE
- [ISSUE-061](../../issues/issue-061-design-join-page-engagement.md) — 参加ページのエンゲージメント
- [ISSUE-066](../../issues/issue-066-sns-share-constraints.md) — SNSシェア制約の分析
- [ISSUE-067](../../issues/issue-067-share-payload-design.md) — シェアペイロード設計
- [ISSUE-068](../../issues/issue-068-share-message-templates.md) — シェアメッセージテンプレート
- [ケーススタディ 004](./case-004-lp-creation.md) — LP作成とコンテンツ共創

---

## 感情設計チェックリスト（再利用可能）

自分のアプリに感情設計を適用する際のチェックリスト:

```markdown
## 感情設計チェックリスト

### 1. 感情の定義
- [ ] 主要な「感情的ピーク」はどこか（何をしたとき）
- [ ] その瞬間にユーザーに感じてほしい感情は何か
- [ ] 競合アプリで同じシーンはどう演出されているか

### 2. 演出の設計
- [ ] 視覚的演出（アニメーション・色・サイズ）
- [ ] テキスト・コピーの感情トーン
- [ ] タイミング（いつ演出を出すか・何秒間か）
- [ ] 音（あるなし・デフォルトON/OFFか）

### 3. 技術実装
- [ ] バンドルサイズへの影響確認
- [ ] モバイルパフォーマンス確認
- [ ] アクセシビリティ（アニメーション無効化オプション）

### 4. 検証
- [ ] 5名以上のユーザーに見せて反応を記録
- [ ] 「シェアしたい」という反応が自然に出るか
- [ ] 過剰演出でないか（「うるさい」と思われないか）
```

---

*最終更新: 2026-04-02*
*ステータス: Phase 1 完了。Phase 2（WinnerCard 強化）は ISSUE-145 として継続*
