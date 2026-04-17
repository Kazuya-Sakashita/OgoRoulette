# ISSUE-288: Medium — 無限ローディングが発生しタイムアウト機構がない

## ステータス
✅ 修正済み（2026-04-18）— AbortController で fetchRoom に 10 秒タイムアウトを追加

## 優先度
**Medium / UX / 信頼性**

## カテゴリ
Bug / UX / Loading State / Timeout

---

## 問題

ルーム参加・スピン実行・fetchRoom 等の非同期処理にタイムアウトが設定されておらず、
ネットワーク遅延やサーバー障害時にユーザーがローディング状態から抜け出せなくなる。

```typescript
// 推定: use-room-sync.ts
const [loading, setLoading] = useState(true)

async function fetchRoom() {
  setLoading(true)
  try {
    const res = await fetch(`/api/rooms/${code}`)
    const data = await res.json()
    setRoom(data)
  } catch (e) {
    // エラー時は loading が true のまま残る可能性
  } finally {
    setLoading(false)  // finally があれば問題なし
  }
}
// ↑ fetch 自体がハングした場合（finally が呼ばれない）はローディング永続
```

また API 側でも、Prisma クエリや Supabase API 呼び出しにタイムアウトを設定していない。

---

## なぜ危険か

- ユーザーが白/スケルトン画面で数十秒〜数分待つことになる
- リロードする以外に解決方法がない
- モバイルでの一時的な圏外→復帰時に発生しやすい（飲み会ユースケースで頻発）
- スピン中に発生した場合、ルームが凍結状態になる（ISSUE-285 と連鎖）

---

## 発生条件

- ネットワーク不安定（モバイルの電波が悪い場所）
- Supabase や Vercel の一時的な障害
- fetch リクエストがサーバー側でハングした場合

---

## 影響範囲

- ルーム参加画面（`/room/[code]`）
- プレイ画面（`/room/[code]/play`）
- スピン実行中の全参加者

---

## 修正方針

### 案A: AbortController でタイムアウトを設定する（推奨）

```typescript
async function fetchRoomWithTimeout(code: string, timeoutMs = 10000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`/api/rooms/${code}`, { signal: controller.signal })
    return await res.json()
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("接続がタイムアウトしました")
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }
}
```

### 案B: ローディング状態に最大時間を設ける

```typescript
// 10 秒後にローディングを強制解除してエラーメッセージを表示
useEffect(() => {
  const timeout = setTimeout(() => {
    if (loading) {
      setLoading(false)
      setError("接続がタイムアウトしました。ページをリロードしてください。")
    }
  }, 10000)
  return () => clearTimeout(timeout)
}, [loading])
```

### 案C: API 側の Prisma タイムアウトを設定する

```typescript
// Prisma クエリタイムアウト（Prisma 5 以降）
await prisma.room.findUnique({
  where: { code },
  // timeout: 5000  // Prisma の queryTimeout 設定が必要
})
```

---

## 受け入れ条件

- [ ] fetchRoom がネットワーク障害時に 10 秒以内にタイムアウトすること
- [ ] タイムアウト時にユーザーにわかりやすいエラーメッセージが表示されること
- [ ] タイムアウト後にリトライまたはリロードを促す UI が表示されること
- [ ] `setLoading(false)` が finally ブロックで確実に呼ばれること

## 関連ファイル

- `app/room/[code]/play/use-room-sync.ts`
- `app/room/[code]/play/use-spin.ts`

## 関連 ISSUE

- ISSUE-285: sendBeacon ルーム凍結（タイムアウトと連鎖する問題）
- ISSUE-287: silent failure（タイムアウト時にもサイレント失敗しないこと）
