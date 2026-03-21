# skills/state.md

## 目的（WHAT）

OgoRoulette の状態管理は以下を満たすこと：

- どこに何を持つかが明確
- 再レンダリングや再取得が暴れない
- URL / server data / local state の責務が分かれている
- バグが起きにくい
- 保守しやすい

---

## なぜ重要か（WHY）

状態管理が曖昧だと以下が起きる：

- 同じデータを複数箇所で持つ
- 再取得が過剰になる
- 画面更新が多すぎて重くなる
- ボタン反応が鈍くなる
- 履歴や再読み込みで状態が壊れる

OgoRoulette は
- ルーム状態
- 参加者状態
- 結果状態
- UI状態
が混在しやすいので、責務分離が重要。

---

## 基本方針（HOW）

### 1. 状態は最小限に持つ

- 計算できるものは state に持たない
- 同じ意味の state を複数持たない
- 一時的な見た目だけの state を server data に混ぜない

---

### 2. どこに持つべきかを先に決める

状態は以下のどれかに分類する：

- URL state
- server state
- local UI state
- derived state

---

### 3. server data を local state にコピーしない

原則：
- 取得したデータはそのまま使う
- 必要なら派生値として計算する

避ける：
- `const [room, setRoom] = useState(fetchedRoom)` を無目的に作る

理由：
- 二重管理になる
- 同期ズレが起きる

---

## URL state（WHAT）

URLに持つべきもの：

- roomId
- 表示対象ID
- 共有に必要な識別子
- フィルタや表示モード（必要な場合のみ）

---

### URLに向いている条件

- 直接アクセスで再現できる
- リロードしても維持したい
- 共有したい

---

### URLに向いていないもの

- モーダル開閉
- hover状態
- 一時的なloading
- アニメーション進行状態
- 入力途中の一時値

---

## server state（WHAT）

server state は API / DB 由来のデータ。

例：

- room情報
- 参加者一覧
- 抽選結果
- 支払い金額
- 履歴

---

### ルール

- server data は取得元を真実とする
- UIの都合で書き換えない
- mutate / refetch の責務を明確にする

---

### 推奨

- SWR などで管理
- key を安定させる
- 不要な再取得を避ける

---

## local UI state（WHAT）

local state に持つべきもの：

- 入力フォームの一時値
- モーダル開閉
- 選択中タブ
- スピン中フラグ
- ボタンのloading状態
- 一時的エラー表示

---

### ルール

- UI専用stateだけ持つ
- server data を複製しない
- スコープはできるだけ狭くする

---

## derived state（WHAT）

derived state は計算で出せる値。

例：

- 合計人数
- 当選者表示ラベル
- 支払い合計
- ボタン活性/非活性
- 一部奢りの残額

---

### ルール

- derived state を useState に入れない
- render内や関数で計算する
- 重い場合のみ memo を検討

---

## SWR運用ルール（HOW）

### 使う対象

- ルーム詳細
- 参加者一覧
- 結果データ
- 履歴データ

---

### 基本ルール

- key は安定させる
- 不要な `mutate` を乱発しない
- `refreshInterval` は慎重に使う
- `revalidateOnFocus` の必要性を判断する
- room全体を毎回再取得しすぎない

---

### 避けること

- 毎秒ポーリング
- ボタン押下のたびに多重 fetch
- `router.refresh()` と `mutate()` の二重実行
- useEffect と SWR の二重取得

---

## 重い更新の防止（重要）

以下は重点的に防ぐ：

- setInterval の増殖
- 依存配列ミスによる無限再取得
- room全体の過剰再fetch
- 親の再レンダリングで全子が再取得
- 抽選中の過剰state更新

---

### 確認ポイント

- このstateは本当に必要か
- derivedで済まないか
- localで持つべきか、serverで持つべきか
- このfetchは本当に必要か
- どの操作で再取得が走るか

---

## OgoRoulette 特有ルール（重要）

### ルーム状態

server state として扱う：

- room基本情報
- 参加者
- 結果
- 支払い情報

local state にコピーしない。

---

### ルーレット状態

local UI state として扱う：

- スピン中か
- 結果演出中か
- ボタン操作中か

結果そのものは server or 確定データに寄せる。

---

### 金額表示

- 計算ロジックは pure function に寄せる
- 表示用に derived state を作る
- 表示専用の変換は UI直前で行う

---

## コンポーネント分割と状態スコープ（HOW）

### 原則

- state は必要な最小範囲に置く
- 親に持ちすぎない
- 共有が必要な時だけ持ち上げる

---

### 良い例

- モーダル開閉 → モーダル親
- 参加者入力値 → 入力フォーム
- roomデータ → SWR Hook
- 金額集計 → pure function / derived

---

### 悪い例

- すべて page.tsx に集約
- fetched data を全部 useState にコピー
- UI state と domain state を混在

---

## Hydration / SSR 観点（HOW）

state関連で注意する：

- `Math.random()` を初期描画に使わない
- `Date.now()` をSSR描画に直接使わない
- `typeof window !== 'undefined'` 分岐で描画差分を作らない
- locale依存の出力差分を避ける

---

## 検証（HOW）

### URL state

- リロードしても必要状態が維持されるか
- 共有URLで再現できるか

---

### server state

- 不要な再fetchがないか
- 表示更新が適切か
- mutate後の反映が正しいか

---

### local state

- UI操作に即応するか
- スピン中や送信中の状態が壊れないか
- 画面遷移後に不要な状態が残らないか

---

### performance

- ボタンが重くないか
- 同じAPIが短時間に連打されていないか
- 再レンダリングが過剰でないか

---

## 手動確認

- room表示中にAPIが過剰に走らないか
- ボタン押下時の反応が鈍くないか
- リロードで必要情報が壊れないか
- state不整合が起きないか
- result表示と金額表示が一致するか

---

## 実装説明テンプレ

WHAT

- どの状態を整理するか

WHY

- なぜ今の持ち方が危険か
- なぜ分離が必要か

HOW

- URL / server / local / derived のどこへ置くか
- SWR / state / pure function の役割

検証

- どう確認するか

---

## 禁止事項

- fetched data の無目的コピー
- derived state の useState化
- 過剰なポーリング
- useEffect の無限ループ
- UI state と server state の混在
- router.refresh の乱用
- mutate の多重実行
- 1画面に state を持ちすぎること

---

## 最終チェック

- このstateは本当に必要か
- どこに持つのが最適か
- 再取得が過剰でないか
- 二重管理になっていないか
- UIとデータの責務が分かれているか
