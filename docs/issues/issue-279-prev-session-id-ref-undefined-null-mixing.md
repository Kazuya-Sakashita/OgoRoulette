# ISSUE-279: Critical — prevSessionIdRef の undefined/null 混在で二重 scheduleSpin リスク

## ステータス
🔲 TODO

## 優先度
**Critical / バグ / State Management**

## カテゴリ
Bug / Race Condition / use-spin / Ref Management

---

## 問題

`prevSessionIdRef` の初期値は `undefined`、handleRespin 後は `null` に設定される。
ガード条件はこの 2 値を区別せず、予期しない二重 scheduleSpin が発生する可能性がある。

```typescript
// app/room/[code]/play/use-spin.ts
// line 73
const prevSessionIdRef = useRef<string | null | undefined>(undefined)
//                                                         ↑ 初期値 undefined

// line 228（handleRespin 内）
prevSessionIdRef.current = null
//                         ↑ null に設定（undefined ではない）
```

ガード条件:
```typescript
// スピン検知 useEffect
if (room.sessions[0]?.id === prevSessionIdRef.current) return  // 同じ → スキップ
// undefined と null は === で等しくない
// sessions[0].id（文字列）は undefined と等しくない → 初回は必ず通過
// sessions[0].id（文字列）は null と等しくない → respin 後も必ず通過
```

問題: respin 直後に fetchRoom() が 2 回呼ばれると（polling + Broadcast）、
各呼び出しで `prevSessionIdRef.current` が `null` のままガードをすり抜け、
`scheduleSpin` が 2 回実行される。

---

## なぜ危険か

- `scheduleSpin` を 2 回呼ぶと `setTimeout` が 2 個登録される
- アニメーションのタイミングがずれる / 二重で WinnerCard が表示される
- `spinScheduledRef` を二重 scheduleSpin 防止に使っているが、非同期で設定されるため競合する

---

## 発生条件

1. オーナーが respin を実行（handleRespin → `prevSessionIdRef.current = null`）
2. 直後に fetchRoom() が複数回呼ばれる（polling + Realtime 二重発火）
3. 両方の呼び出しで `sessions[0].id !== null` → ガードをすり抜ける
4. scheduleSpin が 2 回呼ばれる

---

## 影響範囲

- respin を多用するユーザー（複数回ルーレットを回す飲み会ユースケース）
- polling と Broadcast が重なるタイミング（高負荷・不安定ネットワーク）

---

## 推定原因

`undefined`（初期状態）と `null`（respin 後）を同じ意味で使っているが、
ガード条件が `===` 比較のため区別される。
設計上の一貫性欠如。

---

## 修正方針

### 案A: 初期値を null に統一する（推奨）

```typescript
// undefined を排除し null に統一
const prevSessionIdRef = useRef<string | null>(null)
// handleRespin の null 設定はそのまま
```

ただし初回 fetchRoom 時の挙動を再確認すること（null → sessions[0].id への遷移）。

### 案B: 初期値を sentinel 文字列にする

```typescript
const INITIAL_SESSION = "__initial__"
const prevSessionIdRef = useRef<string>(INITIAL_SESSION)
// respin 後は空文字か別の sentinel に設定
```

### 案C: spinScheduledRef のアトミック性を強化する

`scheduleSpin` 内で `spinScheduledRef` を同期的に立てて、二重呼び出し自体を防ぐ。
根本原因ではないが多層防御として有効。

---

## 受け入れ条件

- [ ] `prevSessionIdRef` の型から `undefined` を除去すること
- [ ] respin 後に fetchRoom() が 2 回呼ばれても scheduleSpin が 1 回だけ実行されること
- [ ] `npx tsc --noEmit` エラーなし
- [ ] respin → 通常スピンの連続動作で回帰テストが通ること

## 関連ファイル

- `app/room/[code]/play/use-spin.ts` (line 73, 228, scheduleSpin 呼び出し箇所)

## 関連 ISSUE

- ISSUE-282: spinScheduledRef 競合条件（関連する並走問題）
- ISSUE-286: polling + Realtime 二重発火（二重呼び出しの原因）
