# ケーススタディ 001: Race Condition との戦い
## ― ISSUE-001〜006 に見る「並列処理バグをAIで診断する」 ―

---

## 概要

| 項目 | 内容 |
|------|------|
| 対象ISSUE | ISSUE-001〜006 |
| 発生フェーズ | MVP完成直後（バグ格闘期） |
| 影響範囲 | `/room/[code]/play` — SPINボタン・フェーズ遷移 |
| 難易度 | ★★★★☆（非同期・React状態・Firestoreリアルタイム更新の三つ巴） |
| 解決日数 | 約2週間（6つのISSUEを段階的に解決） |
| AIの貢献 | 根本原因の言語化・修正コードの初稿・副作用のリストアップ |

---

## 背景

OgoRoulette のMVPが完成し、ゲストホスト機能（認証なしでルームを作れる機能）を実装した直後に、一連の不具合が発生した。

ゲストホストはFirebase Authに登録しないため、`isGuestHost` フラグを `localStorage` に保存して識別している。このシンプルな設計が、Reactの非同期レンダリングサイクルと組み合わさったとき、予想外の複雑な問題を引き起こした。

### アーキテクチャの前提知識

OgoRouletteのプレイページ（`/room/[code]/play`）は以下のような状態を持つ:

```typescript
// フェーズ管理（UI表示の制御）
type Phase = "waiting" | "preparing" | "spinning" | "result"
const [phase, setPhase] = useState<Phase>("waiting")

// SPINボタンの表示制御
const isOwner = currentUser?.uid === room?.hostId || isGuestHost

// SPINボタンが押せる条件
const canSpin = isOwner && phase === "waiting"
```

`isOwner` が `true` かつ `phase === "waiting"` でなければSPINボタンは `disabled` になる。この条件が、非同期処理と競合することで問題が生じた。

---

## 問題

### 症状（ユーザーが体験したこと）

**再現手順:**
1. ゲストホストとしてルームを作成する
2. SPINを一度実行し、結果を確認する
3. ブラウザをリロードする
4. プレイページを再度開く

**結果:** SPINボタンが `disabled` のまま押せなくなる。ページを完全にリロードするまで回復しない。

**追加症状:**
- コンソールにエラーは出ない（サイレントバグ）
- 認証ユーザー（Firebase Auth）では発生しない
- ゲストホスト「のみ」に発生する
- `room.status === "IN_SESSION"` の状態でリロードした場合に高確率で発生

---

## 原因分析

### ISSUE-001: `isOwner` フリッカーによる誤発火

**根本原因（AIが診断）:**

`isGuestHost` の初期値が `false`（`useState(false)`）で、値の確定が `useEffect` 内の非同期処理であるため、最初のレンダリングで「ゲストホストではない」と誤判定される。

```typescript
// 問題のあるコード（修正前）
const [isGuestHost, setIsGuestHost] = useState(false) // 初期値は false

useEffect(() => {
  if (!room) return
  const stored = JSON.parse(localStorage.getItem("ogoroulette_host_rooms") || "[]")
  setIsGuestHost(stored.includes(room.inviteCode)) // useEffect内で確定
}, [room?.inviteCode])

// loading guard は isGuestHost の確定を待たない
if (loading || !authLoaded) {
  return <Spinner />
}

// ↓ ここで isOwner === false（isGuestHost がまだ false）
// ↓ メンバー用エフェクトが発火する
```

**発火の連鎖:**

```
1. レンダリング: isGuestHost = false → isOwner = false
2. メンバー用useEffectが発火
3. room.status === "IN_SESSION" を検知
4. scheduleSpin() が呼ばれる
5. spinScheduledRef.current = true がセットされる
6. phase = "preparing" になる
7. [その後] isGuestHost = true になる → isOwner = true
8. SPINボタンは phase !== "waiting" のため disabled のまま
```

### ISSUE-002: `spinScheduledRef` 競合によるフェーズ永続停止

ISSUE-001の副作用として、`spinScheduledRef` が誤って `true` にセットされることで、正常なSPIN開始フローもブロックされた。

```typescript
const scheduleSpin = (session: Session) => {
  if (spinScheduledRef.current) return  // すでに true なら何もしない（ここでブロック）
  spinScheduledRef.current = true
  setPhase("preparing")
  setTimeout(() => setPhase("spinning"), delay)
}
```

オーナーが手動でSPINを押しても、`spinScheduledRef.current === true` のため `scheduleSpin` が早期リターンし、フェーズが動かない。

