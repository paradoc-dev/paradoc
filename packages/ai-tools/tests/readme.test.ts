/**
 * The README's tool count, tool table, and adapter list are what a reader
 * trusts before installing. They must match `toolDefinitions` and the
 * adapter packages that wrap this one.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { toolDefinitions } from '../src'

const PACKAGES = join(import.meta.dirname, '../..')
const README = readFileSync(join(import.meta.dirname, '../README.md'), 'utf8')
const TOOLS = Object.keys(toolDefinitions)

/** Published packages that depend on @paradoc/ai-tools. */
function adapters(): string[] {
	return readdirSync(PACKAGES, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.flatMap((entry) => {
			try {
				return [JSON.parse(readFileSync(join(PACKAGES, entry.name, 'package.json'), 'utf8')) as {
					name: string
					private?: boolean
					dependencies?: Record<string, string>
				}]
			} catch {
				return []
			}
		})
		.filter((pkg) => !pkg.private && pkg.dependencies?.['@paradoc/ai-tools'] !== undefined)
		.map((pkg) => pkg.name)
		.sort()
}

describe('ai-tools README', () => {
	it('gives the true tool count', () => {
		const counts = [...README.matchAll(/\*\*(\d+) tools\*\*/g)].map((match) => Number(match[1]))
		expect(counts).toEqual([TOOLS.length])
	})

	it('lists exactly the exported tools in the tool table', () => {
		const table = README.slice(README.indexOf('## Tools'))
		const listed = [...table.matchAll(/^\| `([a-z_]+)` \|/gm)].map((match) => match[1])
		expect([...listed].sort()).toEqual([...TOOLS].sort())
	})

	it('finds the adapters that wrap this package', () => {
		expect(adapters()).toContain('@paradoc/ai-sdk')
	})

	it('names every adapter in the overview and in related packages', () => {
		const overview = README.slice(README.indexOf('## Package overview'), README.indexOf('## Installation'))
		const related = README.slice(README.indexOf('## Related packages'))
		for (const name of adapters()) {
			expect(overview, `overview names ${name}`).toContain(`\`${name}\``)
			expect(related, `related packages name ${name}`).toContain(`\`${name}\``)
		}
	})
})
