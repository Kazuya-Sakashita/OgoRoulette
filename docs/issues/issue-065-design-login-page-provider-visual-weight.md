# ISSUE-065: ログインページのプロバイダーボタンに視覚的重み付けがなく、X が後から追加された印象を与える

## ステータス
🔴 未対応

## 優先度
**Low**

## カテゴリ
Design / UX

## 概要
`/auth/login` ページの Google・LINE・X の3ボタンは同一サイズで縦並びだが、X ボタン（黒背景）が LINE（緑）・Google（白）と異なる色系統で浮いており、後から追加された感が出ている。また、「QR コードで参加」導線がページ内にある場合、これも含めた全体の視覚的整理が必要。

## 問題の詳細

### ボタン色の不統一感
| ボタン | 背景色 | テキスト色 |
|--------|--------|-----------|
| Google | 白 | グレー |
| LINE | 緑（#06C755） | 白 |
| X | 黒 | 白 |

3つが異なる色系統で、「3択を提供している」という統一感よりも「バラバラに追加された」印象。

### /auth/login vs / (トップページ) の差異
- `/auth/login`: Google・LINE・X + QR コード参加
- `/` (トップページ): Google・LINE・X + ゲストモード

同じ3プロバイダーを提供しているが、ページごとのレイアウトが微妙に異なる。ボタンの仕様（テキスト・スタイル）を共通コンポーネント化できていない可能性がある。

## 改善案

### 短期: ボタンの枠線統一
```css
/* 全プロバイダーボタンに共通枠線 */
border: 1px solid rgba(255,255,255,0.15);
```
共通の枠線を付けることでバラバラ感が軽減する。

### 中期: SocialLoginButton コンポーネント化
```typescript
<SocialLoginButton provider="google" onClick={handleGoogleLogin} />
<SocialLoginButton provider="line"   onClick={handleLineLogin} />
<SocialLoginButton provider="x"      onClick={handleXLogin} />
```
`/auth/login` と `/` の両方で同一コンポーネントを使用し、デザインの一貫性を保つ。

### ボタンテキスト統一（ISSUE-057 と連動）
`/auth/login` のボタンテキストも「〜で始める」に統一する。

## 影響範囲
- `app/auth/login/page.tsx`
- `app/page.tsx`
- 共通コンポーネント化する場合: `components/social-login-button.tsx` 新規作成

## 参考スクリーン
ログインページ (`/auth/login`) — design-shotgun 評価 2026-03-28
