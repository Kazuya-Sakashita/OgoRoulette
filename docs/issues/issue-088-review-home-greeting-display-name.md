# ISSUE-088: home画面の挨拶表示を公開名ベースへ修正する

**ステータス:** 計画中
**優先度:** High
**デプロイブロッカー:** Yes（本名露出リスクあり）

---

## 1. 問題概要

### 何が懸念か

`app/home/page.tsx:594` の挨拶表示が `user.user_metadata?.full_name` を直接参照している。
これは Supabase Auth が OAuth プロバイダ（Google・LINE）から取得したまま保持する
**プロバイダ由来名**であり、本名・フルネームが含まれる可能性がある。

```tsx
// 現状 — 危険
ようこそ、<span>{user.user_metadata?.full_name || user.email?.split('@')[0]}</span> さん
```

### なぜ確認が必要か

OgoRoulette は「画面共有・スクショ・SNS共有されやすい」設計前提のアプリ。
home画面はログイン直後に開く最初の画面であり、挨拶が見えた状態でスクリーンショットや
配信が行われる可能性が高い。

---

## 2. 現状確認結果

### home画面で現在どの名前を表示しているか

| 参照先 | 内容 | 公開安全か |
|---|---|---|
| `user.user_metadata?.full_name` | OAuth プロバイダが返したフルネーム（例: 田中 一郎）| ❌ 危険 |
| `user.email?.split('@')[0]` | メールアドレスのローカルパート（fallback） | ❌ 危険 |

### 本名露出の可能性

- **Google ログイン**: `full_name` にフルネームが入る（例: "田中 一郎"）
- **LINE ログイン**: `full_name` に LINE 表示名が入る（例: "kazuya"、実名の場合も多い）
- **メール fallback**: `tanaka.ichiro@gmail.com` → `tanaka.ichiro` が表示される

**→ 本名露出の可能性は確実に存在する。**

### 重要な発見

同じ `app/home/page.tsx` ファイル内に以下が**すでに存在する**:

```ts
// line 31 — getDisplayName は既にインポート済み
import { getDisplayName } from "@/lib/display-name"

// line 44 — profile state は既に存在
const [profile, setProfile] = useState<{ id: string; displayName: string | null; ... } | null>(null)

// line 108 — /api/profile から取得済み
if (data) setProfile({ id: data.id, displayName: data.display_name, ... })

// line 186 — ルーム作成時には既に getDisplayName(profile) を使用
const ownerName = profile ? getDisplayName(profile) : ""
```

つまり、**安全な公開名が同じファイル内で既に使われているのに、挨拶だけが取り残されている**。

---

## 3. 名前関連フィールド一覧

| フィールド | 場所 | 役割 | 公開表示 |
|---|---|---|---|
| `user.user_metadata.full_name` | Supabase Auth | OAuthプロバイダ由来フルネーム | ❌ 禁止 |
| `user.user_metadata.name` | Supabase Auth | OAuthプロバイダ由来名 | ❌ 禁止 |
| `user.email` | Supabase Auth | メールアドレス | ❌ 禁止 |
| `Profile.name` | DB | プロバイダ由来名（内部保持用）| ❌ 禁止（スキーマコメントに明記） |
| `Profile.displayName` | DB | ユーザーが設定した公開名 | ✅ 安全 |
| `getDisplayName(profile)` | lib | displayName || "ユーザー"+id末尾4文字 | ✅ 安全 |

`lib/display-name.ts` には以下のコメントが書かれている：

> 設計方針: provider_name（Profile.name）は外部公開しない

home画面の挨拶だけがこの設計方針に違反している状態。

---

## 4. 画面別の表示名参照表

| 画面 | 参照元 | 安全か | 備考 |
|---|---|---|---|
| **home** 挨拶 | `user.user_metadata?.full_name` | ❌ | **今回の修正対象** |
| **home** ルーム作成 | `getDisplayName(profile)` | ✅ | 正しく実装済み |
| **room** ページ | `member.nickname \|\| member.profile?.name` | ⚠️ | nickname は getDisplayName 由来、profile.name はプロバイダ名 fallback |
| **room/play** | `member.nickname \|\| member.profile?.name` | ⚠️ | 同上 |
| **result** | URL パラメータ（treater, winner） | ✅ | share-service.ts 経由で displayName 使用 |
| **history** | `participant.name`（セッション保存時の名前）| ✅ | ルーム参加時の nickname を保存 |
| **profile** | `profile.displayName` | ✅ | 正しく実装済み |
| **SNS シェア** | `getDisplayName(profile)` | ✅ | 正しく実装済み |

