import nextCwvConfig from "eslint-config-next/core-web-vitals"
import nextTsConfig from "eslint-config-next/typescript"

const eslintConfig = [
  {
    ignores: [
      // shadcn/ui generated components and Node.js scripts
      "components/ui/**",
      "scripts/**",
      // Claude Code / gstack internal files (not project source)
      ".claude/**",
    ],
  },
  ...nextCwvConfig,
  ...nextTsConfig,
  // eslint-plugin-react-hooks@7 (next@16.2.x で導入) の新しい厳格ルールを無効化。
  // これらのルールは既存の正規 React パターンを誤検知するため off にする。
  //
  // react-hooks/set-state-in-effect:
  //   useEffect 内で setState を直接呼ぶことを禁じる新ルール。
  //   SSRガード (setMounted)・MediaQuery 初期化・アニメーション起動など
  //   正当なパターンでも全て error になるため無効化。
  //
  // react-hooks/purity:
  //   レンダー中に Date.now() 等の impure 関数を呼ぶことを禁じる。
  //   時刻ベースの有効期限チェックやラベル計算は意図的なもの。
  //
  // react-hooks/preserve-manual-memoization:
  //   React Compiler が手動 memoization を保持できない場合に error を出す。
  //   既存の useCallback + eslint-disable-line と競合するため無効化。
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
]

export default eslintConfig
