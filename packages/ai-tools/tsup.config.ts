import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	dts: {
		resolve: true,
	},
	splitting: false,
	sourcemap: false,
	clean: true,
	external: [
		'@paradoc/sdk',
		'@paradoc/core',
		'@paradoc/renderers',
		'zod',
	],
})
