# ISSUE-274: GET /api/og — color パラメータが CSS に未検証のまま埋め込まれる

## 概要

`GET /api/og?color=xxx` の `color` パラメータがバリデーションなしで
CSS の `background` / `radial-gradient` に直接埋め込まれている。
CSS Injection により意図しないスタイル挿入が可能な状態。

---

## 対象ファイル

`app/api/og/route.tsx` — line 37

```typescript
// 現状（未検証）
const color = searchParams.get("color") || "#F97316"

// CSS に直接埋め込み
background: `linear-gradient(150deg, ${color}33 0%, ...)`
background: `radial-gradient(ellipse at 50% 55%, ${color}55 0%, ...)`
background: color,
```

---

## リスク評価

| 項目 | 内容 |
|------|------|
| 深刻度 | Low |
| 悪用難度 | 中（CSS Injection — JS実行には至らない） |
| 影響範囲 | OGP画像の見た目のみ（ImageResponse は SVG→PNG変換） |
| XSS | ❌ 不可（ImageResponse はHTML非生成） |

ImageResponse は satori 経由で PNG 画像を生成するため、スクリプト実行は不可能。
ただし、不正な `color` 値でサーバーエラーや意図しないレンダリングが起きる可能性がある。

---

## 修正内容

```typescript
// app/api/og/route.tsx

const rawColor = searchParams.get("color") || "#F97316"
// hex カラーのみ許可（#RGB / #RRGGBB 形式）
const color = /^#[0-9a-fA-F]{3,6}$/.test(rawColor) ? rawColor : "#F97316"
```

---

## 受け入れ条件

- [ ] `color` を正規表現 `/^#[0-9a-fA-F]{3,6}$/` で検証し、不正値はデフォルト `#F97316` にフォールバック
- [ ] `pnpm typecheck` 通過

---

## 優先度: Low

- XSS・情報漏洩には至らない
- 画像生成の見た目崩れ防止が主目的

## 関連 ISSUE
- ISSUE-273: 最終セキュリティ監査完了ログ（第5回）
- ISSUE-259: result URL パラメータバリデーション（同種の修正）
