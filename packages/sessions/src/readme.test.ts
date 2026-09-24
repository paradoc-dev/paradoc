/**
 * The README is published to npm, so every Paradoc package it names must be
 * one a reader can install.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const PACKAGES = join(import.meta.dirname, '../..')
const README = readFileSync(join(import.meta.dirname, '../README.md'), 'utf8')

/** Names of the packages in this repository that are published to npm. */
function publishedPackages(): Set<string> {
	const names = readdirSync(PACKAGES, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.flatMap((entry) => {
			try {
				const pkg = JSON.parse(readFileSync(join(PACKAGES, entry.name, 'package.json'), 'utf8')) as { name: string; private?: boolean }
				return pkg.private ? [] : [pkg.name]
			} catch {
				return []
			}
		})
	return new Set(names)
}

describe('sessions README', () => {
	const named = [...new Set([...README.matchAll(/@paradoc\/[a-z0-9-]+/g)].map((match) => match[0]))]

	it('names Paradoc packages', () => {
		expect(named).toContain('@paradoc/core')
	})

	it('names only published packages', () => {
		const published = publishedPackages()
		expect(named.filter((name) => !published.has(name))).toEqual([])
	})
})
