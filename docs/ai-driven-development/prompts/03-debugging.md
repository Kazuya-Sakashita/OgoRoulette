# デバッグフェーズ プロンプト集

## このカテゴリについて

「動かない」「おかしい」と感じたときに使うプロンプト群。  
AIへのバグ報告は「情報量」が品質を決める。エラーログ・再現手順・試したこと・関連コードをセットで渡すことで、的外れな修正案を防ぎ最短で根本原因にたどり着ける。  
OgoRoulette で実際に発生したバグ（競合状態・無限ループ・アニメーション同期ズレ）を元にした実戦的なプロンプト集。

---

## プロンプト一覧

### エラーログ解析
**使うタイミング**: コンソールやサーバーログにエラーが出ているとき。まず原因の仮説を3つもらう
**効果**: エラーメッセージの意味・根本原因・修正方針を構造化して得られる

```
バグの調査と修正方針の提案をお願いします。コードの修正は提案のみにしてください。実際の変更は私が確認してから行います。

---

## 症状（What）
[何が起きているか。例: ルーレットをスピンしても画面が更新されず、結果が表示されない]

## 再現条件（When / How）
- 再現手順:
  1. [例: ブラウザでアプリを開く]
  2. [例: ルームに3人が参加した状態でオーナーがSPINボタンを押す]
  3. [例: ルーレットが回転するが、結果モーダルが表示されない]
- 再現率: [例: 100% / 約30% / 特定条件でのみ]
- 発生環境: [例: Chrome 123 / Safari 17 / iOS Safari / 本番のみ / ローカルでは発生しない]

## 期待する動作
[本来どうなるべきか。例: スピン完了後に当選者名を表示するモーダルが開く]

## エラーログ
```
[コンソールやターミナルに出ているエラーをそのままペースト。なければ「エラーなし」と記載]
例:
TypeError: Cannot read properties of undefined (reading 'winnerId')
    at RouletteWheel.tsx:142
    at commitHookEffect (react-dom.development.js:23189)
```

## 関連コード
```tsx
// ファイルパス: app/room/[code]/play/page.tsx（該当箇所のみ）
const handleSpinComplete = (winnerId: string) => {
  setWinner(participants.find(p => p.id === winnerId))
  setPhase("result")
}
```

## 試したこと
- [例: console.log でステートを確認 → onSpinComplete が呼ばれていないことを確認]
- [例: useEffect の依存配列に winner を追加してみたが変化なし]
- [例: ブラウザのキャッシュクリア → 変化なし]

---

以下の形式で出力してください：

### 仮説（原因候補を3つ、可能性の高い順）
1. 仮説A: [原因と根拠]
2. 仮説B: [原因と根拠]
3. 仮説C: [原因と根拠]

### 各仮説の確認方法
- 仮説A: [確認するためのコードや手順]
- 仮説B: [同上]
- 仮説C: [同上]

### 推奨する修正方針
[最も可能性が高い仮説に基づいた修正方針。コードを書く場合は差分のみ]

### 注意点
[修正時に気をつけるべき副作用・既存機能への影響]
```

**OgoRouletteでの使用例**: スピン後に結果が表示されないバグ（play ページ）の調査で使用。「onSpinComplete が呼ばれていない」という試したことを記載したところ、AIが「アニメーション完了コールバックのタイミングとstateの更新タイミングが競合している」という正確な仮説を即座に提示。10分で修正完了した。

---

### 本番のみで発生するバグ調査
**使うタイミング**: ローカルでは再現せず、本番（Vercel）でのみ発生するバグを調査するとき
**効果**: 本番環境固有の原因（キャッシュ・サーバーレス制約・環境変数・CDN）を体系的に調査できる

