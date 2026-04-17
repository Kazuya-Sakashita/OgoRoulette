# ISSUE-284: High — WinnerCard share ハンドラの stale closure でシェアURLが古い当選者を参照する

## ステータス
✅ 調査完了・対応不要（2026-04-18）— ISSUE-276 で resultToken/sessionId を WinnerData state に含めた時点で解消済み。setWinner() でアトミックに更新されるため stale closure リスクなし。share handler は shareUrl（sessionId/resultToken を含む）を deps に持つ。

## 優先度
**High / バグ / UX**

## カテゴリ
Bug / Stale Closure / WinnerCard / Share

---

## 問題

`WinnerCard` のシェアボタンハンドラは `winnerData`（useState）を closure でキャプチャするが、
`resultToken` / `sessionId` は別の ref（`resultTokenRef` / `resultSessionIdRef`）で管理されている。

```typescript
// app/room/[code]/play/use-spin.ts（推定）
const [winnerData, setWinnerData] = useState<WinnerData | null>(null)
const resultTokenRef = useRef<string | null>(null)
const resultSessionIdRef = useRef<string | null>(null)

// WinnerCard の onShare ハンドラ
const handleShare = useCallback(() => {
  buildShareUrl({
    winner: winnerData?.name,     // ← state（最新）
    token: resultTokenRef.current, // ← ref（最新）
    session: resultSessionIdRef.current, // ← ref（最新）
  })
}, [winnerData])  // ← winnerData のみが依存配列
```

問題: `respin` 後に `winnerData` が更新されると `handleShare` が再生成されるが、
その時点で `resultTokenRef.current` が次のスピンのトークンにまだ更新されていない場合、
古いトークン + 新しい当選者名の矛盾したシェア URL が生成される。

---

## なぜ危険か

- シェア URL の HMAC トークンと当選者名が一致しない → `invalid` バッジが表示される
- ユーザーが LINE でシェアしたリンクが「改ざんされた可能性があります」と表示される
- ISSUE-276 の HMAC 信頼性機能が逆に UX を悪化させる

---

## 発生条件

1. スピン A → WinnerCard 表示
2. respin（2 回目のスピン）を実行
3. WinnerCard が閉じる前（または閉じた直後）にシェアボタンを押す
4. `winnerData` は B の当選者、`resultTokenRef` は A のトークンのまま

---

## 影響範囲

- respin 機能を使うユーザー（スピン後にやり直しを押して再度スピンするユーザー）
- シェアボタンを積極的に使うユーザー

---

## 推定原因

State と Ref を混在させてシェアペイロードを組み立てているため、更新タイミングのずれが生じる。
`buildShareUrl` に渡すデータが複数のソース（state・ref）から来ており、原子性がない。

---

## 修正方針

### 案A: WinnerCard 表示時に全シェアデータを一度に state に保存する（推奨）

```typescript
interface WinnerData {
  name: string
  winnerIndex: number
  sessionId: string | null
  resultToken: string | null
}
// ← resultToken と sessionId も winnerData に含める
// ← setWinnerData 呼び出し時に全部一緒に設定する
// ← ref との混在を排除
```

### 案B: handleShare を ref に格納する（useRef + 毎レンダー更新パターン）

```typescript
const handleShareRef = useRef(handleShare)
useEffect(() => { handleShareRef.current = handleShare })
// ← 常に最新の closure を参照
```

---

## 受け入れ条件

- [ ] respin 後のシェア URL に正しいトークンと当選者名が含まれること
- [ ] `/result` ページで ✅ バッジが表示されること（token 検証が通ること）
- [ ] `npx tsc --noEmit` エラーなし

## 関連ファイル

- `app/room/[code]/play/use-spin.ts` (resultTokenRef, resultSessionIdRef, handleShare)
- `components/winner-card.tsx`
- `lib/share-service.ts`

## 関連 ISSUE

- ISSUE-276: HMAC result token（このバグが顕在化する機能）
- ISSUE-283: use-spin.ts リファクタ（state/ref 混在の根本原因）
