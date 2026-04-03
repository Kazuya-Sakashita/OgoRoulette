# 静的importと動的importのトレードオフ判断

**レベル:** 中級  
**再利用性:** 高  
**効果:** ★★★☆☆

---

## 目的

`next/dynamic` による動的importが適切かどうかを判断し、  
ChunkLoadErrorを引き起こすリスクがある場合は静的importに戻す。

## 使用タイミング

- Lighthouseに「未使用JavaScriptを削減してください」と言われたとき
- ChunkLoadErrorが本番で発生したとき
- パフォーマンスと信頼性のトレードオフを判断したいとき

---

## プロンプト（判断フレームワーク）

```
{コンポーネント名} を next/dynamic で動的importするかどうか判断してください。

コンポーネントの特性:
- ファイルサイズ: {サイズ}
- SSRが必要か: {yes/no}
- 初回表示に必要か: {yes/no}
- デプロイ頻度: {頻度}

判断基準:
A) 動的import推奨: ファイルサイズが大きい AND 初回表示不要 AND デプロイ頻度が低い
B) 静的import推奨: ファイルサイズが小さい OR 初回表示に必要 OR デプロイ頻度が高い

ChunkLoadErrorのリスク:
- デプロイ時にchunkハッシュが変わる
- 古いHTMLが新しいchunkを参照できなくなる
- error.tsx の reload がキャッシュから旧HTMLを取得して無限ループになる

リスク評価と推奨を出力してください。
```

## プロンプト（静的importへの戻し方）

```
以下の動的importを静的importに戻してください。

現状（削除）:
import dynamic from "next/dynamic"
const {ComponentName} = dynamic(
  () => import("{import-path}").then((m) => ({ default: m.{ComponentName} })),
  { ssr: false, loading: () => <div style={{ width: 220, height: 220 }} /> }
)

修正後（追加）:
import { {ComponentName} } from "{import-path}"

変更後:
1. npm run build でエラーなし確認
2. loading状態（<div style={{...}} />）が残っていないか確認
3. コミット: "revert: {ComponentName} を next/dynamic から静的importに戻す"
```

---

## 工夫ポイント

- 判断基準をA/Bで明示することで、AIが根拠を持った推奨を出す
- ChunkLoadErrorの発生メカニズムをプロンプトに含めることで、AIが無限ループリスクを理解して評価する

## 改善余地

- error.tsx に ChunkLoadError ハンドラーを追加する場合は別プロンプトで実施する
- `next/dynamic` が有効なケース（SSR不要の重い可視化ライブラリなど）はこのプロンプトでは扱わない

## 実行結果

- `RouletteWheel` の動的import導入後に本番でChunkLoadError発生
- 静的importに戻す判断をした（所要判断時間: 10秒）
- 合わせて error.tsx に sessionStorage ガード付きリロードを追加