```
本番環境（Vercel）でのみ発生するバグを調査してください。
ローカル環境では再現しません。本番固有の原因を中心に仮説を立ててください。

---

## 症状
[何が起きているか]
例: 本番で ChunkLoadError が発生し、ページが白くなる。リロードすると直るが、数秒後に再発する。

## 本番環境
- デプロイ先: Vercel
- Next.js バージョン: 16.1.6
- ビルド方式: Vercel の自動ビルド（main ブランチへのプッシュで自動デプロイ）

## ローカルとの違い
- [例: ローカルは `next dev`、本番は `next build && next start`]
- [例: ローカルは .env.local を使用、本番は Vercel の環境変数]
- [例: ローカルは単一プロセス、本番は Serverless Functions（複数インスタンス）]

## エラーログ（本番のコンソール）
```
ChunkLoadError: Loading chunk app/room/[code]/play failed.
(missing: https://ogo-roulette.vercel.app/_next/static/chunks/app/room/%5Bcode%5D/play.js)
```

## 関連コード
```typescript
// lib/rate-limit.ts — インメモリ rate limiter（本番での問題が疑われる箇所）
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string, limit: number = 10): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  // ...
}
```

## 試したこと
- [例: Vercel のデプロイログを確認 → ビルドは成功]
- [例: Vercel の Function Logs を確認 → 特定のAPIルートでエラーが頻発]

---

以下を出力してください：

### 本番環境固有の原因候補
1. [Vercel Serverless Functions の制約（コールドスタート・タイムアウト・メモリ）]
2. [複数インスタンス間で共有されないインメモリ状態]
3. [CDNキャッシュとデプロイタイミングの競合]
4. [環境変数の設定漏れ・不一致]
5. [Next.js のビルド最適化による動的インポートの問題]

### 各原因の確認方法と対策
[確認コマンドや設定変更方法を具体的に]

### 根本解決策
[本番でも安定して動作するアーキテクチャへの改善案]
```

**OgoRouletteでの使用例**: ISSUE-031（インメモリ rate limiter が Vercel 複数インスタンス間で機能しない）の調査で使用。「Vercel Serverless は複数インスタンスで動作するためプロセスメモリが共有されない」という本番固有の制約が明確になり、Upstash Redis への移行計画に結びついた。

---

### 競合状態（Race Condition）の特定
**使うタイミング**: 「たまに起きる」「複数人が同時操作すると壊れる」バグを調査するとき
**効果**: SELECT〜INSERTの間のウィンドウ・React stateの非同期性・Realtimeイベントの順序保証など、競合の原因を特定できる

```
以下の機能に競合状態（Race Condition）が存在する疑いがあります。
どの箇所で競合が発生しうるかを分析し、対策を提案してください。

---

## 疑いの根拠
[なぜ競合を疑っているか]
例: 3人が同時にルームに参加した際、ルーレットホイールに同じ色のセグメントが2つ表示された。
単独参加では一度も発生しない。

## 問題のあるコード
```typescript
// app/api/rooms/join/route.ts
// 問題: colorIndex の計算とメンバー作成の間にロックがない

// Step 1: 現在のメンバー数を取得
const room = await prisma.room.findUnique({
  where: { inviteCode: code },
  include: { _count: { select: { members: true } } }
})

// Step 2: 色を決定（← ここと Step 3 の間に別リクエストが入り込める）
const colorIndex = room._count.members % SEGMENT_COLORS.length

// Step 3: メンバーを作成
await prisma.roomMember.create({
  data: {
    roomId: room.id,
    color: SEGMENT_COLORS[colorIndex],
    // ...
  }
})
```

## システム構成
- DB: PostgreSQL（Supabase）
- ORM: Prisma 6
- デプロイ: Vercel Serverless Functions（複数インスタンスで並行動作）
- リクエスト: 最大20人が同時に JOIN する可能性がある

---

以下を出力してください：

### 競合が発生するシナリオ（タイムライン図）
```
T+0ms: リクエストA — room._count.members = 3 を読む
T+1ms: リクエストB — room._count.members = 3 を読む（同じ値！）
T+2ms: リクエストA — color = SEGMENT_COLORS[3] でメンバー作成
T+3ms: リクエストB — color = SEGMENT_COLORS[3] でメンバー作成（← 色衝突！）
```

### 修正方針（アトミック操作）
```typescript
// Prisma トランザクションを使った修正例
await prisma.$transaction(async (tx) => {
  // トランザクション内でカウントを取得
  const count = await tx.roomMember.count({ where: { roomId: room.id } })
  if (count >= room.maxMembers) throw new Error("満員です")
  const colorIndex = count % SEGMENT_COLORS.length
  return tx.roomMember.create({ data: { color: SEGMENT_COLORS[colorIndex], ... } })
})
```

### この修正で残るリスク
[トランザクションを使っても解決しない競合のパターン]

### テスト方法
[競合状態を意図的に再現する方法]
```

