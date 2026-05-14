import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		silent: true,
		globals: true,
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		passWithNoTests: true,
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
});
