#!/usr/bin/env node

declare const __VERSION__: string | undefined

const arg = process.argv[2]

if (arg === '--version' || arg === '-v') {
	const version = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev'
	console.log(version)
	process.exit(0)
}

await import('./cli.js')
