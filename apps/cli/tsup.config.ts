import { defineConfig } from 'tsup'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))

// Read the unified renderer package version for build-time injection
const rendererVersions = {
  '@paradoc/render': JSON.parse(readFileSync(resolve('../../packages/render/package.json'), 'utf-8')).version,
  '@paradoc/react': JSON.parse(readFileSync(resolve('../../packages/react/package.json'), 'utf-8')).version,
}
// Peer versions per renderer, read from what the workspace actually resolves
// (`react`/`react-dom` are ranges in @paradoc/react's own peerDependencies, so
// the exact version installed alongside it is read from its node_modules).
const rendererPeerVersions = {
  '@paradoc/render': {
    '@paradoc/types': JSON.parse(readFileSync(resolve('../../packages/types/package.json'), 'utf-8')).version,
    '@paradoc/format': JSON.parse(readFileSync(resolve('../../packages/format/package.json'), 'utf-8')).version,
  },
  '@paradoc/react': {
    react: JSON.parse(readFileSync(resolve('../../packages/react/node_modules/react/package.json'), 'utf-8')).version,
    'react-dom': JSON.parse(readFileSync(resolve('../../packages/react/node_modules/react-dom/package.json'), 'utf-8')).version,
  },
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
  // Deps that must remain external (CJS or Node-provided).
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
    __RENDERER_PEER_VERSIONS__: JSON.stringify(rendererPeerVersions),
  },
})
