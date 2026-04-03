# Lighthouseが指摘したA11y問題を一括修正する

**レベル:** 初級  
**再利用性:** 高  
**効果:** ★★★★☆  
**タグ:** `テンプレ化`

---

## 目的

Lighthouseが指摘したAccessibility問題を、  
ファイルと行数を特定した上でAIに修正させる。

## 使用タイミング

- Lighthouse Accessibility スコアが90点未満のとき
- WCAG違反の修正を効率化したいとき

---

## プロンプト（viewport修正）

```
app/layout.tsx の viewport 設定を修正してください。

問題: maximum-scale=1 と userScalable=false が含まれており、
WCAG 2.1 SC 1.4.4（Resize text）に違反しています。

現在のコード:
export const viewport: Viewport = {
  themeColor: '#0B1B2B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,     // ← 削除
  userScalable: false, // ← 削除
}

修正後:
export const viewport: Viewport = {
  themeColor: '#0B1B2B',
  width: 'device-width',
  initialScale: 1,
}

変更後にビルドが通ることを確認してください。
```

## プロンプト（コントラスト修正）

```
{file-path} の CSS変数のコントラスト比を改善してください。

問題: --muted-foreground が背景色 {background-color} に対して
WCAG AA基準（4.5:1）を満たしていません。

現在値: {current-value}
目標コントラスト比: 4.5:1以上

修正案を3パターン提示してください：
A) opacity を上げる
B) 明度を上げた固定色に変更する
C) 背景色を考慮して計算した最適値

各パターンのコントラスト比を計算した上で提示してください。
```

## プロンプト（複数A11y修正の一括指示）

```
Lighthouseの結果をもとに、以下のA11y問題を優先度順に修正してください。

【P1 即修正】
1. {問題1}: {ファイル名}:{行番号}
   修正方法: {修正内容}

2. {問題2}: {ファイル名}:{行番号}
   修正方法: {修正内容}

【P2 今週中】
3. {問題3}: {ファイル名}:{行番号}
   修正方法: {修正内容}

P1を先に修正してコミットしてください。
P2は別コミットにしてください。
```

---

## 工夫ポイント

- 修正前後のコードを両方書いておくことで、AIが間違えにくい
- P1/P2を分けてコミットさせることで、問題の切り分けが容易になる
- コントラスト比の計算を求めると、AIが根拠を持った値を提案する

## 改善余地

- `link-in-text-block` 問題（リンクが色だけで区別されている）は、CSSだけでなくHTMLの構造変更も必要なことがある。その場合は別途プロンプトを設ける

## 実行結果

- viewport修正（ISSUE-147）: 5分で完了、meta-viewport がA11y failureから消えた
- muted-foreground修正（ISSUE-149）: opacity 0.5→0.65 に変更、コントラスト比 3.5:1→4.6:1
- Accessibility スコア: 86 → 92（+6点）
