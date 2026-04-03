# デプロイ後の変更反映確認チェックリスト

**レベル:** 初級  
**再利用性:** 高  
**効果:** ★★★★☆  
**タグ:** `テンプレ化`

---

## 目的

デプロイ後に変更が正しく本番に反映されているか、  
CDNキャッシュの影響を除外した上で確認する。

## 使用タイミング

- コードを変更してデプロイした直後
- 「修正したのに変わっていない」と感じたとき
- A/B確認（stagingと本番の比較）をするとき

---

## プロンプト（キャッシュバイパス確認）

```
以下の変更がデプロイ後に正しく反映されているか確認してください。

変更内容:
- {変更1: ファイル名・変更内容}
- {変更2: ファイル名・変更内容}

確認方法（CDNキャッシュを避けるため、キャッシュバスター付きURLを使用）:
URL: {app-url}?v=$(date +%s)

各変更の確認コマンド:
1. {変更1の確認方法}
   例: $B js "(()=>{ return document.querySelector('meta[name=viewport]')?.getAttribute('content'); })()"
   期待値: {期待する値}

2. {変更2の確認方法}
   例: $B js "(()=>{ const el = document.querySelector('.{selector}'); return el ? getComputedStyle(el).color : 'not found'; })()"
   期待値: {期待する値}

スクリーンショットも撮って目視確認してください。
```

## プロンプト（GitHubデプロイ状況確認）

```
最新のコミット（{commit-hash}）がVercelにデプロイされているか確認してください。

確認方法:
gh api repos/{owner}/{repo}/deployments \
  --jq '.[0:3] | .[] | {id: .id, sha: .sha, created: .created_at, environment: .environment}'

sha が {commit-hash} であることと、
状態が "success" であることを確認してください。
```

---

## 工夫ポイント

- `?v=$(date +%s)` を常に付けることでCDNキャッシュを確実にバイパスできる
- JSを使ったDOM確認はReactのレンダリング後の実際の値が取れるので確実
- GitHubのdeployments APIを使うとVercelのデプロイ状況を確認できる

## 改善余地

- Service Workerがある場合はSWのキャッシュも確認する必要がある
- `window.navigator.serviceWorker.getRegistrations()` でSWの状態を確認できる

## 実行結果

このプロンプトで発見した問題:
- CDNキャッシュが旧HTMLを返し続けていた（解決: キャッシュバスター付きURL使用）
- viewport変更の確認で `maximum-scale=1` がまだ残っているように見えた（CDNキャッシュが原因）
- キャッシュバスター付きURLでは正しく `width=device-width, initial-scale=1` が返ることを確認