### ISSUE-003: タイムアウト回復機構の欠如

`phase = "spinning"` または `"preparing"` で止まった場合、手動でページをリロードする以外に回復手段がなかった。Framer Motionのアニメーション完了コールバックが何らかの理由で発火しない場合も同様。

### ISSUE-004: クロックスキューによる巨大な `delay` 値

`scheduleSpin` 内のディレイ計算:

```typescript
const delay = Math.max(0, session.startedAt.toMillis() - Date.now())
```

クライアントとFirestoreサーバーの時刻がズレている場合（NTPズレ・デバイス設定ミス）、`session.startedAt` が未来の時刻として解釈され、数十秒〜数分の `delay` が生じた。この間、UIは `"preparing"` で停止しているように見える。

### ISSUE-005: ルームが `IN_SESSION` でスタックした場合の次スピン不可

前のスピンのセッションドキュメントが残ったまま `room.status === "IN_SESSION"` になっている状態でリロードすると、`scheduleSpin` が古いセッションを元に発火し、新たなスピンが開始できなかった。

### ISSUE-006: `handleRespin` のポーリング競合

結果画面から再スピン（Respin）する際、Firestoreのポーリングと `handleRespin` の呼び出しが競合し、フェーズが `"waiting"` → `"preparing"` → `"waiting"` と高速で行き来するケースが発生した。

---

## 解決プロセス

### Step 1: 問題の言語化（ISSUE化）

バグに気づいた時点ではまだ「SPINボタンが押せなくなる」という現象レベルの認識だった。AIに相談する前に、まず自分でISSUEを書いた。

**書いたこと:**
- 再現手順（ゲストホストでリロードするとなる）
- 関係するコードの場所（isGuestHost のuseEffect、メンバー用Effect、loading guard）
- 疑っている原因（非同期のタイミング問題）
- 期待する動作（リロード後もSPINボタンが有効であること）

ISSUEを書くプロセスで、「isGuestHost が確定する前にレンダリングが進んでいる」という仮説が明確になった。

### Step 2: AIへの入力

ISSUEのフルテキストに加えて、以下を貼り付けた:

```
1. isGuestHost を管理している useEffect のコード（line 260付近）
2. メンバー用スピン検知 useEffect のコード（line 283付近）
3. loading guard のコード（line 498付近）
4. scheduleSpin 関数の実装（line 291-312）
5. handleSpin 関数の実装（line 368付近）
```

**AIへのプロンプト:**
```
以下のISSUEと関連コードを分析してください。

[ISSUE-001の全文]

[関連コード]

期待する出力:
1. 根本原因の診断（なぜ起きているか、どのタイミングで発火するか）
2. 修正方針（最小変更で対応できる方法）
3. 副作用のリスト（修正によって壊れる可能性のある箇所）
4. 修正後の確認手順
```

### Step 3: AIの診断と修正案

AIが提示した根本原因:

> `isGuestHost` の確定タイミングが loading guard に含まれていないため、`isGuestHostResolved = false` の段階でレンダリングが進んでしまい、メンバー用 useEffect が誤発火する。解決策は `isGuestHostResolved` という boolean フラグを追加し、loading guard に含めることで、このフラグが `true` になるまでスピナーを表示し続けること。

AIが提示した修正コード（初稿）:

```typescript
// 1. フラグを追加
const [isGuestHostResolved, setIsGuestHostResolved] = useState(false)

// 2. useEffect を修正
useEffect(() => {
  if (currentUser) {
    // 認証ユーザーは localStorage チェック不要
    setIsGuestHostResolved(true)
    return
  }
  if (!room) return
  const stored = JSON.parse(
    localStorage.getItem("ogoroulette_host_rooms") || "[]"
  )
  setIsGuestHost(stored.includes(room.inviteCode))
  guestHostTokenRef.current = localStorage.getItem(
    `ogoroulette_host_token_${room.inviteCode}`
  )
  setIsGuestHostResolved(true)
}, [room?.inviteCode, currentUser])

// 3. loading guard に追加
if (loading || !authLoaded || !isGuestHostResolved) {
  return <Spinner />
}
```

### Step 4: 人間による評価

AIの提案をそのまま使わず、以下の点を人間が判断した:

**良い点:**
- `isGuestHostResolved` フラグを追加するアプローチは正しい
- `currentUser` がある場合の早期リターンは必要な分岐

**懸念点（AIが見落とした副作用）:**
- `room` が `null` の場合、effect が走らず `isGuestHostResolved = false` のまま無限スピナーになる可能性
- `room` が遅れてロードされる場合の handling が必要

