import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'

const appRoot = fileURLToPath(new URL('.', import.meta.url))
const repositoryRoot = resolve(appRoot, '../..')
function emitRootRuntimeFiles(): Plugin {
  return {
    name: 'ake-root-runtime-files',
    configureServer(server) {
      const runtimeFiles = new Map([
        [
          '/version.json',
          { path: resolve(repositoryRoot, 'version.json'), type: 'application/json; charset=utf-8' }
        ],
        [
          '/icon_default_missing.png',
          { path: resolve(repositoryRoot, 'icon_default_missing.png'), type: 'image/png' }
        ]
      ])
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
        const file = runtimeFiles.get(pathname)
        if (!file) {
          next()
          return
        }
        response.statusCode = 200
        response.setHeader('Content-Type', file.type)
        response.end(readFileSync(file.path))
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: readFileSync(resolve(repositoryRoot, 'version.json'))
      })
      this.emitFile({
        type: 'asset',
        fileName: 'icon_default_missing.png',
        source: readFileSync(resolve(repositoryRoot, 'icon_default_missing.png'))
      })
      this.emitFile({ type: 'asset', fileName: '_redirects', source: '/* /index.html 200\n' })
    }
  }
}

export default defineConfig({
  root: appRoot,
  publicDir: 'public',
  plugins: [vue(), emitRootRuntimeFiles()],
  server: {
    host: '127.0.0.1',
    port: 4173
  },
  preview: {
    host: '127.0.0.1',
    port: 4173
  },
  worker: { format: 'es' },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/vue/') || id.includes('/vue-router/') || id.includes('/pinia/')) return 'vue'
          if (id.includes('/@tanstack/vue-query/')) return 'query'
          if (id.includes('/@vue-flow/') || id.includes('/elkjs/')) return 'graph'
          return undefined
        }
      }
    }
  }
})
