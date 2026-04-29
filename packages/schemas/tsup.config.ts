import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'], // ESM only
	dts: true, // Generate .d.ts but don't bundle type dependencies
	splitting: false,
	sourcemap: false,
	clean: true,
	preserveImportMeta: true, // Preserve JSON import attributes
	external: [
		// Zod types should be referenced, not bundled
		'zod',
	],
})

