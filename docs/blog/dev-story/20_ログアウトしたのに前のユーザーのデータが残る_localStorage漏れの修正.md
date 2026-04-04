# ログアウトしたのに前のユーザーのデータが残る：localStorage 漏れの修正

## 目次

1. [どんな不具合だったか](#どんな不具合だったか)
2. [なぜ起きるのか：signOut だけでは不十分](#なぜ起きるのか)
3. [修正の方針：全削除ではなく選択削除](#修正の方針)
4. [実装コード](#実装コード)
5. [React state のリセット漏れにも注意](#react-state-のリセット漏れ)
6. [学び](#学び)

---

## どんな不具合だったか

ログインしてグループを保存 → ログアウト → `/home` を開く。

このとき、**前のユーザーのグループが画面に表示されたまま**になっていた。

同じ端末を別の人が使う場面（家族共用、職場の共用 PC）で、他人のデータが見えてしまう状態だ。認証で守られているべきデータが、ログアウト後もブラウザに残っていた。

---

## なぜ起きるのか

### `signOut()` だけでは localStorage は消えない

多くの開発者がここでつまずく。

```typescript
// ログアウト処理（修正前）
const handleLogout = async () => {
  const supabase = createClient()
  await supabase.auth.signOut()  // セッション Cookie を削除するだけ
  router.push('/')
}
```

`supabase.auth.signOut()` が削除するのは**認証セッション（Cookie）だけ**だ。`localStorage` には一切触れない。

アプリがデータを `localStorage` に保存していれば、ログアウト後もそのまま残り続ける。

### OgoRoulette での構造

このアプリはグループデータをローカルファースト設計で保存していた。

```
localStorage["ogoroulette_groups"]  ← グループデータ（全ユーザー共通のキー）
localStorage["ogoroulette_treat_stats"]  ← 奢り統計
```

キーにユーザー ID が含まれていないため、誰のデータなのか区別できない。ログアウトしても同じキーを別ユーザーが読むと、前ユーザーのデータが表示される。

---

## 修正の方針

**全削除にしない**のがポイントだ。

このアプリは「ゲストでも使える」設計なので、ログイン前から保存していたローカルグループ（ゲストデータ）がある。ログアウト時に全削除すると、ゲスト時代のデータまで消えてしまう。

```
ログアウト時の削除対象：
  ✅ cloudId 付きグループ（クラウド同期済み = ログイン時のデータ）
  ✅ treat stats（ユーザー依存の統計）

ログアウト時に残すもの：
  ✅ cloudId なしグループ（デバイスローカルのゲストデータ）
```

`cloudId` の有無で「ログイン後に作ったデータ」と「ゲスト時代のデータ」を区別できる。

---

## 実装コード

### `lib/group-storage.ts` に `clearUserGroupData()` を追加

```typescript
export function clearUserGroupData(): void {
  if (typeof window === "undefined") return

  // cloudId なしのグループ（ゲストデータ）は保護する
  const localOnly = loadGroups().filter((g) => !g.cloudId)

  if (localOnly.length > 0) {
    // ゲストデータだけ残して上書き
    localStorage.setItem(GROUPS_KEY, JSON.stringify(localOnly))
  } else {
    localStorage.removeItem(GROUPS_KEY)
  }

  // treat stats はユーザー依存なので全削除
  localStorage.removeItem(STATS_KEY)
}
```

`typeof window === "undefined"` チェックはサーバーサイドレンダリング（SSR）対策。Next.js ではサーバー側で `localStorage` は使えないため、このガードが必要だ。

### `handleLogout` で呼び出す

```typescript
const handleLogout = async () => {
  const supabase = createClient()
  clearUserGroupData()           // ← 追加：先に localStorage をクリア
  await supabase.auth.signOut()
  router.push('/')
}
```

`signOut()` の前に呼ぶのがポイント。signOut 後に呼ぶと、タイミングによってはすでにページ遷移が始まっている場合がある。

---

## React state のリセット漏れ

localStorage を消しただけでは不十分なケースがある。

React の state に読み込まれたグループ情報は、localStorage を消しても **state の中に残り続ける**。ページ遷移なしでログアウトした場合（モーダルでログアウトなど）、state が残って画面に表示される可能性がある。

### `useGroups` フックに user 変化の監視を追加

```typescript
// hooks/use-groups.ts
useEffect(() => {
  // user が null になったとき（ログアウト）は state もリセット
  if (user === null && isLoaded) {
    setGroups(loadGroups())        // localStorage から再読み込み（クリア後なので空になる）
    setSelectedGroupId(null)
  }
}, [user, isLoaded])
```

`user` が `null` になったタイミング（ログアウト = Supabase の `onAuthStateChange` が発火したとき）に、state を localStorage から再読み込みする。localStorage は直前に `clearUserGroupData()` で消えているので、state も空になる。

### 修正の流れ全体

```
① handleLogout が呼ばれる
    ↓
② clearUserGroupData() で localStorage から cloudId 付きグループを削除
    ↓
③ supabase.auth.signOut() でセッション Cookie を削除
    ↓
④ Supabase の onAuthStateChange が user → null を通知
    ↓
⑤ useGroups の useEffect が発火、loadGroups() で state を再読み込み
    ↓
⑥ state が空（または localOnly のみ）に更新される
```

---

## 学び

### 1. `signOut()` は localStorage を消さない

Supabase に限らず、Firebase や Auth0 も同様だ。認証ライブラリの `signOut` はセッション管理（Cookie / token）の削除だけを担う。アプリが保存したデータのクリーンアップは自分で書く必要がある。

### 2. localStorage は認証とは独立している

`localStorage` はブラウザ上のユーザーアカウントではなく、「オリジン（ドメイン）単位」でデータを保持する。ログインしていても、していなくても、同じキーに同じようにアクセスできる。

アクセス制限が必要なデータを localStorage に保存する場合は、**ユーザー ID をキーに含める**か、**ログアウト時に明示的に削除する**かのどちらかが必要だ。

### 3. 全削除ではなく選択削除が必要なケースがある

「ログアウト = 全部消す」は単純で分かりやすいが、ゲスト機能がある場合はゲストデータまで消えてしまう。データに「どのユーザーのものか」を示すフラグ（今回の `cloudId`）を持たせておくと、選択削除が可能になる。

### 4. localStorage だけでなく React state のリセットも必要

ページをまたぐ SPA では、localStorage を消しても React state に残ったデータが表示され続けることがある。認証状態の変化（`user → null`）を `useEffect` で監視して state をリセットするパターンを持っておくと安全だ。

---

## まとめ

ログアウト処理で `signOut()` だけ呼んでいると、localStorage に残ったデータが「ログアウト後も見える」という状態になる。

修正は3ステップ：
1. ログアウト時に localStorage から対象データを削除する関数を作る
2. `handleLogout` でその関数を `signOut()` の前に呼ぶ
3. React の state も認証状態変化で再読み込みする

「動いているからOK」で済ませがちな部分だが、個人情報や機密データを扱うアプリでは認証境界の管理として重要だ。

---

## タイトル案

1. ログアウトしたのに前ユーザーのデータが残る：localStorage クリーンアップの実装
2. `signOut()` だけではデータは消えない：localStorage 漏れの修正パターン
3. localStorage × 認証：ログアウト時に正しくデータを削除する方法
4. ゲストデータは残して、ログインデータだけ消す：選択的 localStorage クリア
5. React state と localStorage の二重クリーンアップ：ログアウト処理の完全版

---

## SNS 投稿文

```
「ログアウトしたのに前のユーザーのデータが見える」という不具合を直した。

原因：supabase.auth.signOut() は Cookie だけ消す。localStorage は消さない。

修正内容：
- cloudId 付きグループ（クラウド同期済み）を localStorage から削除
- ゲストデータ（cloudId なし）は保護
- user → null の変化を useEffect で監視して React state もリセット

signOut だけで終わりだと思っていた。
```
