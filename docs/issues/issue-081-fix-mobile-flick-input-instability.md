# ISSUE-081: スマホのフリック入力でルームID入力が不安定な問題を修正する

## ステータス
✅ 完了

## 優先度
High

## カテゴリ
Frontend / Mobile UX / IME

## 概要

スマホ実機（特に日本語キーボード使用時）でルームID入力時に、
フリック入力が不安定で同一文字の重複入力や入力乱れが発生する問題を修正する。

---

## 背景

- ルームID参加導線はスマホでの主要操作のひとつ
- 日本語iPhoneユーザーはデフォルトで日本語キーボード（ローマ字/フリック）を使用する
- ルームIDは英数字のみだが、日本語キーボードで入力するとIME compositionが発生する
- composition 中に React の controlled input が値を書き換えるため入力が乱れる

---

## 根本原因（A + C の複合）

### 主因: IME composition 中に `onChange` → `setInviteCode()` が走る

`onChange` ハンドラ内で `toUpperCase().slice(0, 6)` を実行しているが、
この処理は IME のコンポジション中（`compositionStart` 〜 `compositionEnd`）にも実行される。

React が `value` prop を更新することで DOM の値が書き換わり、
IME の内部バッファと DOM の値が乖離する。

イベント順序（iOS Safari で「G」を入力する場合）:
```
1. compositionStart  →  IME が "g" をバッファに保持
2. onChange          →  e.target.value = "g"
3. setInviteCode("G") →  React が DOM.value = "G" に書き換え ← IME バッファ崩壊
4. compositionEnd    →  "G" を確定しようとする → DOM は既に "G" → "GG" になる
```

### 従因: onChange 中の文字加工が composition バッファに干渉

`toUpperCase()` + `.slice(0, 6)` が確定前の IME 候補文字列にも適用される。

---

## 修正内容

### app/scan/page.tsx

1. `useRef` で IME コンポジション中フラグ (`isComposing`) を管理
2. `onCompositionStart` で `isComposing.current = true`
3. `onCompositionEnd` で `isComposing.current = false` + 最終整形
4. `onChange` は `isComposing.current === true` の場合スキップ
5. `onCompositionEnd` に `replace(/[^a-zA-Z0-9]/g, "")` を追加し日本語文字を除去
6. `handleManualJoin` でも `replace` を適用して安全に送信
7. `disabled` 判定を `replace` 済み文字数ベースに変更

### 注意: `compositionEnd` / `onChange` の発火順序のブラウザ差

- **iOS Safari**: `onChange` が先 → `compositionEnd` が後
- **Chrome/Android**: `compositionEnd` が先 → `onChange` が後

`isComposing.current` フラグで `onChange` をスキップし、
`compositionEnd` で確定値を取得する設計で両ブラウザに対応する。

---

## 中期対応（ISSUE-082 として別途）

**PIN 入力 UI（6 個の独立セル）に置き換える**

各セルが `maxLength={1}` で1文字だけ受け付け、自動的に次セルへフォーカスが移る。
IME のコンポジションバッファが1文字で即コミットされるため、バッファ乱れがゼロになる。
ペースト対応も含めて実装する。

---

## タスク
- [x] 根本原因調査（IME composition + controlled input 競合）
- [x] composition tracking 実装
- [x] handleManualJoin の英数字フィルタ追加
- [ ] iPhone 実機確認（日本語キーボード・ローマ字入力）
- [ ] Android 実機確認（Gboard）
- [ ] PC 回帰確認
- [ ] console error 確認

## 受け入れ条件
- スマホのフリック入力（日本語キーボード）が安定する
- 同一文字の重複入力が発生しない
- 日本語変換を試みても英数字のみが入力される
- 6文字で「参加する」ボタンが有効になる
- PC 入力が壊れない

## 優先度
High

## デプロイブロッカー
No
