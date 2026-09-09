import { defineConfig } from 'tsup'

export default defineConfig({
	entry: [
		'src/index.ts',
		'src/get-registry.ts',
		'src/get-artifact.ts',
		'src/inspect-artifact.ts',
		'src/validate-artifact.ts',
		'src/validate-input.ts',
		'src/fill.ts',
		'src/get-fill-state.ts',
		'src/update-fill.ts',
		'src/render.ts',
	],
	format: ['esm'],
	dts: {
		resolve: true,
	},
	splitting: false,
	sourcemap: false,
	clean: true,
	external: [
		'@paradoc/ai-tools',
		'@tanstack/ai',
		'zod',
	],
})