---

## 5. 評価

### Privacy 観点: ❌ 安全でない

home画面の挨拶は本名露出リスクがある。Google フルネームや LINE 実名が画面に出る。
「画面共有されやすいアプリ」という前提と真逆の実装。

### UX 観点: ⚠️ 改善余地あり

挨拶に名前を出すこと自体はウェルカム感があってよい。
ただし「provider 由来の名前が出ることをユーザーは想定していない」可能性が高い。
公開名ベースなら挨拶を残す価値はある。

### 表示名仕様の一貫性: ❌ 不整合

同じファイル内でルーム作成時は `getDisplayName()` を使っているのに、
挨拶だけが `user_metadata.full_name` を参照している。設計方針との矛盾。

---

## 6. 方針案比較

### A案: 挨拶の名前を `getDisplayName(profile)` に変更

```tsx
// profile ロード完了後: getDisplayName(profile) を表示
// profile ロード前: スケルトン or 非表示
ようこそ、<span>{getDisplayName(profile)}</span> さん
```

**メリット:**
- 最小変更。1行の修正で完結
- ウェルカム感を維持したまま安全になる
- 設計方針（`lib/display-name.ts`）と一致する
- displayName 未設定ユーザーは "ユーザーXXXX" と表示（本名は出ない）

**デメリット:**
- displayName 未設定ユーザーに "ようこそ、ユーザー3f2aさん" は少しぎこちない
- profile ロード前の一瞬、名前が出ない（スケルトン処理が必要）

**Completeness: 8/10**

---

### B案: 名前を表示しない挨拶に変える

```tsx
// 名前なし
ようこそ！
// または
さっそく始めましょう
// または文言なし（挨拶ブロック削除）
```

**メリット:**
- プライバシーリスクがゼロ
- profile ロード待ちが不要
- 最もシンプルな実装

**デメリット:**
- 個人向けウェルカム感が失われる
- 現在の「名前が出ていること」への慣れたユーザーに違和感

**Completeness: 6/10**

---

### C案: displayName 設定済みのみ名前表示、未設定は名前なし

```tsx
profile?.displayName
  ? `ようこそ、${profile.displayName}さん`
  : "ようこそ！"
```

**メリット:**
- 公開名を設定したユーザーには名前入り挨拶
- 未設定ユーザーには "ユーザーXXXX" を出さない
- ぎこちなさが最も少ない

**デメリット:**
- ロジックが少し複雑
- 未設定ユーザーに差別化がなくなる

**Completeness: 9/10**

---

### D案: 挨拶ブロックをまるごと削除

```tsx
// {user && (
//   <div className="mb-4 px-4 py-3 rounded-2xl glass-card border border-white/10">
//     <p className="text-sm text-muted-foreground">ようこそ、...</p>
//   </div>
// )}
```

**メリット:**
- リスクゼロ、コード削減
- UIがシンプルになる

**デメリット:**
- ログイン状態の視覚的フィードバックが消える
- ユーザーが「ログインできているか」確認しにくい

**Completeness: 5/10**

---

## 7. 推奨方針（結論）

**C案を採用する。**

### 理由

1. **安全性**: `Profile.displayName` しか表示しない。`full_name` も `email` も絶対に出ない。
2. **UX**: displayName 設定済みユーザーには名前入りの歓迎感。未設定ユーザーには "ようこそ！" で自然。
3. **一貫性**: `getDisplayName()` を用いずに `profile.displayName` を直接使うことで「設定した名前だけを表示する」意図が明確になる。
4. **実装コスト**: 3〜5行の変更。profile state は既存。

### リスク

- profile API が遅い場合、ログイン直後に一瞬グリーティングが "ようこそ！" になってから名前に切り替わる（許容範囲）
- displayName 未設定の既存ユーザーが "ようこそ！" になる（本名が消えるので安全方向への変化）

---

## 8. 変更計画

### 最小変更（A案）

