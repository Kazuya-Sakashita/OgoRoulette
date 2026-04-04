# ルーレットアプリに「録画 + SNSシェア機能」を実装してみたら、想像以上に難しかった話

> **公開日**: 2026-03-24
> **タグ**: React / Next.js / MediaRecorder / Canvas / iOS Safari / SNSシェア / UX設計

---

## 目次

1. [はじめに ── なぜこの機能を作ったか](#1-はじめに)
2. [やりたかったこと ── 理想の体験](#2-やりたかったこと)
3. [最初の壁 ── SVG は録画できない](#3-最初の壁--svg-は録画できない)
4. [解決策 ── 録画専用の隠しキャンバスを作る](#4-解決策--録画専用の隠しキャンバスを作る)
5. [次の壁 ── iOS Safari との格闘](#5-次の壁--ios-safari-との格闘)
6. [状態管理の複雑さとの格闘](#6-状態管理の複雑さとの格闘)
7. [「録画できる」と「バズる動画」は別物だった](#7-録画できるとバズる動画は別物だった)
8. [シェア導線の設計 ── タイミングがすべて](#8-シェア導線の設計)
9. [学んだこと](#9-学んだこと)
10. [まとめ](#10-まとめ)
11. [付録: タイトル案・コピー案・SNS投稿文](#11-付録)

---

## 1. はじめに

[OgoRoulette](https://ogoroulette.app) は「誰が奢るかをルーレットで決める」スマホ向け Web アプリです。

飲み会の席で「SPIN」ボタンを押すと派手にルーレットが回り、当たった人の名前が映画のような演出で発表される。それだけのアプリですが、実際に使ってみると**その場が異様に盛り上がります**。

でも、ずっと気になっていることがありました。

**「その盛り上がりが、その場で消えてしまう」**

スクリーンショットでは「誰かが当たった結果」しか残せない。ルーレットが回って誰かが悲鳴を上げる「あの瞬間」は、写真では伝えられない。

そこで思ったのです。「回転中から当選発表まで丸ごと動画にして、そのまま TikTok や X に投稿できたら絶対バズる」と。

こうして始まった「録画 + SNSシェア機能」の実装。結論から言うと、**想像の 3 倍難しかった**です。

---

## 2. やりたかったこと

理想の体験はシンプルです。

```
① SPIN ボタンを押す
② 自動で録画が始まる（ユーザーは何もしなくていい）
③ ルーレットが回る
④ 当選者が派手に発表される
⑤ 「動画でシェア」を 1 タップで完了
```

重要なのは **② の「自動で」** です。

「画面録画してください」とユーザーに手間をかけさせない。飲み会の席でシステムダイアログが出てくるような体験は絶対に避けたい。「気づいたら動画ができていた」──それが理想でした。

また、動画のフォーマットも最初から決めていました。TikTok や Instagram Reels に上げやすい **9:16 縦型** にする。横長の Web 画面をそのまま録画するのではなく、SNS に最適化された構成で録画する。

---

## 3. 最初の壁 ── SVG は録画できない

### `canvas.captureStream()` を使えばいい、と思っていた

ブラウザで動画を録画するとき、最初に思いつくのが `canvas.captureStream()` + `MediaRecorder` の組み合わせです。

```typescript
// Canvas の描画内容をリアルタイムでキャプチャ
const stream = canvas.captureStream(30) // 30fps
const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" })
recorder.start()
```

`captureStream()` は Canvas 要素の描画内容を動画ストリームとして取り出せます。このストリームを `MediaRecorder` に渡せば、そのまま動画ファイルにできる。シンプルで強力な API です。

ところが、**OgoRoulette のルーレットは Canvas ではありませんでした**。

### ルーレットは SVG + Framer Motion だった

実装を見てみると、ルーレットは次のような構造でした。

```tsx
// components/roulette-wheel.tsx
const rotation = useMotionValue(0)

return (
  <motion.svg
    width={size}
    height={size}
    style={{ rotate: rotation }}  // Framer Motion で CSS rotate を制御
  >
    {/* セグメント（path 要素）*/}
    {Array.from({ length: segments }).map((_, index) => (
      <motion.g key={index}>
        <path d={createSegmentPath(index)} fill={SEGMENT_COLORS[index % SEGMENT_COLORS.length]} />
      </motion.g>
    ))}
    {/* 参加者名テキスト */}
    {Array.from({ length: segments }).map((_, index) => (
      <text key={`text-${index}`} ...>{participants[index]}</text>
    ))}
  </motion.svg>
)
```

SVG 要素を CSS の `transform: rotate()` で動かしているだけです。Canvas は一切使っていない。

`captureStream()` が使えるのは `<canvas>` 要素だけです。SVG には使えません。

### 他の選択肢を検討した

3つの選択肢を考えました。

| 方法 | メリット | デメリット |
|------|---------|-----------|
| `getDisplayMedia()` | 画面全体を録画できる | ユーザーの許可ダイアログが必要。飲み会で使えない |
| `html2canvas` | DOM をそのまま画像化できる | 30fps で動かすには遅すぎる（モバイルでは現実的でない）|
| **録画専用の隠し Canvas を作る** | 許可不要・高速・デザイン自由 | ビジュアルの再実装が必要 |

`getDisplayMedia()` は論外でした。スマホで「録画する対象を選んでください」というシステムダイアログが出てきたら、飲み会の盛り上がりが一気に冷めます。

`html2canvas` は魅力的でしたが、パフォーマンスが問題でした。DOM → Canvas の変換を 1 フレームあたり 33ms（30fps なら）以内に完了するのは、モバイルのハードウェアでは難しい。アニメーションがカクカクになります。

**録画専用の隠し Canvas を作る方法**を選びました。

---

## 4. 解決策 ── 録画専用の隠しキャンバスを作る

### アーキテクチャ

```
ユーザーに見えるUI（DOM / SVG）
        ↕ wheelRotationRef（毎フレーム回転角を同期）
録画用 Canvas（画面外 540×960）
        ↕ canvas.captureStream(30fps)
MediaRecorder → WebM / MP4 Blob
        ↕
ShareSheet（動画プレビュー + シェアボタン）
```

ユーザーには普通の DOM/SVG のルーレットを見せます。その裏側で、**画面外に配置した専用の Canvas** にルーレットと演出を描き直し、`captureStream()` で録画します。

```tsx
// components/recording-canvas.tsx
<canvas
  ref={canvasRef}
  width={540}   // 9:16 の縦型
  height={960}
  style={{
    position: "fixed",
    left: -10000,  // 画面外に配置（ユーザーには見えない）
    top: -10000,
    pointerEvents: "none",
  }}
/>
```

Canvas は DOM に存在していますが、画面の遥か外側にあります。ユーザーには見えないけれど、`captureStream()` は正常に動作します。

### 回転角の同期 ── Ref が重要

「録画 Canvas にルーレットを再描画する」ためには、本物のルーレットが「今何度回転しているか」をリアルタイムで知る必要があります。

Framer Motion の `useMotionValue` には `.on("change", callback)` という API があります。値が変わるたびにコールバックが呼ばれます。

```typescript
// components/roulette-wheel.tsx（追加した部分）
useEffect(() => {
  if (!wheelRotationRef) return
  // rotation の値が変わるたびに ref を更新
  return rotation.on("change", (v) => {
    wheelRotationRef.current = v  // ref に書き込むだけ
  })
}, [rotation, wheelRotationRef])
```

ここで **State ではなく Ref** を使っているのが重要なポイントです。

もし `useState` を使ってしまうと、回転アニメーション中（毎フレーム値が変わる）に毎回 React の再レンダリングが走り、アニメーションがガクガクになります。

`useRef` なら React の再レンダリングを発生させずに値を更新できます。録画 Canvas 側は `requestAnimationFrame` のループ内でこの `ref` を読むだけです。

```typescript
// components/recording-canvas.tsx
const loop = () => {
  const rotDeg = wheelRotationRef.current  // ref から読む（re-render なし）
  drawWheel(ctx, rotDeg, participants, ...)
  rafId = requestAnimationFrame(loop)
}
```

### Canvas 2D でルーレットを再実装する

SVG の `<path>` で描いていたセグメントを Canvas 2D の `arc()` と `lineTo()` で再実装します。

```typescript
function drawWheel(
  ctx: CanvasRenderingContext2D,
  rotDeg: number,      // 現在の回転角（度数）
  participants: string[],
  winnerIdx: number | null,
  phase: RecordingPhase
) {
  const n = participants.length
  const segAngle = (2 * Math.PI) / n  // 1セグメントの角度（ラジアン）
  const outerR = WR * 0.87  // 外側の半径
  const innerR = WR * 0.22  // 中心の穴の半径

  ctx.save()
  ctx.translate(WCX, WCY)               // 中心に移動
  ctx.rotate((rotDeg * Math.PI) / 180)  // 回転を適用

  for (let i = 0; i < n; i++) {
    const startA = i * segAngle - Math.PI / 2  // 上から始まるよう -90度
    const endA   = startA + segAngle

    // ドーナツ型のセグメントを描く
    ctx.beginPath()
    ctx.moveTo(innerR * Math.cos(startA), innerR * Math.sin(startA))
    ctx.lineTo(outerR * Math.cos(startA), outerR * Math.sin(startA))
    ctx.arc(0, 0, outerR, startA, endA)
    ctx.lineTo(innerR * Math.cos(endA), innerR * Math.sin(endA))
    ctx.arc(0, 0, innerR, endA, startA, true)  // 内側を逆向きに
    ctx.closePath()

    ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length]
    ctx.fill()
  }

  ctx.restore()
}
```

SVG の `path` 要素で書いていたものが Canvas の命令に変わるだけで、計算式は全く同じです。`ctx.rotate()` をかけた状態で描画するので、`rotDeg` を変えるだけでルーレットが回ります。

---

## 5. 次の壁 ── iOS Safari との格闘

Canvas の問題を解決して「動いた！」と思ったら、次の問題が待っていました。

### `video/webm` が iOS Safari で使えない

`MediaRecorder` が対応しているフォーマットはブラウザごとに違います。

```
Chrome（Android / Desktop）: video/webm;codecs=vp9 ✅
Safari（iOS / macOS）:        video/webm ❌ / video/mp4 ✅
Firefox:                      video/webm ✅
```

Chrome の気持ちで `video/webm` を決め打ちにしていたら、iOS Safari では録画が完全に動きません。エラーも出ず、ただ動画ができないだけです。

### 解決：サポートされているフォーマットを順番に試す

`MediaRecorder.isTypeSupported()` で事前に確認できます。

```typescript
// lib/video-recorder.ts
export function getSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return ""

  const candidates = [
    "video/webm;codecs=vp9,opus",  // Chrome Desktop/Android（最高品質）
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",                    // iOS Safari はここに落ちる
  ]

  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? ""
}
```

そして、**録画がそもそも使えない環境には静かに諦めてもらう**設計にしました。

```typescript
export function canRecord(canvas?: HTMLCanvasElement | null): boolean {
  if (typeof window === "undefined") return false
  if (typeof MediaRecorder === "undefined") return false
  if (!canvas?.captureStream) return false
  return getSupportedMimeType() !== ""
}
```

`canRecord()` が `false` なら、シェアシートを開いたときに「動画でシェア」ボタンが出ないだけ。エラーメッセージは一切表示しません。ユーザーは「この端末では動画が作れない」とすら気づかず、通常の URL シェアができます。

### iOS でのファイルシェア問題

動画が録れても、シェアできなければ意味がありません。`navigator.share()` で動画ファイルを渡せる `files` オプションは、**iOS 15 以上** でないと動きません。

```typescript
const handleShare = async () => {
  const file = new File([blob], "ogoroulette.webm", { type: blob.type })

  // 1. ファイルシェア（iOS 15+ / Android Chrome）
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: "...", text: "..." })
    return  // 成功したらここで終わり
  }

  // 2. URL + テキストシェア（Web Share API 全般）
  if (navigator.share) {
    await navigator.share({ title: "...", text: "...", url: shareUrl })
    return
  }

  // 3. クリップボードコピー（最後の手段）
  await navigator.clipboard.writeText(`${text}\n${shareUrl}`)
  setCopied(true)
}
```

「できることを確認してからやる」──これが iOS Safari 対応の基本です。`navigator.canShare({ files: [file] })` で事前チェックを忘れると、対応していない端末でエラーが発生します。

---

## 6. 状態管理の複雑さとの格闘

録画機能を追加したことで、コンポーネントの状態が一気に増えました。

**追加前:**
```typescript
const [isSpinning, setIsSpinning]   = useState(false)
const [winner, setWinner]           = useState(null)
const [countdown, setCountdown]     = useState(null)
const [showConfetti, setShowConfetti] = useState(false)
```

**追加後（録画関連のみ）:**
```typescript
const [recordingPhase, setRecordingPhase] = useState<RecordingPhase>("idle")
const [recordedBlob, setRecordedBlob]     = useState<Blob | null>(null)
const [showShareSheet, setShowShareSheet] = useState(false)

const recordingCanvasRef = useRef<HTMLCanvasElement>(null)
const wheelRotationRef   = useRef<number>(0)
const recorderRef        = useRef(new VideoRecorder())
const revealTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
```

State だけでなく Ref も増えました。ここで大事な設計原則があります。

**「画面の表示に影響しない値は State にしない」**

`wheelRotationRef`（回転角）、`recorderRef`（MediaRecorder のインスタンス）、`revealTimerRef`（タイマーの ID）は React の再レンダリングを必要としません。Ref にすることで、アニメーションへの影響をゼロにできます。

### 録画フェーズの State Machine

録画の「今何をしているか」を明確にするため、専用の型を定義しました。

```typescript
type RecordingPhase = "idle" | "countdown" | "spinning" | "reveal" | "done"
```

各フェーズで何が起きるかを図にすると：

```
[SPIN ボタン押下]
        ↓
idle → countdown     ← Canvas が 3→2→1 を描画開始
        ↓ 3秒後
countdown → spinning ← MediaRecorder.start() を呼ぶ
        ↓ 4.5秒後（ルーレット停止）
spinning → reveal    ← Canvas が当選者発表アニメを開始
        ↓ 2.5秒後
reveal → done        ← MediaRecorder.stop() → Blob 生成
```

この State Machine を最初から設計したことで、「今このフェーズで何をすべきか」が明確になり、条件分岐のバグが減りました。

例えば、録画の開始タイミング：

```typescript
// カウントダウンが終わったタイミング（3秒後）で録画を開始
countdownTimersRef.current = [
  setTimeout(() => setCountdown(2), 1000),
  setTimeout(() => setCountdown(1), 2000),
  setTimeout(() => {
    setCountdown(null)
    setIsSpinning(true)
    setRecordingPhase("spinning")  // フェーズ遷移

    // このタイミングで録画を開始（カウントダウンも動画に含む）
    if (recordingCanvasRef.current && canRecord(recordingCanvasRef.current)) {
      recorderRef.current.start(recordingCanvasRef.current)
    }
  }, 3000),
]
```

「カウントダウンを Canvas に描いてから録画を開始する」のではなく、「Canvas の描画はフェーズ変更で制御し、録画はその後から開始する」──この分離が重要です。

---

## 7. 「録画できる」と「バズる動画」は別物だった

技術的な問題が全部解決したとき、最初に録れた動画がこれでした。

「ルーレットが回って止まった、それだけの 10 秒の動画」

誰が当たったのか分かりにくい。アプリ名が入っていない。当選者の名前が小さい。見た人が「何これ？」となる。これでは誰もシェアしません。

### バズる動画の構成を考える

TikTok や Instagram Reels を研究すると、短い動画には共通した「構成」があることがわかります。

| 時刻 | 役割 | 感情 |
|------|------|------|
| 0〜3秒 | つかみ・緊張感 | ドキドキ |
| 3〜8秒 | 展開・盛り上がり | ワクワク |
| 8〜10秒 | クライマックス | 爆発・笑い |

OgoRoulette の動画を、この構成に当てはめました。

```
0〜3秒（countdown）:
  画面が暗くなり「運命のカウントダウン」のテキスト
  大きな「3」→「2」→「1」がズームイン
  ← 緊張感を演出

3〜7.5秒（spinning）:
  ルーレットが勢いよく回転
  背景に参加者の名前がふわふわと浮かぶ
  右上に小さく「● REC」が点滅
  ← ドキドキを維持

7.5〜10秒（reveal）:
  ルーレットが止まる
  👑 の絵文字がドロップ
  当選者名が小さいサイズからズームイン
  「本日の奢り担当！」のテキスト
  ← 爆発的な盛り上がり
```

Canvas の描画コードで「時間ベースのアニメーション」を実装します。

```typescript
function drawReveal(
  ctx: CanvasRenderingContext2D,
  winner: string,
  winnerColor: string,
  revealSec: number  // reveal フェーズ開始からの経過秒
) {
  // 0.65秒かけて 0→1 に正規化
  const p = Math.min(revealSec / 0.65, 1)
  if (p <= 0) return

  // 名前を 40% → 100% にスケールイン（zoom-in 演出）
  const scale   = 0.4 + p * 0.6
  const nameSz  = Math.round(66 * scale)
  const nameY   = WCY + WR + 120

  ctx.font         = `900 ${nameSz}px sans-serif`
  ctx.textAlign    = "center"
  ctx.textBaseline = "middle"
  ctx.fillStyle    = "white"
  ctx.globalAlpha  = p
  ctx.shadowBlur   = 52 * p      // p が大きくなるほどグローが強まる
  ctx.shadowColor  = winnerColor
  ctx.fillText(`${winner}さん`, W / 2, nameY)
}
```

`revealSec`（経過秒）を `0→1` に正規化した `p` を使ってすべてのアニメーションを制御するのがポイントです。スケール、透明度、シャドウブラーすべてが `p` に連動するので、一貫したイージングになります。

### ブランディングを入れる

SNS でシェアされたとき、見た人に「どのアプリ？」とわからせる必要があります。Canvas に常時表示するブランド要素を定義しました。

```typescript
function drawBranding(ctx: CanvasRenderingContext2D) {
  // 上部バー
  ctx.fillStyle = "rgba(0,0,0,0.38)"
  ctx.fillRect(0, 0, W, 66)

  // アプリ名
  ctx.font      = "bold 25px sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.92)"
  ctx.textAlign = "left"
  ctx.fillText("🎰 OgoRoulette", 20, 33)

  // 日付
  const today = new Date().toLocaleDateString("ja-JP", {
    month: "numeric", day: "numeric", weekday: "short",
  })
  ctx.font      = "17px sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.42)"
  ctx.textAlign = "right"
  ctx.fillText(today, W - 18, 33)

  // 下部ハッシュタグ
  ctx.font      = "bold 19px sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.28)"
  ctx.textAlign = "center"
  ctx.fillText("#OgoRoulette", W / 2, H - 26)
}
```

アプリ名・日付・ハッシュタグを常に表示することで、シェアされた動画が自然と宣伝になります。

---

## 8. シェア導線の設計

動画が完成したら、ユーザーにシェアしてもらう必要があります。最初に考えた実装は「動画が完成したら自動的にダイアログを開く」でした。

**これは失敗でした。**

当選者発表の感動の瞬間に、シェアダイアログが割り込んで出てくる。「誰が奢りになった！」という気持ちが最高潮のときに、「シェアしますか？」と聞かれる。タイミングが最悪でした。

### 解決：体験の流れに自然に組み込む

OgoRoulette の WinnerCard には 2 つのフェーズがあります。

- **Phase A（4秒間）**: 全画面の映画的演出で当選者を発表
- **Phase B（詳細シート）**: 支払い内訳・シェアボタンを表示するボトムシート

ユーザーの気持ちの変化：

```
Phase A: 「えー！◯◯くんが当たった！やばい！」（感情の爆発）
    ↓ 4秒後、自動的に Phase B へ
Phase B: 「どんな内訳になってるんだろ？シェアしようかな」（落ち着いた判断）
```

**Phase B に動画シェアボタンを置く**のが正解でした。

```tsx
// components/winner-card.tsx（Phase B の先頭に追加）
{videoBlob && onShareVideo && (
  <motion.button
    onClick={onShareVideo}
    className="w-full h-14 rounded-2xl mb-5 font-bold text-base text-white"
    style={{
      background: `linear-gradient(135deg, ${color}, #EC4899)`,
      boxShadow: `0 4px 24px ${color}50`,
    }}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.2 }}  // シートが開いてから少し遅れて表示
  >
    🎬 動画でシェア
  </motion.button>
)}
```

`delay: 0.2` で「ちょっと遅れて現れる」演出も重要です。シートが開いた瞬間から全部見えていると、目が追いつかない。少し遅れて「あ、動画もある」と気づく体験の方が自然です。

### シェアシートの設計

「動画でシェア」ボタンを押したあとに表示されるシェアシート（`share-sheet.tsx`）のデザインも意識しました。

```
+---------------------------+
|  動画を保存・シェア         |
|  ◯◯さんが奢りに決定！      |
|                           |
|  [縦型動画プレビュー]       |  ← autoplay ループで動いている
|                           |
|  [    SNSでシェア    ]     |  ← Primary CTA（グラデーション）
|  [ 保存 ][ X ][ LINE ]    |  ← Secondary
|  [ もう一度回す ]          |
+---------------------------+
```

ポイントは「動画が動いているプレビュー」です。静止画ではなく `<video autoPlay muted loop playsInline>` で動かします。「これがシェアされる動画だ」という確認ができ、「シェアしたい」という気持ちを高めます。

---

## 9. 学んだこと

### 一番大事だったこと：「録画対象とユーザー体験を分ける」

「録画する画面」と「ユーザーに見せる画面」を分けることは、最初は「余計な実装が増える」と感じました。しかし結果的に、この分離が多くのメリットをもたらしました。

- **動画の構成を自由に設計できる**: 9:16 にする、ブランドを入れる、SNS映えする演出を加えるなど
- **既存の UI を一切変えない**: 録画機能を追加しても、ルーレットの動きや見た目は変わらない
- **グレースフルデグラデーション**: 録画できない端末でも UI が壊れない

「機能を追加する」ことと「機能のために体験を変える」ことは違います。理想は前者です。

### 想定外だったこと：フォーマットの多様性

「WebM で統一すれば OK」と思っていましたが、iOS Safari が WebM に対応していないことを開発中に知りました。単体のフォーマットを決め打ちにする発想が間違いでした。

「サポートされているものを使う」──ブラウザ間の差異に対応するときの基本原則を、改めて実感しました。

### 想定外だったこと②：State Machine を後回しにしたコスト

録画フェーズの型（`RecordingPhase`）は途中から定義しました。最初は「`isRecording` という boolean で十分では？」と思っていたのです。

実際には `idle / countdown / spinning / reveal / done` という 5 つの状態があり、それぞれで描画内容・録画のオン/オフ・UI の表示が変わります。boolean ひとつでは表現できません。

**複雑な状態を持つ機能は、最初に State Machine を設計してから実装を始める**──これが今回最大の教訓です。

### 次に活かせること

1. **録画対象とユーザー向けUIを独立させる設計パターン**は、ゲームのリプレイ機能や、デモ動画の自動生成にも応用できる
2. **段階的 fallback の実装パターン**（`canShare → share → clipboard`）は、Web API を扱うどんな場面でも使える
3. **時間ベースのアニメーション**（`(Date.now() - startMs) / 1000` で経過秒を計算）は React の State ではなく Canvas や WebGL で扱うべき

---

## 10. まとめ

「ルーレットの録画機能」はシンプルに見えて、いくつもの落とし穴がありました。

**技術的な課題:**
- `captureStream()` は Canvas にしか使えない → 隠し Canvas を別途用意する
- iOS Safari は WebM 非対応 → 対応フォーマットを動的に検出する
- Framer Motion の値同期 → State ではなく Ref で行う

**設計的な課題:**
- 状態が多い → State Machine を先に設計する
- 録画タイミングの制御 → フェーズ遷移で管理する

**UX 的な課題:**
- バズらない動画 → 構成を意識した演出設計が必要
- 使われないシェアボタン → 体験の流れに自然に組み込む

技術的な実装を終えた後に、「録画できる機能」と「シェアしたくなる体験」の間に大きな距離があることを実感しました。

この距離を埋めるのは技術ではなく、**ユーザーの気持ちと行動の流れを設計すること**です。

飲み会で誰かがルーレットを回して、当たった人が叫んで、みんなが笑う──その瞬間が動画になって X や TikTok に流れていく体験を、これからも磨いていきたいと思います。

---

## 11. 付録

### ① タイトル案（5つ）

1. **「ルーレットアプリに録画機能を入れたら、Canvas問題から始まる泥沼にはまった話」**
   - 「泥沼」が共感を呼びやすい

2. **「`canvas.captureStream()`だけじゃ録れない ── SVGアニメーションを動画にする実装方法」**
   - 検索ニーズに刺さるタイトル

3. **「MediaRecorder入門2025：iOS Safari対応から"バズる動画設計"まで全部やった」**
   - 網羅感でクリックされやすい

4. **「画面録画ボタンを押させずに録画する ── ユーザー体験を壊さない録画機能の設計」**
   - UX 観点のエンジニアに刺さる

5. **「10秒でSNSシェアしたくなる動画をブラウザだけで作る技術と設計の話」**
   - SNS マーケティングに関心があるエンジニア向け

---

### ② サムネ用コピー（5つ）

1. **`SVGは録画できない`** ← 短くて衝撃的
2. **`iOS Safariが殺しにくる`** ← 共感
3. **`録画 ≠ バズる体験`** ← 逆説
4. **`隠しCanvasで解決した`** ← 解決策を煽る
5. **`State Machineを後回しにした代償`** ← 失敗談

---

### ③ SNS 投稿文（3パターン）

**X（旧 Twitter）**
```
ルーレットアプリに録画→SNSシェア機能を実装したら
想像の3倍大変でした

主な落とし穴：
・SVGはcaptureStream()できない問題
・iOS SafariはWebM非対応問題
・「録画できる」≠「バズる動画」問題

State Machineを最初に設計しなかったのが最大の反省

実装記録を書きました👇
#フロントエンド #MediaRecorder #React #iOS
```

**Qiita 投稿文**
```
Next.js + Framer Motion 製のルーレットアプリに、
MediaRecorder を使った録画 + SNSシェア機能を実装しました。

## この記事で書いたこと

- SVGベースのアニメーションを録画する方法
  （captureStream()の制約と隠しCanvasアーキテクチャ）
- iOS Safari のコーデック問題と段階的 fallback 設計
- Framer Motion の MotionValue を State にしてはいけない理由
- 「録画できる」と「シェアしたくなる体験」の差を埋めたこと
- State Machine で複雑な状態を整理する方法

実装した人の「なるほど」になれば嬉しいです。
```

**Zenn 投稿文**
```
飲み会で誰が奢るかをルーレットで決めるWebアプリを作っています。

先日「ルーレットが回る瞬間をそのまま動画にしてSNSに投稿できたら
バズる」という理由だけで録画機能を実装しました。

SVGは直接録画できなかった話、iOS Safariと格闘した話、
「動画が撮れた」のに「全然バズらない」と気づいた話など、
実際にぶつかった課題とその解決策を書きました。

コードを書く前にState Machineを設計すべきだったという後悔も
正直に書いています。
```
