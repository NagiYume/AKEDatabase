import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: fileURLToPath(new URL('../../..', import.meta.url)),
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    setupFiles: [fileURLToPath(new URL('../src/test/setup.ts', import.meta.url))],
    include: ['apps/web/test/**/*.test.ts']
  }
})