`app/home/page.tsx:594` の1行を変更するだけ:

```tsx
// Before
ようこそ、<span className="text-foreground font-medium">{user.user_metadata?.full_name || user.email?.split('@')[0]}</span> さん

// After
ようこそ、<span className="text-foreground font-medium">{profile ? getDisplayName(profile) : "…"}</span> さん
```

変更ファイル: 1ファイル / 変更行数: 1行

---

### 安全変更（C案・推奨）

```tsx
// Before
{user && (
  <div className="mb-4 px-4 py-3 rounded-2xl glass-card border border-white/10">
    <p className="text-sm text-muted-foreground">
      ようこそ、<span className="text-foreground font-medium">{user.user_metadata?.full_name || user.email?.split('@')[0]}</span> さん
    </p>
  </div>
)}

// After
{user && (
  <div className="mb-4 px-4 py-3 rounded-2xl glass-card border border-white/10">
    <p className="text-sm text-muted-foreground">
      {profile?.displayName
        ? <>ようこそ、<span className="text-foreground font-medium">{profile.displayName}</span> さん</>
        : "ようこそ！"}
    </p>
  </div>
)}
```

変更ファイル: 1ファイル / 変更行数: 5行

---

### 理想変更（C案 + 挨拶文の見直し）

```tsx
{user && (
  <div className="mb-4 px-4 py-3 rounded-2xl glass-card border border-white/10">
    <p className="text-sm text-muted-foreground">
      {profile?.displayName
        ? <>こんにちは、<span className="text-foreground font-medium">{profile.displayName}</span> さん 👋</>
        : "今日もルーレット回しますか？"}
    </p>
  </div>
)}
```

「ようこそ」は初回ログイン感があるが毎回出る。「こんにちは」の方が日常使いに合う。
未設定時の「今日もルーレット回しますか？」は行動喚起にもなる。

変更ファイル: 1ファイル / 変更行数: 5行

---

## 9. 影響範囲

### home画面

- 表示が `user.user_metadata.full_name` → `profile.displayName` に変わる
- displayName 未設定ユーザー: `profile.displayName が null` → "ようこそ！" または "今日もルーレット回しますか？"
- profile ロード前: "ようこそ！" を表示（チラつき最小）

### 表示名仕様全体

- home 挨拶が設計方針（`lib/display-name.ts`）と一致する
- 「公開表示箇所はすべて displayName ベース」の方針が home でも徹底される

### 公開名未設定ユーザー

- 本名が消えて "ようこそ！" になる。安全方向への変化のみ。
- displayName を設定すれば名前入り挨拶になる（既存の公開名設定機能で対応）

### 他画面への影響

- 今回の変更は home の挨拶のみ。他画面は変更なし。
- room ページの `member.profile?.name` フォールバックは別 Issue 対象（後述）。

---

## 10. Issue化候補

| Issue | タイトル | 優先度 | デプロイブロッカー |
|---|---|---|---|
| **ISSUE-088**（本 Issue） | home 挨拶を公開名ベースへ修正 | High | Yes |
| ISSUE-089 | room ページの `member.profile?.name` フォールバックを見直す | Medium | No |

### ISSUE-089 の背景（参考）

`app/room/[code]/page.tsx:401` で `member.nickname || member.profile?.name || "ゲスト"` が使われている。
`member.profile?.name` はプロバイダ由来名（`Profile.name`）。

ただし通常、`member.nickname` が必ず設定されているため（ルーム作成・参加時に必須）、
`profile.name` フォールバックが実際に表示される可能性は低い。
今回の ISSUE-088 よりは優先度が低く、デプロイブロッカーでもない。

---

## タスク

- [ ] `app/home/page.tsx:594` の挨拶表示を `profile.displayName` ベースに変更
- [ ] 動作確認（displayName 設定済み・未設定・未ログインの3パターン）
- [ ] 回帰確認（他画面への影響なし）
- [ ] デプロイ

## 受け入れ条件

- home画面の挨拶に `user.user_metadata.full_name` も `user.email` も表示されない
- displayName 設定済みユーザーには名前入り挨拶が表示される
- displayName 未設定ユーザーには名前なしの自然な挨拶が表示される
- 未ログインユーザーには挨拶ブロックが表示されない（既存動作を維持）
