# モバイルChromeの長押しとアプリUIが競合した：user-select問題と長押し廃止

## 概要

OgoRoulette の「いつものメンバー」編集でスマホ固有のバグが見つかった。

グループカードを長押しするとアプリの編集メニューが出るはずが、Chrome のネイティブコピーツールバーも同時に現れ、画面が 2 つの UI で埋まる。

原因は 3 つの重なりだった。

- テキストが選択可能な状態（`user-select: auto`）
- `onContextMenu` の未処理
- Chrome の長押し判定タイミングとアプリの長押しタイマーが 500ms で完全一致

修正として即時対応（`user-select: none` + `onContextMenu` 抑止）と、恒久対応（長押しを廃止して ⋮ ボタンに変更）を同時に実施した。

---

## 発生した問題

「いつものメンバー」のグループカードは、長押しで編集・削除・ルーム作成メニューを開く設計だった。

```tsx
const handleLongPressStart = (id: string) => {
  longPressTimer.current = setTimeout(() => setOpenMenuId(id), 500)
}

<button
  onTouchStart={() => handleLongPressStart(group.id)}
  onTouchEnd={handleLongPressEnd}
  className="flex items-center gap-2 flex-1 min-w-0 text-left"
>
  <p className="text-sm font-semibold text-foreground truncate">{group.name}</p>
  <p className="text-xs text-muted-foreground truncate mt-0.5">{participants}</p>
</button>
```

このコードで、スマホで長押しすると次の順序で何かが起きる。

```
500ms 経過
  → Chrome: テキスト選択 UI が出る（コピーバー表示）
  → アプリ: setTimeout が発火してアクションメニューが出る
  → 結果: 両方同時に画面に出る
```

アクションメニューはカード直下（`position: absolute; top: 100%`）に出る。Chrome のコピーバーはテキスト選択位置の上部に出る。カードが画面中央にあるとちょうど挟み撃ちになり、どちらのボタンも押しにくい状態になった。

---

## 原因

### A. テキスト選択可能状態（主因）

`<button>` の内側にある `<p>` テキストに `user-select` が指定されておらず、デフォルトの `auto` になっていた。

Chrome Android は `<button>` 内のテキストも長押しで選択対象にする。`user-select: auto` のまま長押しすると、テキストが選択されてコピーバーが出る。

ブラウザ DevTools で確認すると：

```
button.flex-1 → user-select: auto
body          → user-select: auto
```

グローバル CSS にも Tailwind のリセットにも `user-select: none` の設定はなかった。

### B. onContextMenu の未処理（主因）

Chrome Android の長押しは `contextmenu` イベントを発火する。このイベントにハンドラがなければ、ブラウザのデフォルト動作（コピーバーの表示）が実行される。

```tsx
// onContextMenu ハンドラが存在しなかった
onTouchStart={() => handleLongPressStart(group.id)}
onTouchEnd={handleLongPressEnd}
// ← ここに onContextMenu={(e) => e.preventDefault()} が必要だった
```

### C. タイミングの完全一致（補助因）

Chrome の長押し判定は約 500ms。アプリの `setTimeout` も 500ms。

どちらも同じタイミングで発火するため、両者の干渉を防ぐ手段がなかった。Chrome 側を「先に負かす」ことも「後から取り消す」こともできない。

---

## 修正内容

### 即時対応（2行）

長押しトリガーボタンに `select-none` と `onContextMenu` を追加する。

```tsx
// Before
<button
  onTouchStart={() => handleLongPressStart(group.id)}
  onTouchEnd={handleLongPressEnd}
  className="flex items-center gap-2 flex-1 min-w-0 text-left"
>

// After
<button
  onClick={() => onSelect(group.id)}
  onContextMenu={(e) => e.preventDefault()}
  className="flex items-center gap-2 flex-1 min-w-0 text-left select-none"
>
```

`select-none` は Tailwind の `user-select: none` ユーティリティ。テキスト選択を無効にし、Chrome がコピーバーを出す原因を断つ。

`onContextMenu` の `preventDefault()` は、`user-select: none` をすり抜けてネイティブメニューが出るケース（リンクや画像の長押しなど）の念押し対策として機能する。

### 恒久対応（長押し廃止 → ⋮ ボタン常時表示）

長押しという操作自体をなくし、カード右端に ⋮ ボタン（`MoreHorizontal`）を常時表示する設計に変更した。

