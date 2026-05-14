import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'], // ESM only
	dts: {
		resolve: true,
	},
	splitting: false,
	sourcemap: false,
	clean: true,
	external: [
		// Mark workspace dependencies as external (they'll be installed separately)
		'@paradoc/types',
		'@paradoc/serialization',
		// Mark runtime dependencies as external (they're in package.json dependencies)
		'pdf-lib',
	],
})

