# ISSUE-244: Security(High) — ゲスト名・プリセット名のサーバー側サニタイズ不足

## ステータス
🔲 TODO

## 優先度
**High / セキュリティ**

## カテゴリ
Security / Input Validation / XSS

---

## 概要

ゲスト参加時のニックネームとルーム作成時のプリセットメンバー名に対して、
文字種のバリデーションが長さチェックのみであり、危険な文字列がそのまま DB に保存される。
React は JSX テキストコンテキストを自動エスケープするため現時点での XSS リスクは低いが、
将来的に `dangerouslySetInnerHTML` や OGP メタタグ等で名前を使う実装を追加した場合に
XSS が発生するリスクがある。

---

## 問題

### 該当箇所

**`app/api/rooms/join/route.ts`**
```typescript
const trimmedGuestName = (guestName as string).trim()
if (trimmedGuestName.length > 20) {
  return NextResponse.json({ error: "名前は20文字以内..." }, { status: 400 })
}
// ← 危険な文字列チェックなしで DB 保存へ
```

**`app/api/rooms/route.ts`**
```typescript
const validPresetNames: string[] = Array.isArray(presetMemberNames)
  ? presetMemberNames
      .filter((n: unknown): n is string =>
        typeof n === "string" && n.trim().length > 0 && n.trim().length <= 20)
      .map((n: string) => n.trim())
      .slice(0, 19)
  : []
// ← 重複チェックなし / 文字種チェックなし
```

---

## 原因

入力バリデーションが「長さ」と「型」のみで、以下が未検証：
- HTML 特殊文字（`<`, `>`, `"`, `'`, `&`）
- ゼロ幅文字・制御文字
- プリセット名の重複

---

## 影響

- **現在のリスク**: 低（React JSX の自動エスケープで XSS は発生しない）
- **将来のリスク**: 高（OGP タグ生成・PDF出力・メール送信等で生のHTMLに埋め込まれた場合）
- **副次的問題**: 重複プリセット名によるルーレット UI の混乱

---

## 対応方針

### 1. 文字種ホワイトリスト or サニタイズ
```typescript
// 推奨: strip 制御文字 + ゼロ幅文字
const safeName = name.replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, '').trim()
```

### 2. 重複チェック（presetMemberNames）
```typescript
const unique = [...new Set(validPresetNames)]
```

### 3. 表示箇所に防御的エスケープを追加
OGP / メタタグ等でユーザー名を使う場合は必ずエスケープ関数を通す。

---

## 完了条件

- [ ] ゲスト名に制御文字・ゼロ幅文字が含まれる場合、400 エラーを返す
- [ ] presetMemberNames で重複値が排除される
- [ ] ゲスト名バリデーションのユニットテストを追加

## 注意点

- 絵文字は許可すること（飲み会シーンでの名前に使われる）
- 正規表現の変更はフロントエンドの文字数カウントと合わせて確認する

## 関連ファイル
- `app/api/rooms/join/route.ts`
- `app/api/rooms/route.ts`
