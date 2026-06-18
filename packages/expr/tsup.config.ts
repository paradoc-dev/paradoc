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
		// Workspace dependencies are installed separately by consumers.
		'@paradoc/types',
	],
})
