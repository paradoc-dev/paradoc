import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

const coreSourceEntry = path.resolve(__dirname, '../../packages/core/src/index.ts')
const coreDistEntry = path.resolve(__dirname, '../../packages/core/dist/index.js')
const coreEntry = fs.existsSync(coreSourceEntry) ? coreSourceEntry : coreDistEntry

export default defineConfig({
  test: {
    silent: true,
    globals: true,
    environment: 'node',
    globalSetup: ['./tests/setup/test-registry-server.ts'],
    include: ['tests/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    passWithNoTests: true,
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['tests/**', 'node_modules/**', 'dist/**'],
    },
  },
  resolve: {
    alias: {
      '@paradoc/core': coreEntry,
      '@': path.resolve(__dirname, '../../packages/core/src'),
    },
  },
})
