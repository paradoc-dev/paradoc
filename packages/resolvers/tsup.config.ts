import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    fs: 'src/fs/index.ts',
    memory: 'src/memory/index.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  external: ['@paradoc/types'],
})
