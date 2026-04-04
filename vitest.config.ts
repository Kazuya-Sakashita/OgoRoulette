import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    // .claude/ 配下のスキルテストを除外する
    exclude: ['.claude/**', 'node_modules/**', 'tests/e2e/**'],
  },
})
