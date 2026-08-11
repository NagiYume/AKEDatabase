import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [fileURLToPath(new URL('./apps/web/src/test/setup.ts', import.meta.url))],
    include: ['packages/**/*.test.ts', 'apps/web/**/*.test.ts'],
    coverage: { reporter: ['text', 'html'] }
  }
})