**OgoRouletteでの使用例**: ISSUE-043（同時JOINで複数メンバーが同一色になる）とISSUE-048（同時JOINで定員超過）の両方でこのプロンプトを使用。Prismaトランザクションによる修正方針を得て、色の割り当てと定員チェックを両方アトミックに修正した。

---

### 無限ループの原因調査
**使うタイミング**: ページが繰り返しリロードされる・useEffect が無限に実行される・APIが連続で呼ばれ続けるとき
**効果**: 循環参照・依存配列の問題・ChunkLoadError のリカバリーロジックのバグなど、無限ループのパターンを特定できる

```
以下のコードで無限ループが発生しています。原因を特定し、修正方針を提案してください。

---

## 症状
[何が無限に繰り返されているか]
例: ページが白くなった後、ブラウザが自動でリロードを繰り返している。
DevToolsのNetworkタブを見ると、同じURLへのリクエストが毎秒発生している。

## エラーログ
```
ChunkLoadError: Loading chunk app/room/[code]/play failed.
    at HTMLScriptElement.onScriptComplete (webpack.js:789)
```

## 問題のあるコード
```tsx
// app/room/[code]/play/page.tsx
// ChunkLoadError 発生時に自動リカバリーを試みるコード

useEffect(() => {
  const handleError = (event: ErrorEvent) => {
    if (event.message.includes('ChunkLoadError')) {
      // エラー発生時にリロード → リロード後もチャンクが読めない → またリロード...
      window.location.reload()
    }
  }
  window.addEventListener('error', handleError)
  return () => window.removeEventListener('error', handleError)
}, [])
```

## 環境
- Next.js 16 App Router
- Vercel デプロイ済み
- デプロイ直後（新しいチャンクハッシュが発行された直後）に発生

## 試したこと
- [例: ブラウザのキャッシュをクリアしたら止まった → キャッシュに古いチャンクが残っているのが原因？]

---

以下を出力してください：

### 無限ループのメカニズム（図解）
```
ChunkLoadError発生
    ↓
window.location.reload() でリロード
    ↓
古いJSがキャッシュから読み込まれる（または新しいURLが404）
    ↓
ChunkLoadError 再発
    ↓
無限ループ ↩
```

### 根本原因
[なぜ ChunkLoadError が発生するか / なぜリロードで解決しないか]

### 修正方針
```typescript
// リロード回数をカウントして無限ループを防ぐ修正例
const handleChunkError = (event: ErrorEvent) => {
  if (!event.message.includes('ChunkLoadError')) return
  const reloadCount = Number(sessionStorage.getItem('chunkErrorReload') ?? 0)
  if (reloadCount >= 2) {
    // リロードを諦めてユーザーにエラーメッセージを表示
    setError('ページの読み込みに失敗しました。ブラウザのキャッシュをクリアしてください。')
    return
  }
  sessionStorage.setItem('chunkErrorReload', String(reloadCount + 1))
  window.location.reload()
}
```

### 恒久対策
[ChunkLoadError が発生しにくいデプロイ・キャッシュ設定の改善案]
```

**OgoRouletteでの使用例**: 本番デプロイ直後にユーザーから「画面が白くなってリロードを繰り返す」という報告が届いた際に使用。Next.js の動的インポートで生成されるチャンクのハッシュが変わった際に古いキャッシュを持つユーザーがChunkLoadErrorに陥り、リロードでも解決しない無限ループが発生するメカニズムが判明。`sessionStorage` でリロード回数を管理する修正を実施した。

---
