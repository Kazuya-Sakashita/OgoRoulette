# ISSUE-126: 選択中グループのSPINボタンを視覚的に強調する

## 概要

グループリストで選択中のグループに対応するSPINボタンを、
他のグループのボタンと視覚的に区別できるようにする。

---

## 背景

- グループリスト（`GroupList`）で各グループ行にSPINボタンが並んでいる
- 選択されているグループのSPINボタンが他と同じスタイルのため、どれを押すか分かりにくい
- 「今どのグループでルーレットが回るか」を一目で理解できる必要がある

---

## 修正内容

### `components/group-list.tsx`

```tsx
// 選択中グループのSPINボタン
<Button
  className={`
    ${isSelected
      ? "bg-gradient-accent text-white font-bold shadow-md"
      : "bg-secondary text-muted-foreground"
    }
  `}
>
  SPIN
</Button>
```

- `isSelected` 時: `bg-gradient-accent`（アクセントグラデーション）+ 太字 + シャドウ
- 非選択時: `bg-secondary text-muted-foreground`（控えめなスタイル）
- 選択中グループが視覚的に「準備完了」状態であることを伝える

---

## 影響範囲

- `components/group-list.tsx`
- グループ選択とSPINの関係を視覚的に明示
- 操作ミス（意図しないグループのSPIN）の防止

---

## ステータス

✅ 完了（commit: 41768d0）