```tsx
// 長押し関連をすべて削除
// const longPressTimer = useRef(...)
// const handleLongPressStart = ...
// const handleLongPressEnd = ...

// ⋮ ボタンを追加
<button
  onClick={(e) => {
    e.stopPropagation()
    setOpenMenuId(menuOpen ? null : group.id)
  }}
  className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center
             transition-all active:scale-95 text-muted-foreground
             hover:bg-white/10 hover:text-foreground"
  title="メニュー"
>
  <MoreHorizontal className="w-4 h-4" />
</button>
```

あわせて、メニュー外タップで閉じる処理も追加した。

```tsx
const menuRef = useRef<HTMLDivElement | null>(null)

useEffect(() => {
  if (!openMenuId) return
  const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setOpenMenuId(null)
    }
  }
  document.addEventListener("mousedown", handleOutsideClick)
  document.addEventListener("touchstart", handleOutsideClick)
  return () => {
    document.removeEventListener("mousedown", handleOutsideClick)
    document.removeEventListener("touchstart", handleOutsideClick)
  }
}, [openMenuId])
```

変更は `components/group-list.tsx` の1ファイルのみ。

---

## 学び

### 1. `<button>` 内のテキストでも長押しで選択される

`<button>` 要素はクリックのための要素だが、内側のテキストノードは `user-select: auto` のまま。Chrome Android は長押し時にテキスト選択を優先して発動する。

インタラクティブな要素（タップ・長押し・スワイプを受け取る要素）のテキストは、意図的に選択させたい理由がなければ `select-none` を付けておくべきだ。

### 2. `onContextMenu` は「長押し用フック」として使える

モバイルの長押しは `touchstart → (500ms) → contextmenu` という順序でイベントが来る。`onContextMenu` の `preventDefault()` はネイティブのコンテキストメニュー表示を止める唯一の確実な手段だ。

長押しで独自UIを出すなら `onContextMenu` の抑止はセットで実装する。

### 3. 長押しはモバイルで「見つけにくい + OS と競合しやすい」

長押しは「知っている人にとっては便利なショートカット」だが、知らないユーザーには存在しない機能に等しい。さらに OS やブラウザの長押し挙動と競合する問題が常につきまとう。

今回のように「長押しに依存していたから壊れた」という状況は、長押しを主要導線にしていたことが根本の原因だ。よく使う操作は明示的なボタンで提供する方が安全で発見性も高い。

### 4. タイミングが同じなら競合は避けられない

Chrome の長押し判定（500ms）とアプリの `setTimeout`（500ms）はどうやっても同時発火する。タイマーを 600ms に変えても、Chrome のタイミングが変わればまた競合する。根本的に解決するには「長押しをやめること」しかない。

---

## 再発防止

- ドラッグ・スワイプ・長押しを受け取るインタラクティブ要素には `select-none` を付ける
- 長押しで独自UIを出す場合は `onContextMenu={(e) => e.preventDefault()}` をセットで書く
- 長押しを主要操作にする前に「⋮ ボタンで代替できないか」を先に検討する
- モバイル向けのインタラクション実装後は `user-select` / `touch-action` を DevTools で確認する

---

## まとめ

| 原因 | 詳細 | 対応 |
|------|------|------|
| `user-select: auto` | `<button>` 内テキストが長押しで選択される | `select-none` を追加 |
| `onContextMenu` 未処理 | Chrome の長押しネイティブUIが止まらない | `e.preventDefault()` を追加 |
| 長押しタイミング競合 | 500ms で Chrome とアプリが同時発火 | 長押し廃止・⋮ ボタンに変更 |

3 つの原因がすべて重なったことで問題が起きた。即時対応の 2 行で症状を止めつつ、長押し廃止という恒久対応で根本から断った。

モバイルで「長押しで何かが起きる」UI は、Chrome や Safari の長押し挙動と必ず戦うことになる。その戦いに勝つより、最初から戦わない設計を選ぶ方が強い。

---

## SNS投稿文

```
スマホの「長押し編集」を廃止した話。

グループカードを長押し → Chrome のコピーバーとアプリのメニューが
同時に出て画面が崩壊する問題が発生。

原因は3つの重なり：
① <button> 内テキストに user-select: none がなかった
② onContextMenu を止めていなかった
③ Chrome の長押し判定と setTimeout が両方 500ms で同時発火

即時対応は2行で済んだけど
根本は「長押しを主要操作にしていたこと」

⋮ ボタンを常時表示して長押し廃止。
モバイルで OS の挙動と戦うより戦わない設計の方が強い。
```

## タグ

`モバイルUX` `Chrome` `user-select` `onContextMenu` `長押し` `touchstart` `Next.js` `React` `TypeScript` `Tailwind`
