# シェアURLに当選者名を入れたらSNSプレビューが変わった話

「誰かがシェアしても、毎回同じ画像で埋もれる。」

それが問題だとわかっていたのに、後回しにしていた。

---

## 状況

OgoRoulette はルーレットで「誰がおごるか」を決めるアプリだ。

当選者が決まると、WinnerCard が表示される。
カードには「田中さんが奢ります！」という演出と、X・LINE のシェアボタンがある。

このシェアボタンから共有したとき、SNS のタイムラインには**アプリのロゴ画像**が表示されていた。

毎回同じ画像だ。「誰が当たったか」が全くわからない。

---

## 何が起きていたか

シェアボタンを押すと `buildShareUrl()` が呼ばれ、URL が生成される。

```typescript
// 変更前の buildShareUrl（lib/share-service.ts）
export function buildShareUrl(payload: SharePayload): string {
  if (typeof window === "undefined") return ""

  if (payload.roomCode) {
    // ルームコードがある場合: バイラルループURL
    const params = new URLSearchParams()
    params.set("room", payload.roomCode)
    params.set("ref", "share")
    params.set("winner", payload.winner)
    return `${window.location.origin}/join?${params.toString()}`
  }

  // ルームコードがない場合: 結果ページURL
  const params = new URLSearchParams()
  params.set("winner", payload.winner)
  params.set("color", payload.winnerColor ?? "")
  // ...
  return `${window.location.origin}/result?${params.toString()}`
}
```

ルームからシェアすると `/join?room=ABC123` の URL になる。

この URL を X や LINE でシェアすると、OG 画像は `/join` ページの `opengraph-image`、
つまりアプリの静的ロゴ画像が表示される。

一方、ルームコードがない場合は `/result?winner=田中&color=...` の URL になる。
`/result` ページには `generateMetadata` があり、`winner` パラメータから動的 OG 画像が生成される。

```typescript
// app/result/page.tsx の generateMetadata
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const winner = params.winner || params.treater || ""
  const ogImageUrl =
    `${baseUrl}/api/og?winner=${encodeURIComponent(winner)}&color=...`

  return {
    openGraph: {
      images: [{ url: ogImageUrl }],  // 当選者名入りの動的画像
    },
  }
}
```

`/api/og` は当選者名・色・参加人数を受け取り、その場で OG 画像を生成する。

**つまり、ルームコードがあるかどうかで、シェアのクオリティが全く違っていた。**

---

## なぜこうなっていたか

ルームコードありのシェアは「バイラルループ」として設計されていた。

「田中さんが当たった！」をシェア → 友人がリンクを踏む → そのまま同じルームに参加できる

この設計自体は正しい。問題は、バイラルループのために `/join` を使ったことで、
動的 OGP が失われたことだ。

「どちらか一方」という選択肢しか考えていなかった。

---

## 両立できることに気づいた

`/result` ページには、URL パラメータとして `room=CODE` を渡せる。

ISSUE-094 の実装で、`room=` パラメータがある場合は「このグループに参加する」ボタンが表示される。

```typescript
// app/result/_result-content.tsx
const roomCode = searchParams.get("room") || ""

// room= があればグループ参加CTAを表示
{roomActive !== "inactive" && roomCode ? (
  <Button asChild>
    <Link href={`/join/${roomCode}`}>このグループに参加する</Link>
  </Button>
) : (
  // 一般的なCTA
  <Button asChild>
    <Link href="/room/create">次の飲み会で使ってみる →</Link>
  </Button>
)}
```

つまり `/result?winner=田中&color=...&room=ABC123` という URL で、
- 動的 OGP（当選者名入り画像）
- バイラルループ CTA（ルームへの参加ボタン）

の両方が手に入る。

---

## 変更

`buildShareUrl` を一本化した。

```typescript
// 変更後（lib/share-service.ts）
export function buildShareUrl(payload: SharePayload): string {
  if (typeof window === "undefined") return ""

  // ISSUE-214: 全シェアを /result に統一して動的OGP（当選者名入り画像）を有効化
  // room= があれば /result 側で「このグループに参加する」CTA が出るのでバイラルループ維持
  const params = new URLSearchParams()
  params.set("treater", payload.winner)
  params.set("winner", payload.winner)
  if (payload.winnerColor) params.set("color", payload.winnerColor)
  if (payload.participants?.length) params.set("participants", payload.participants.join(","))
  if (payload.totalBill) params.set("total", String(payload.totalBill))
  if (payload.treatAmount) params.set("treat", String(payload.treatAmount))
  if (payload.roomCode) params.set("room", payload.roomCode)  // CTA 表示に使う
  params.set("ref", "share")
  return `${window.location.origin}/result?${params.toString()}`
}
```

`/join` ルートは使わなくなった。
ルームコードの有無にかかわらず、常に `/result` へ飛ぶ。

---

## 変わったこと

X で田中さんが奢りになったことをシェアすると、タイムラインに表示されるのは:

> **田中さんが今日の奢り神様！ - OgoRoulette**  
> 🎰 OgoRouletteで田中さんが奢りに決定！  
> [田中さんの名前と色が入った OG 画像]

「誰かがルーレットで選ばれた」という出来事が、具体的に伝わる。

見た人が「気になる！」と思う情報が OGP に入るようになった。

---

## テストで保護する

今回の変更は「`/join` に戻っていないこと」を明示的にテストした。

```typescript
// lib/share-service.test.ts
test('ISSUE-214: roomCode がある場合も /result に飛び動的OGP が有効になる', () => {
  const url = buildShareUrl({ winner: '太郎', roomCode: 'ABC123' })
  expect(url).toContain('/result')
  expect(url).toContain('room=ABC123')
  // 以前の /join? パターンに戻っていないことを確認
  expect(url).not.toContain('/join')
})
```

「動いた」で終わらせず、「元に戻らないこと」を機械的に保証する。

---

## まとめ

OGP とバイラルループは競合しない。

パラメータの設計を変えるだけで両立できた。
問題は「どちらか一方しかない」と思い込んでいたことだ。

シェアのたびに同じ画像が表示されているアプリは多いと思う。
`/result?winner=NAME` のような URL に統一するだけで、SNS プレビューは一気に変わる。

コストは小さい。やってみる価値はある。
