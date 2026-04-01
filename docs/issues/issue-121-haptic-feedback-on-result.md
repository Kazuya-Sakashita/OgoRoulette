# ISSUE-121: ホーム当選確定時にhaptic vibrationを追加する

## 概要

ルーレット結果発表時（当選者確定）にスマートフォンのバイブレーションを発動し、
視覚・聴覚に加えて触覚でも「結果発表」の瞬間を演出する。

---

## 背景

- 現状は画面演出とサウンドのみで当選者を発表している
- モバイルゲームでは触覚フィードバックが体験の一部として機能する
- `lib/haptic.ts` に `vibrate()` と `HapticPattern` が既に実装されていた
- `HapticPattern.result` パターン（長め + 短め振動）が結果発表に適合

---

## 修正内容

### `app/home/page.tsx`

```ts
import { vibrate, HapticPattern } from "@/lib/haptic"

// handleSpinComplete 内、playResultSound() の後に追加
playResultSound("win")
vibrate(HapticPattern.result)
```

- `vibrate()` は `navigator.vibrate` が未サポートの環境（iOS Safari）では何もしない設計
- Android Chrome で有効（iOSはWeb Vibration API非対応）

---

## 影響範囲

- `app/home/page.tsx`
- Android Chrome ユーザーの結果発表体験向上
- iOS では変化なし（Vibration API未対応のため）

---

## ステータス

✅ 完了（commit: 7aeb92a）