**追加修正（人間が判断）:**
```typescript
useEffect(() => {
  if (currentUser) {
    setIsGuestHostResolved(true)
    return
  }
  if (!room) {
    // room が null でも resolved にする（エラー画面や別の guard で処理）
    // → ここはあえて return のまま（room なしはそもそも別のケース）
    return
  }
  // ... localStorage チェック
}, [room?.inviteCode, currentUser])
```

結論: `room === null` の場合はそれ以外の guard（`if (!room) return <NotFound />`）で処理されるため、`isGuestHostResolved` が `false` のままでも問題ない。AIの提案を採用した。

### Step 5: ISSUE-002〜006 の連鎖解決

ISSUE-001を解決したことで、ISSUE-002（`spinScheduledRef` 競合）の根本原因も同時に解消された。ただし、防衛的な修正として `handleSpin` 呼び出し時に `spinScheduledRef.current` を強制リセットするコードを追加した。

ISSUE-003（タイムアウト回復機構）については独立したISSUEとして実装:
```typescript
// phase が "spinning" または "preparing" で60秒以上経過したら自動回復
useEffect(() => {
  if (phase !== "spinning" && phase !== "preparing") return
  const timer = setTimeout(() => {
    setPhase("waiting")
    toast.error("スピンがタイムアウトしました。再試行してください。")
  }, 60_000)
  return () => clearTimeout(timer)
}, [phase])
```

ISSUE-004（クロックスキュー）はFirestoreのサーバータイムスタンプとクライアントの `Date.now()` を比較する際に `Math.min` でキャップを設ける対策を実施:
```typescript
const MAX_DELAY_MS = 10_000 // 最大10秒
const delay = Math.min(
  Math.max(0, session.startedAt.toMillis() - Date.now()),
  MAX_DELAY_MS
)
```

---

## AI活用方法

### 効果的だったプロンプトパターン

**パターン1: 診断系プロンプト**
```
以下の症状を診断してください。

症状: [ユーザーが体験した現象]
再現手順: [ステップバイステップ]
疑っている箇所: [コードの場所]
関連コード: [実際のコード]

出力形式:
1. 根本原因（何が起きているか）
2. なぜ起きているか（タイミング・状態遷移の観点で）
3. 修正方針
4. 副作用のリスク
```

**パターン2: コード生成系プロンプト**
```
以下の修正方針に基づいてコードを実装してください。

[ISSUEの修正方針セクション]

制約:
- handleSpin の外部インターフェースを変えない
- useState の型を変えない
- isGuestHost の読み取りロジックは維持する

出力形式: 変更が必要なコードブロックのみ（差分形式）
```

**パターン3: レビュー系プロンプト**
```
以下の修正コードをレビューしてください。

[修正前のコード]
↓
[修正後のコード]

確認してほしい点:
1. race condition が解消されているか
2. 認証ユーザー・ゲストホスト・メンバーの3パターンで正しく動くか
3. エッジケース（room=null、currentUser=null の場合）
4. メモリリーク・無限ループのリスク
```

### AIが特に有効だった場面

1. **「タイミング問題の言語化」**: `useEffect` の発火順序を文字で説明させることで、人間が見えていなかった問題のシーケンスが明確になった
2. **「副作用の列挙」**: 修正した場合に壊れる可能性のある箇所をリストアップさせることで、テストすべき項目が網羅できた
3. **「エッジケースの発見」**: 「このコードが想定外の動きをするケースを全部挙げて」という問いで、`room = null` ケースが発見された

### AIが苦手だった場面

1. **「実際の再現確認」**: AIはコードを読んで推論するが、実際にブラウザで動かして確認することはできない。再現確認は必ず手動で行った
2. **「ファイル全体のコンテキスト」**: コードが長い場合、AIに渡せる量に限界がある。関連する部分だけを抜き出して渡す必要があった
3. **「プロジェクト固有の慣習」**: OgoRouletteの「`router.back()` は禁止」などのルールはAIは知らない。プロンプトに明示する必要があった

---

## 学び

### Race Conditionの一般的なパターンと対策

**パターン1: 非同期データの初期値問題**

```typescript
// 問題パターン
const [data, setData] = useState(false) // 初期値が「まだ読んでいない」を表現できない

// 解決パターン
const [data, setData] = useState<boolean | null>(null) // null = 未確定
const [resolved, setResolved] = useState(false) // 別フラグで確定を管理

if (!resolved) return <Spinner />
```

