# ISSUE-082: iPhoneでルームID入力ができなくなった問題を修正する（ISSUE-081リグレッション）

## ステータス
🚨 未対応（デプロイブロッカー）

## 優先度
Critical

## カテゴリ
Frontend / Mobile UX / IME / Regression

## デプロイブロッカー
**Yes** — 主要導線崩壊

---

## 1. 問題概要

### 何が起きているか
ISSUE-081 のフリック入力安定化修正後、**iPhone で招待コード入力欄に1文字も入力できない**状態が発生している。

### 修正前と比較した悪化
| 状態 | 現象 |
|------|------|
| ISSUE-080 修正後（修正前の期待値） | 入力は動く。ただしフリック入力で文字が二重になることがある |
| ISSUE-081 修正後（**現在の壊れた状態**） | そもそも入力できない。キーを押しても何も表示されない |

### なぜ重大か
- ルーム参加（スキャン非対応時の主要導線）が完全に機能しない
- 日本語iPhoneユーザー = 主たるターゲット層が全滅
- 「文字が二重入力される」より「入力不能」のほうが致命的
- 現在デプロイ済み = 本番環境で起きている

---

## 2. 直近修正との関係

### 原因コミット
`8dfa688` — ISSUE-081 のフリック入力修正

### 問題箇所
`app/scan/page.tsx` の `onChange` ハンドラに追加した **`if (isComposing.current) return`**

```tsx
// ISSUE-081 で追加された問題のあるコード
onChange={(e) => {
  if (isComposing.current) return   // ← ここが問題の根本
  setInviteCode(e.target.value.toUpperCase().slice(0, 6))
  setError(null)
}}
```

---

## 3. 根本原因（技術的詳細）

### 分類: **B + G の複合（Controlled Input 更新ロジック破綻 × iPhone Safari 特有挙動）**

### React Controlled Input の仕組み
React の `<input value={state}>` は **Controlled Input** と呼ばれ、
DOM の表示値は常に `state` と同期することが保証される。

つまり:
- `onChange` が発火して `setState()` を呼ばなかった場合
- React は次のレンダーで `input.value` を強制的に `state`（古い値）に戻す
- 結果として、ユーザーが入力した文字が画面から消える

### iPhone Safari での失敗シーケンス

iPhone の日本語キーボード（ローマ字/フリック）は、英数字入力でも IME 経由になる。
このため以下のシーケンスが毎キー入力ごとに発生する:

```
1. ユーザーが「A」キーをタップ
2. compositionStart 発火 → isComposing.current = true
3. IME が "a" をバッファに保持、DOM input.value = "a" に更新
4. onChange 発火 (e.target.value = "a")
   → if (isComposing.current) return ← スキップ！setInviteCode() 呼ばれず
5. React の reconciliation: state は依然 "" → input.value を "" にリセット
6. IME のバッファが破壊される（DOM の値が消えた）
7. compositionEnd 発火 → e.currentTarget.value = "" (バッファが消えていた)
   → setInviteCode("") → 何も変わらない
8. ユーザーに見えるもの: 何も入力されなかった
```

### なぜ意図と逆の結果になったか
ISSUE-081 の意図は「composition 中に setInviteCode() を呼ばない」ことで
React の DOM 書き換えを防ぐことだった。

しかし実際には:
- `onChange` をスキップしても、`state` が変わらない以上 React は次の描画で DOM を元に戻す
- `setInviteCode()` を呼ばない = React に「state 変化なし」を伝える = DOM は強制リセットされる
- その結果、`onChange` をスキップすることで IME バッファは必ず破壊される

正反対の効果を生んだ修正だった。

---

## 4. 再現条件

| 環境 | キーボード | 症状 |
|------|-----------|------|
| iPhone Safari | 日本語（ローマ字） | **入力不能** — 1文字も入らない |
| iPhone Safari | 日本語（フリック） | **入力不能** — 1文字も入らない |
| iPhone Safari | 英語キーボード | おそらく動作する（composition なし） |
| Android Chrome | Gboard 日本語 | **入力不能** の可能性（同様の composition 処理）|
| PC Chrome / Safari | 日本語IME | 条件次第で入力不能 |
| PC Chrome / Safari | 英語入力 | 動作する |

**最重要:** 日本語 iPhone ユーザーはデフォルトで日本語キーボードを使う。
完全に入力不能。

---

## 5. 修正計画

### ★ 応急対応（即実施すべき）

**ISSUE-081 の onChange ガードをロールバックし、composition 中も state を更新する**

