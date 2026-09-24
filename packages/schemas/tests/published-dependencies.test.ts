/**
 * Every package the source imports, including type-only imports, reaches the
 * published `.d.ts`. A consumer who installs only `@paradoc/schemas` must be
 * able to resolve each one, so each must be a runtime dependency, not a
 * devDependency.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
}

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name)
		if (statSync(path).isDirectory()) return sourceFiles(path)
		return path.endsWith('.ts') ? [path] : []
	})
}

/** The package name of a bare import specifier: `@scope/name` or `name`. */
function packageName(specifier: string): string {
	const parts = specifier.split('/')
	return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!
}

function importedPackages(source: string): string[] {
	const specifiers = [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!)
	return specifiers
		.filter((specifier) => !specifier.startsWith('.') && !specifier.startsWith('node:'))
		.map(packageName)
}

describe('published dependencies', () => {
	const imported = new Set(sourceFiles(join(root, 'src')).flatMap((file) => importedPackages(readFileSync(file, 'utf8'))))

	it('finds the type-only @paradoc/types import', () => {
		expect(imported).toContain('@paradoc/types')
	})

	it('declares every imported package as a runtime dependency', () => {
		const runtime = Object.keys(manifest.dependencies ?? {})
		expect([...imported].filter((name) => !runtime.includes(name))).toEqual([])
	})

	it('reads a type-only import as a package the declarations need', () => {
		expect(importedPackages("import type { Bundle } from '@paradoc/types/x';")).toEqual(['@paradoc/types'])
		expect(importedPackages("import { z } from 'zod';\nimport { a } from './local';")).toEqual(['zod'])
	})
})