**パターン2: 複数のuseEffectが同じ状態を変更する**

```typescript
// 問題パターン
useEffect(() => {
  if (!isOwner) scheduleSpin() // isOwner が確定前に発火する可能性
}, [room, isOwner])

// 解決パターン
useEffect(() => {
  if (!isOwnerResolved || !isOwner === false) return // 確定を待つ
  scheduleSpin()
}, [room, isOwner, isOwnerResolved])
```

**パターン3: refによるフラグ管理と非同期タイミングの競合**

```typescript
// 問題パターン
const flagRef = useRef(false)
// flagRef が true になるタイミングと useEffect が走るタイミングが一致しない

// 解決パターン: flagRef.current の reset を明示的に行う
const handleUserAction = () => {
  flagRef.current = false // 手動で reset
  // ... 処理
}
```

### このケースから得た教訓

1. **「初期値 = まだ確定していない」を表現する設計が重要**: `false` ではなく `null` を使うか、別の `resolved` フラグを持つ
2. **loading guard は「全ての非同期値が確定したか」を保証するべき**: 一つでも確定していない値があれば表示しない
3. **useEffect の依存配列は厳格に管理する**: 依存が多い場合は複数のuseEffectに分割する
4. **バグを一つ直したら必ず別の角度からも確認する**: ISSUE-001を直したことでISSUE-002が顕在化した
5. **サイレントバグは最も危険**: エラーがコンソールに出ない状態異常は、ユーザーだけが気づく

---

## 再利用ポイント

### 他プロジェクトに持ち出せるパターン

**1. `resolvedフラグ` パターン**

localStorage・AsyncStorage・IndexedDB などから非同期に値を読む場合に使える:

```typescript
// 汎用パターン
const [value, setValue] = useState<T | null>(null)
const [isResolved, setIsResolved] = useState(false)

useEffect(() => {
  if (authUser) {
    // 認証済みユーザーは永続ストレージチェック不要
    setIsResolved(true)
    return
  }
  const stored = readFromStorage()
  setValue(stored)
  setIsResolved(true)
}, [authUser, dependencyKey])

// loading guard
if (!isResolved) return <Loading />
```

**2. フェーズタイムアウト自動回復パターン**

長時間実行が必要な非同期処理（アニメーション・WebSocket・API呼び出し）で使える:

```typescript
// 汎用パターン
useEffect(() => {
  if (!isProcessingPhase) return
  const TIMEOUT_MS = 30_000 // 30秒でタイムアウト
  const timer = setTimeout(() => {
    setPhase("idle")
    onTimeout?.() // エラーハンドリングコールバック
  }, TIMEOUT_MS)
  return () => clearTimeout(timer)
}, [isProcessingPhase])
```

**3. クロックスキュー対策の delay キャップパターン**

サーバータイムスタンプとクライアント時刻を使って `setTimeout` を計算する場合:

```typescript
const safeDelay = (serverTimestamp: number, maxDelayMs = 10_000): number => {
  const raw = serverTimestamp - Date.now()
  return Math.min(Math.max(0, raw), maxDelayMs)
}
```

**4. AIへの診断依頼テンプレート**

Race Conditionが疑われる場合のプロンプト雛形:

```
## Race Condition 診断依頼

### 症状
[何が起きているか。再現率は？]

### 再現手順
1. ...
2. ...

### タイムライン（推定）
[どのコードがどの順番で実行されているか]

### 疑っているコード
[コードを貼る]

### 依頼事項
1. 非同期処理の実行順序を整理してください
2. race condition が発生しているタイミングを特定してください
3. 最小変更で修正できるコードを提案してください
4. 修正後の副作用をリストアップしてください
```

---

## 関連ドキュメント

- [ISSUE-001](../../issues/issue-001-spin-button-isowner-flicker.md) — isOwner フリッカー
- [ISSUE-002](../../issues/issue-002-spin-scheduled-ref-race.md) — spinScheduledRef 競合
- [ISSUE-003](../../issues/issue-003-spinning-phase-timeout.md) — タイムアウト回復機構
- [ISSUE-004](../../issues/issue-004-clock-skew-delay.md) — クロックスキュー
- [ISSUE-005](../../issues/issue-005-room-in-session-stuck.md) — IN_SESSION スタック
- [ISSUE-006](../../issues/issue-006-handlerespin-polling-race.md) — handleRespin 競合
- [ケーススタディ 003](./case-003-performance.md) — パフォーマンス最適化

---

*最終更新: 2026-04-02*
*ステータス: 全6 ISSUE 解決済み*
