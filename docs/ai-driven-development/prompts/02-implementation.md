# 実装フェーズ プロンプト集

## このカテゴリについて

設計が固まり、実際にコードを書き始めるフェーズで使うプロンプト群。  
「機能の実装依頼」「コンポーネント設計の相談」「APIルートの設計」など、コードを生成・設計させる用途に使う。  
コンテキストが少ないほど的外れな実装になるため、既存コードのパターンや制約を必ず渡すことが重要。

---

## プロンプト一覧

### 新機能の実装依頼
**使うタイミング**: 新しい機能を追加したいとき。「こういうものを作って」という依頼の型
**効果**: 既存コードのパターンに合った実装を一発で得られる。手戻りが減る

```
以下の仕様で新機能を実装してください。
既存コードのパターンに合わせて、TypeScriptの型を正確に付けてください。

---

## 機能の概要
ルームのQRコードスキャンによる参加機能

## 実装する内容
1. `/scan` ページにカメラ起動ボタンを追加
2. jsqr ライブラリを使ってQRコードをデコードする
3. デコードしたURLからルームコードを抽出して `/join/[code]` にリダイレクト
4. カメラ権限が拒否された場合はエラーメッセージを表示する

## 使用する技術
- Next.js 16 App Router（`app/scan/page.tsx`）
- jsqr（package.json に導入済み）
- `'use client'` コンポーネント
- shadcn/ui の Button, Card コンポーネント
- Tailwind CSS v4 でスタイリング

## 既存の類似実装（参考にすべきパターン）
```tsx
// app/room/[code]/page.tsx — カメラ権限エラーの既存ハンドリングパターン
'use client'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'

export default function ScanPage() {
  const [error, setError] = useState<string | null>(null)
  // ...
}
```

## 制約・注意事項
- `any` 型は使用禁止
- `console.log` は本番コードに残さない（デバッグ用は `console.error`）
- カメラストリームはコンポーネントのアンマウント時に必ず停止する（メモリリーク防止）
- iOSのSafariでも動作すること（getUserMedia の制約に注意）

## 期待する出力
- `app/scan/page.tsx` の完全なコード
- 必要であれば `components/qr-scanner.tsx` を別途作成
- 実装上の注意点があればコメントで明記
```

**OgoRouletteでの使用例**: ISSUE-085（QRスキャナーコンポーネント）の実装で使用。jsqrの使い方、iOSでのカメラ起動制約、アンマウント時のストリーム停止の3点を事前に制約として渡したことで、iOS対応の漏れがない実装を一発で得た。

---

### Supabase Realtime の設計相談
**使うタイミング**: リアルタイム同期機能を設計するとき。どのテーブル・イベントを購読すべきか迷ったとき
**効果**: RLS（Row Level Security）設計、チャンネル設計、フォールバック戦略をセットで得られる

```
以下の要件に合った Supabase Realtime の設計を提案してください。
セキュリティ（RLS）とパフォーマンスの両立を意識した設計にしてください。

---

## 実現したいリアルタイム機能
ルームプレイ画面（`/room/[code]/play`）で以下をリアルタイム同期したい：
1. 新しいメンバーがルームに参加したとき、全員の画面にそのメンバーを追加表示する
2. オーナーがルーレットをスピンしたとき、全メンバーの画面でアニメーションを同時に開始する
3. スピン結果（当選者）を全員に同時に表示する

## データ構造（Prisma スキーマ）
```prisma
model Room {
  id         String       @id @default(uuid())
  inviteCode String       @unique
  status     RoomStatus   // WAITING | IN_SESSION | CLOSED
  members    RoomMember[]
  sessions   RoomSession[]
}

model RoomMember {
  id       String  @id
  roomId   String
  nickname String?
  color    String
}

model RoomSession {
  id          String   @id
  roomId      String
  winnerId    String?
  startedAt   DateTime
  spinStartedAt DateTime?
}
```

## 現在の実装（3秒ポーリング）
```tsx
useEffect(() => {
  const poll = async () => {
    await fetchRoom()
    timeoutId = setTimeout(poll, 3000)
  }
  poll()
  return () => clearTimeout(timeoutId)
}, [code])
```

## 要件・制約
- Supabase Free Tier（DB接続数60上限）で動作すること
- 招待コードを持つユーザーだけがルームのデータを読める（RLS）
- Realtime が切断された場合はポーリングにフォールバックする

---

以下を出力してください：

### 1. Supabase ダッシュボードの設定
[Realtime を有効にすべきテーブルとその理由]

### 2. RLS ポリシーの設計
```sql
-- 提案するポリシーを SQL で記述
```

### 3. クライアント側の実装
```tsx
// useEffect の中で Supabase Realtime を使う実装例
```

### 4. フォールバック戦略
[Realtime 切断時にどうポーリングに切り替えるか]

### 5. 既知の落とし穴
[Supabase Realtime の仕様上注意すべき点]
```

