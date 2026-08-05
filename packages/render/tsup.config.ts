import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/text.ts', 'src/pdf.ts', 'src/docx.ts'],
  format: ['esm'],
  dts: { resolve: true },
  splitting: true,
  sourcemap: false,
  clean: true,
  external: ['@paradoc/serialization', '@paradoc/types'],
})
