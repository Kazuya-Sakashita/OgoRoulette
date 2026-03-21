import nextCwvConfig from "eslint-config-next/core-web-vitals"
import nextTsConfig from "eslint-config-next/typescript"

const eslintConfig = [
  // shadcn/ui generated components and Node.js scripts are excluded
  {
    ignores: ["components/ui/**", "scripts/**"],
  },
  ...nextCwvConfig,
  ...nextTsConfig,
]

export default eslintConfig