**OgoRouletteでの使用例**: ISSUE-009（ポーリングからRealtimeへの移行）の設計で使用。このプロンプトで「postgres_changesはWebSocket切断時のmissed eventsを再送しない」という仕様上の制約が判明し、ポーリングフォールバックを設計に最初から組み込んだ。後にISSUE-146でこの判断が正しかったことが実証された。

---

### コンポーネント設計の相談
**使うタイミング**: 複雑なコンポーネントを作る前に設計をレビューしてもらいたいとき
**効果**: propsの設計ミス・状態管理の責任範囲・パフォーマンス問題を実装前に発見できる

```
以下のコンポーネントを実装する前に、設計をレビューしてください。
問題点があれば改善案も提示してください。

---

## 作りたいコンポーネント
ルーレットホイール（RouletteWheel）

## 要件
- 参加者リストを受け取り、各セグメントに名前と色を割り当てる
- スピン開始・停止をアニメーション付きで表現する（Framer Motion）
- 全メンバーの画面で同じタイミングで止まる（サーバー起点の `spinStartedAt` を使う）
- 結果（当選者）が決まったらコールバックを呼ぶ
- Canvas または SVG で描画する

## 想定している props 設計（案）
```tsx
type RouletteWheelProps = {
  participants: { id: string; name: string; color: string }[]
  isSpinning: boolean
  spinStartedAt: number | null  // サーバー起点のタイムスタンプ（ms）
  winnerId: string | null
  onSpinComplete: (winnerId: string) => void
}
```

## 技術的制約
- Next.js App Router でサーバー側レンダリングを避けるため `dynamic()` + `ssr: false` で使う
- Framer Motion v11 を使う
- Tailwind CSS v4 でスタイリング

---

以下をレビューしてください：

### 1. props 設計の問題点
[渡し方が不自然・名前が不明確・型が不正確な箇所]

### 2. 状態管理の設計
[このコンポーネントが持つべきローカル状態 vs 親から受け取るべき状態]

### 3. パフォーマンス上の懸念
[再レンダリングが多発するリスク・最適化が必要な箇所]

### 4. 同期精度を高める実装案
[`spinStartedAt` を使ってどう同期を実現するか]

### 5. 改善後のインターフェース案
```tsx
// 修正後の型定義
```
```

**OgoRouletteでの使用例**: ISSUE-058（ルーレットホイールのビジュアル改善）の前に実施。`minSpins`をクライアント側でランダム生成していたためメンバー間で回転数が異なる問題が事前に発見でき、サーバー起点の固定シードで生成する設計に変更した（ISSUE-143で実際にこのバグが修正された）。

---

### APIルートの設計
**使うタイミング**: 新しいAPIエンドポイントを作る前。セキュリティ・エラーハンドリング・レスポンス設計を固めたいとき
**効果**: バリデーション・認証チェック・エラーケース・レート制限をすべて考慮した設計書を得られる

```
以下の要件で Next.js の Route Handler（APIルート）を設計してください。
セキュリティとエラーハンドリングを含む完全な実装を出力してください。

---

## エンドポイントの概要
`POST /api/rooms/join` — ルームへの参加API

## 処理の流れ
1. リクエストボディからルームコード・ゲスト名（または認証トークン）を受け取る
2. ルームの存在・有効期限・定員（maxMembers）を確認する
3. 認証ユーザーの場合は `profileId` でメンバー作成、ゲストの場合は `nickname` でメンバー作成
4. メンバーに色を割り当てる（`SEGMENT_COLORS` の配列から順番に）
5. 作成したメンバー情報を返す

## データ構造（Prisma）
```prisma
model RoomMember {
  id        String   @id @default(uuid())
  roomId    String
  profileId String?  // 認証ユーザーはSupabase UID、ゲストはnull
  nickname  String?  // ゲスト名
  color     String
  isHost    Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

## セキュリティ要件
- レート制限: 同一IPから1分間に10リクエストまで
- 認証ユーザーは1つのルームに1回しか参加できない（DB の unique 制約）
- ゲストは同一ルームに同名で二重参加できない

## 競合状態への対策
- 定員チェックとメンバー作成をアトミックに実行する（Prismaトランザクション）
- 色の割り当ても同じトランザクション内で行う

## 既存コードのパターン
```typescript
// lib/supabase/server.ts — 認証ユーザー取得のパターン
import { createServerClient } from '@supabase/ssr'
const { data: { user } } = await supabase.auth.getUser()
```

---

以下を出力してください：

### 1. バリデーションスキーマ（Zod）
```typescript
// リクエストボディの型とバリデーション
```

### 2. 完全な Route Handler 実装
```typescript
// app/api/rooms/join/route.ts
```

### 3. エラーレスポンス一覧
| ステータスコード | エラーメッセージ | 発生条件 |
|----------------|----------------|---------|

### 4. テストケース
[手動で確認すべきエッジケースのリスト]
```

**OgoRouletteでの使用例**: `POST /api/rooms/join` 実装時に使用。Prismaトランザクションによるアトミックな定員チェック（ISSUE-048対策）と、ゲストの二重参加防止ロジック（ISSUE-024対策）が設計に最初から含まれる実装を得た。

---
