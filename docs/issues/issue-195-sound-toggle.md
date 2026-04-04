# サウンド ON/OFF 設定（公共の場・夜間対応）

## 背景

HEART 評価「Adoption（初見で使えるか）」-5点の要因の一つ。
現在、スピンボタンを押すと必ずサウンドが再生される。
OgoRoulette は職場の昼食・公共交通機関・深夜の自宅 など
**音が出せない場面での使用が多い**にもかかわらず、ミュート手段がない。

「音が出るアプリ＝使いづらい」と感じたユーザーが離脱するリスクがある。
また iOS Safari の AudioContext 制限でそもそも音が出ない場面もあるが、
それはエラーではなく「ユーザーが選べるべき」設定の話。

## 問題

- スピン時のサウンドをユーザーが制御できない
- 職場・公共交通機関でのサイレント使用ができない
- 設定がないため「音が邪魔」と感じたユーザーが使用を諦める
- iOS の AudioContext 自動ロック解除と UI の整合性がない

## 目的

- どんな場面でも OgoRoulette を使えるようにする
- HEART Adoption を 15 → 17 に改善する
- 音ありのユーザーは今まで通りの体験を維持する

## 対応内容

### サウンド設定の State と永続化

```typescript
// lib/use-sound-setting.ts（新規）
import { useState, useEffect } from "react"

const SOUND_KEY = "ogoroulette_sound_enabled"

export function useSoundSetting() {
  const [soundEnabled, setSoundEnabled] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(SOUND_KEY)
    if (stored !== null) setSoundEnabled(stored === "true")
  }, [])

  const toggle = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    localStorage.setItem(SOUND_KEY, String(next))
  }

  return { soundEnabled, toggle }
}
```

### ホーム画面にサウンドトグルを追加

ホーム画面右上エリア（ロゴ横 または プロフィールアイコン隣）に
🔊 / 🔇 アイコンボタンを配置。

```typescript
// app/home/page.tsx
const { soundEnabled, toggle: toggleSound } = useSoundSetting()

// 既存の playPressSound 等の呼び出しを soundEnabled で guard
const handleSpin = () => {
  unlockAudioContext()
  if (soundEnabled) playPressSound()
  startSpin(participants.length)
}
```

### spin-sound.ts の全関数をトグル対応

各関数を `soundEnabled` フラグで wrap するのではなく、
呼び出し元で guard するシンプルな実装とする。

```typescript
// 各 play* 関数の呼び出し前に soundEnabled チェックを追加
// playPressSound / playSpinStartSound / playTickSound /
// playNearMissSound / playResultSound
```

### UI

ホーム画面ヘッダー右端に配置：

```tsx
<button
  onClick={toggleSound}
  aria-label={soundEnabled ? "サウンドをオフにする" : "サウンドをオンにする"}
  className="p-2 rounded-full hover:bg-white/10 transition-colors"
>
  {soundEnabled ? (
    <Volume2 className="w-5 h-5 text-white/60" />
  ) : (
    <VolumeX className="w-5 h-5 text-white/30" />
  )}
</button>
```

## 完了条件

- [x] ホーム画面にサウンドトグルボタンが表示される
- [x] OFF にするとスピン中のすべてのサウンドが無音になる
- [x] 設定が localStorage に永続化される（ページ再読込後も維持）
- [x] ON/OFF 状態がアイコンで視覚的に分かる
- [x] `npm run build` でエラーなし

## 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `lib/use-sound-setting.ts` | 新規作成（設定フック） |
| `app/home/page.tsx` | サウンドトグルUI追加・play* 呼び出しに guard 追加 |

## リスク

低。既存サウンドロジックは変更しない。guard を追加するだけ。
iOS AudioContext の挙動には影響しない。

## ステータス

**完了** — 2026-04-05

## 優先度

**Recommended** — Adoption 改善。実装コスト小（〜2時間）。

## 期待効果

- HEART Adoption: 15 → 17 (+2)
- 職場・公共交通機関での使用ハードル解消
- 総合スコア: 72 → 73

## 関連ISSUE

- issue-034（PWA manifest icon）
- issue-101（PWA インストールプロンプト）
