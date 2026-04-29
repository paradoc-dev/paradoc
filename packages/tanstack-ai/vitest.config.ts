import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    silent: true,
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
  },
})