```tsx
// Before（現在の壊れたコード）
onChange={(e) => {
  if (isComposing.current) return   // ← 削除
  setInviteCode(e.target.value.toUpperCase().slice(0, 6))
  setError(null)
}}

// After（安全な修正）
onChange={(e) => {
  if (isComposing.current) {
    // composition 中は sanitize せず raw 値で更新し React と DOM を同期させる
    // sanitize は onCompositionEnd で行う
    setInviteCode(e.target.value.slice(0, 10))  // 過剰な長さのみガード
    return
  }
  setInviteCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6))
  setError(null)
}}
```

この修正により:
- composition 中も React が DOM をリセットしなくなる（state = DOM が一致する）
- IME バッファが生きたまま保持される
- compositionEnd で正しく sanitize される

### 安全修正（応急対応後に行う）

onCompositionEnd の sanitize は現行のままで問題ない。
handleManualJoin の sanitize も正しい。
disabled 判定も正しい。

追加で以下を検討:

```tsx
onCompositionEnd={(e) => {
  isComposing.current = false
  const val = e.currentTarget.value
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 6)
  setInviteCode(val)
  setError(null)
}}
```

これはそのまま保持してよい。

### 理想修正（ISSUE-083 として別途対応）

**PIN 入力 UI**（6個の独立した1文字セル）に置き換え。
各セルが `maxLength={1}` で、IME composition が1文字で即コミットされる。
composition バッファが1文字単位なので乱れが構造的にゼロになる。

---

## 6. rollback 判断

### 戻すべき範囲
ISSUE-081 で追加した onChange ガード（`if (isComposing.current) return`）の部分のみ。

以下は **戻さない**:
- `onCompositionStart` / `onCompositionEnd` ハンドラ（概念は正しい）
- `handleManualJoin` の `replace(/[^a-zA-Z0-9]/g, "")` 追加（安全）
- `disabled` の sanitize 済み文字数チェック（正しい）
- ISSUE-080 の input 属性群（autoCapitalize 等）

### 完全 rollback（ae02520）のリスク
- handleManualJoin の sanitize が消える（日本語混入でルーティングが壊れる可能性）
- disabled チェックが単純文字数に戻る（日本語文字で6文字カウントして参加ボタンが有効化される）
- 推奨しない

---

## 7. 検証計画

### 最優先（即実機確認）
1. [ ] iPhone 実機 + 日本語ローマ字キーボードで「ABCDEF」入力が通るか
2. [ ] iPhone 実機 + フリック入力で「123456」入力が通るか
3. [ ] 6文字入力後に「参加する」ボタンが有効になるか
4. [ ] 存在しないコードで参加ボタン押下 → join 画面に遷移するか

### 回帰確認
5. [ ] PC Chrome + 英語入力が動作するか
6. [ ] PC Chrome + 日本語IME（Google 日本語入力）が動作するか
7. [ ] 6文字未満で「参加する」ボタンが disabled か
8. [ ] 6文字入力後にボタンが有効になるか

---

## 8. リスク

### このまま追加修正すると危険な箇所
- `onChange` と `onCompositionEnd` の両方で `setInviteCode()` を呼ぶ場合、二重処理の可能性
- iOS Safari と Chrome で compositionEnd → onChange の発火順序が逆なため、設計が複雑化しやすい
- `maxLength` と `slice(0, 6)` の組み合わせが composition 中間文字（長い文字列）を切ってしまう可能性

### 触ると壊れやすい箇所
- `isComposing.current` フラグの管理タイミング
- compositionEnd の `e.currentTarget.value` (iOS: onChange 前に DOM がリセットされる場合あり)
- React の Strict Mode では effect が2回実行される → useRef は影響を受けないが注意

---

## 9. 推奨アクション

### 最初にやること
`onChange` の `if (isComposing.current) return` を以下に差し替える:

```tsx
if (isComposing.current) {
  setInviteCode(e.target.value.slice(0, 10))
  return
}
```

これだけで iPhone の入力不能は解消される。

### その次
1. 修正をコミット・プッシュ
2. Vercel デプロイ完了後に iPhone 実機確認
3. 問題なければ ISSUE-083（PIN 入力 UI）を別 Issue として計画

---

## タスク
- [ ] onChange ガードを「return のみ」から「raw update + return」に変更
- [ ] iPhone 実機確認（日本語キーボード・ローマ字入力）
- [ ] iPhone 実機確認（フリック入力）
- [ ] Android 実機確認（Gboard）
- [ ] PC 回帰確認
- [ ] console error 確認
- [ ] Vercel デプロイ確認

## 受け入れ条件
- iPhone 日本語キーボードでルームID入力ができる
- 半角英数字が正常に入力できる
- 6文字で「参加する」ボタンが有効になる
- 日本語文字が混入してもサニタイズされる
- PC / Android で副作用がない

## 保存ファイル名
`docs/issues/issue-082-fix-iphone-room-id-input-regression.md`
