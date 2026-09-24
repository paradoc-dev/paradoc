/**
 * schemas-001: individual published schemas have unresolvable $refs (missing '#').
 * Input: every schemas/2026-09-23/*.json file, resolved against schemas/2026-09-23.json.
 * Expected: each $ref is `<bundle $id>#/$defs/<Name>` and names an existing $defs entry.
 * Actual: refs are `https://schema.paradoc.dev/2026-09-23.json/$defs/<Name>` (a path, no fragment).
 * Ajv 2020 also throws MissingRefError on compile of bbox.json with the bundle added.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../src/zod/config'

const dir = join(__dirname, '..', 'schemas')
const bundle = JSON.parse(readFileSync(join(dir, `${SCHEMA_VERSION}.json`), 'utf8'))
const files = readdirSync(join(dir, SCHEMA_VERSION)).filter((f) => f.endsWith('.json'))

function collectRefs(node: unknown, out: string[] = []): string[] {
	if (Array.isArray(node)) node.forEach((n) => collectRefs(n, out))
	else if (node && typeof node === 'object') {
		for (const [k, v] of Object.entries(node)) {
			if (k === '$ref' && typeof v === 'string') out.push(v)
			else collectRefs(v, out)
		}
	}
	return out
}

describe('schemas-001', () => {
	it('every $ref in an individual schema resolves to a bundle $defs entry', () => {
		const bad: string[] = []
		for (const file of files) {
			const schema = JSON.parse(readFileSync(join(dir, SCHEMA_VERSION, file), 'utf8'))
			for (const ref of collectRefs(schema)) {
				const url = new URL(ref, schema.$id)
				const base = url.href.slice(0, url.href.length - url.hash.length)
				const match = /^#\/\$defs\/(.+)$/.exec(url.hash)
				if (base !== bundle.$id || !match || !(match[1]! in bundle.$defs)) bad.push(`${file}: ${ref}`)
			}
		}
		expect(bad).toEqual([])
	})
})
