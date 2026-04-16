# ISSUE-259: Security(Low) — result ページの URL パラメータに長さ・型バリデーションなし

## ステータス
🔲 TODO

## 優先度
**Low / セキュリティ（設計改善）**

## カテゴリ
Security / Input Validation / URL Parameters

---

## 概要

`/result` ページが URL クエリパラメータ（`treater`, `participants`, `total`, `treat`）を
バリデーションなしに直接使用している。
React の自動エスケープにより **現時点では XSS は発生しない** が、
任意の長さの文字列・任意の数値が受け入れられることでレイアウト崩れや
将来のコード変更による脆弱性化のリスクがある。

---

## 問題

```typescript
// app/result/_result-content.tsx:18-21
const totalBill = Number(searchParams.get("total")) || 30000  // ← NaN 等の扱い
const treatAmount = Number(searchParams.get("treat")) || 20000
const treaterName = searchParams.get("treater") || "A"  // ← 長さ制限なし
const participantNames = (searchParams.get("participants") || "A,B,C,D,E").split(",")
// ← 人数・各名前の長さ制限なし
```

### 確認済み: XSS は発生しない

```tsx
// JSX でのレンダリング（React が自動エスケープ）
<h2 className="text-3xl font-black mb-1">{treaterName}さん</h2>
// → <script>alert(1)</script> も text として表示されるだけ
```

`dangerouslySetInnerHTML` は `lp/page.tsx` の JSON-LD（固定データ）のみに使用 → 安全。

### 実際のリスク

```
# 超長い名前でのレイアウト崩れ
https://ogo-roulette.vercel.app/result?treater=AAAA...（10000文字）

# 大量の参加者
https://ogo-roulette.vercel.app/result?participants=A,B,C,...（1000人）
→ 割り勘計算が非常に多く DOM が肥大化

# 数値オーバーフロー
https://ogo-roulette.vercel.app/result?total=9007199254740992
→ Number.MAX_SAFE_INTEGER を超えると計算誤差
```

---

## 影響

- **XSS**: なし（React 自動エスケープ）
- **レイアウト崩れ**: あり（名前が超長い場合）
- **計算誤差**: あり（金額が極端な値の場合）
- **DoS**: 低（1000人の割り勘計算でブラウザが遅くなる可能性）

---

## 対応方針

```typescript
// バリデーション例
const treaterName = (searchParams.get("treater") || "A").slice(0, 20)
const rawParticipants = (searchParams.get("participants") || "A,B,C").split(",")
const participantNames = rawParticipants
  .slice(0, 20)  // 最大20人
  .map(n => n.slice(0, 20))  // 各名前最大20文字

const rawTotal = Number(searchParams.get("total"))
const totalBill = Number.isFinite(rawTotal) && rawTotal >= 0 && rawTotal <= 9_999_999
  ? rawTotal : 30000
```

---

## 完了条件

- [ ] `treaterName` を最大20文字に制限
- [ ] `participantNames` を最大20人・各20文字に制限
- [ ] `totalBill` / `treatAmount` を 0〜9,999,999 の範囲に制限
- [ ] 制限後もレイアウトが正常であることを確認

## 注意点

- `Number(str) || defaultValue` は `0` を入力した場合もデフォルト値が使われる（バグ）
  → `Number(str) !== 0 ? Number(str) : 0` のように修正する

## 関連ファイル
- `app/result/_result-content.tsx`
