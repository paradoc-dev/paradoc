import { defineConfig } from 'tsup'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))

// Read renderer package versions for build-time injection
const rendererVersions = {
  '@paradoc/renderer-text': JSON.parse(readFileSync(resolve('../../packages/renderer-text/package.json'), 'utf-8')).version,
  '@paradoc/renderer-pdf': JSON.parse(readFileSync(resolve('../../packages/renderer-pdf/package.json'), 'utf-8')).version,
  '@paradoc/renderer-docx': JSON.parse(readFileSync(resolve('../../packages/renderer-docx/package.json'), 'utf-8')).version,
}

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  splitting: true,
  dts: true,
  clean: true,
  // Bundle JSON files from dependencies
  loader: {
    '.json': 'json',
  },
  // Don't externalize workspace packages that need to be bundled
  noExternal: ['@paradoc/schemas', '@paradoc/core', 'zod'],
  // Deps that must remain external (CJS or Node-provided)
  external: ['fast-glob', 'safe-regex', 'undici'],
  // Resolve @/* path alias used internally by @paradoc/core
  esbuildOptions(options) {
    options.alias = {
      '@': resolve('../../packages/core/src'),
    }
  },
  // Inject constants at build time
  define: {
    __VERSION__: JSON.stringify(packageJson.version),
    __RENDERER_VERSIONS__: JSON.stringify(rendererVersions),
  },
})
