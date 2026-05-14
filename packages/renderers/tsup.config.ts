import { defineConfig } from 'tsup'

export default defineConfig({
	entry: [
		'src/index.ts',
		'src/pdf.ts',
		'src/docx.ts',
		'src/text.ts',
	],
	format: ['esm'], // ESM only
	dts: {
		resolve: true,
	},
	splitting: false,
	sourcemap: false,
	clean: true,
	external: [
		// Mark workspace dependencies as external (they'll be installed separately)
		'@paradoc/renderer-docx',
		'@paradoc/renderer-pdf',
		'@paradoc/renderer-text',
	],
})

