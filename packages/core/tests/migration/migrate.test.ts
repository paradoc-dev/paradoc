import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { parse as parseYaml } from 'yaml'
import { PARADOC_SCHEMA_URL, SCHEMA_VERSION, SCHEMA_VERSIONS, schemaVersionUrl } from '@paradoc/schemas'
import {
	MIGRATION_STEPS,
	SchemaMigrationError,
	UnconvertibleValueError,
	migrateArtifact,
	migrateArtifactSource,
	type MigrationStep,
} from '@/migration'
import { validate } from '@/validation/artifact'

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf-8')

type Json = Record<string, any>

function migrationError(run: () => unknown): SchemaMigrationError {
	try {
		run()
	} catch (error) {
		if (error instanceof SchemaMigrationError) return error
		throw error
	}
	throw new Error('Expected the migration to fail')
}

const current = { $schema: PARADOC_SCHEMA_URL, kind: 'document', name: 'notice' }

describe('migration step registry', () => {
	test('a step leads from every published version to the next, in order', () => {
		const pairs = SCHEMA_VERSIONS.slice(1).map((to, index) => `${SCHEMA_VERSIONS[index]}->${to}`)
		expect(MIGRATION_STEPS.map((step) => `${step.from}->${step.to}`)).toEqual(pairs)
	})

	test('an artifact of every earlier version reaches the current one', () => {
		for (const version of SCHEMA_VERSIONS) {
			const result = migrateArtifact({ ...current, $schema: schemaVersionUrl(version) })
			if (version === SCHEMA_VERSION) expect(result.status).toBe('current')
			else expect(result).toMatchObject({ status: 'migrated', from: version, to: SCHEMA_VERSION })
		}
	})

	test('a missing step fails naming the gap', () => {
		const steps = MIGRATION_STEPS.filter((step) => step.from !== '2026-08-10')
		const error = migrationError(() => migrateArtifact({ ...current, $schema: schemaVersionUrl('2026-08-06') }, { steps }))
		expect(error.code).toBe('no-migration-path')
		expect(error.message).toContain('2026-08-10 to 2026-09-22')
	})
})

describe('2026-08-10 to 2026-09-22', () => {
	test('renames the signature placement auto to flow, and the result validates', () => {
		const source = JSON.parse(fixture('lease-2026-08-10.json'))
		expect(validate(source).issues).toBeDefined()

		const result = migrateArtifact(source)
		if (result.status !== 'migrated') throw new Error('expected a migration')
		const artifact = result.artifact as Json

		expect(result.steps.map((step) => step.to)).toEqual(['2026-09-22'])
		expect(artifact.$schema).toBe(PARADOC_SCHEMA_URL)
		expect(artifact.layers.markdown.signatures.tenantSignature.placement).toBe('flow')
		expect(validate(artifact).issues).toBeUndefined()
		// The input is never changed.
		expect(source.layers.markdown.signatures.tenantSignature.placement).toBe('auto')
	})

	test('renames placements in inline artifacts of a bundle', () => {
		const form = JSON.parse(fixture('lease-2026-08-10.json'))
		delete form.$schema
		const bundle = {
			$schema: schemaVersionUrl('2026-08-10'),
			kind: 'bundle',
			name: 'packet',
			contents: [{ type: 'inline', key: 'lease', artifact: form }],
		}
		const result = migrateArtifact(bundle)
		if (result.status !== 'migrated') throw new Error('expected a migration')
		const migrated = result.artifact as Json
		expect(migrated.contents[0].artifact.layers.markdown.signatures.tenantSignature.placement).toBe('flow')
	})

	test('an empty duration default cannot be converted and is named', () => {
		const source = JSON.parse(fixture('lease-2026-08-10.json'))
		source.fields.stay.default = 'PT'
		const error = migrationError(() => migrateArtifact(source))
		expect(error.code).toBe('unconvertible-value')
		expect(error.message).toContain('fields.stay.default = "PT"')
	})

	test('an inline React layer cannot be converted and is named', () => {
		const source = JSON.parse(fixture('lease-2026-08-10.json'))
		source.layers.markdown.mimeType = 'text/tsx'
		const error = migrationError(() => migrateArtifact(source))
		expect(error.code).toBe('unconvertible-value')
		expect(error.message).toContain('layers.markdown.mimeType = "text/tsx"')
	})
})

describe('reading the source version', () => {
	test('a current artifact is left as it is', () => {
		expect(migrateArtifact(current)).toEqual({ status: 'current', version: SCHEMA_VERSION, artifact: current })
	})

	test('a dated individual schema address names its version', () => {
		const result = migrateArtifact({ ...current, $schema: 'https://schema.paradoc.dev/2026-08-10/document.json' })
		expect(result).toMatchObject({ status: 'migrated', from: '2026-08-10' })
	})

	test('a missing $schema needs a named source version', () => {
		const { $schema: _, ...unversioned } = current
		expect(migrationError(() => migrateArtifact(unversioned)).code).toBe('missing-version')
		const result = migrateArtifact(unversioned, { from: '2026-08-10' })
		expect(result).toMatchObject({ status: 'migrated', from: '2026-08-10', artifact: { $schema: PARADOC_SCHEMA_URL } })
	})

	test('an undated Paradoc address needs a named source version', () => {
		const undated = { ...current, $schema: 'https://schema.paradoc.dev/schema.json' }
		const error = migrationError(() => migrateArtifact(undated))
		expect(error.code).toBe('missing-version')
		expect(error.message).toContain('--from')
		expect(migrateArtifact(undated, { from: SCHEMA_VERSION })).toMatchObject({
			status: 'migrated',
			steps: [],
			artifact: { $schema: PARADOC_SCHEMA_URL },
		})
	})

	test('a named version that disagrees with $schema fails', () => {
		const error = migrationError(() => migrateArtifact({ ...current, $schema: schemaVersionUrl('2026-08-06') }, { from: '2026-08-10' }))
		expect(error.code).toBe('version-conflict')
	})

	test.each([
		['an unpublished date', 'https://schema.paradoc.dev/2025-01-01.json', '2025-01-01'],
		['a foreign address', 'https://example.com/schema.json', 'not a Paradoc schema address'],
	])('%s is an unknown version', (_label, address, named) => {
		const error = migrationError(() => migrateArtifact({ ...current, $schema: address }))
		expect(error.code).toBe('unknown-version')
		expect(error.message).toContain(named)
		expect(migrateArtifact({ ...current, $schema: address }, { from: '2026-08-10' })).toMatchObject({
			status: 'migrated',
			from: '2026-08-10',
			artifact: { $schema: PARADOC_SCHEMA_URL },
		})
	})

	test('input that is not an artifact fails', () => {
		expect(migrationError(() => migrateArtifact(['form'])).code).toBe('not-an-artifact')
	})
})

describe('a step', () => {
	const renameTitle: MigrationStep = {
		from: '2026-08-10',
		to: '2026-09-22',
		summary: 'Moves a legacy heading into title.',
		apply(artifact) {
			const { heading, ...rest } = artifact
			if (heading !== undefined && typeof heading !== 'string') {
				throw new UnconvertibleValueError(['heading'], heading, 'a heading must be text')
			}
			return heading === undefined ? rest : { ...rest, title: heading }
		},
	}
	const steps = [...MIGRATION_STEPS.filter((step) => step.to !== '2026-09-22'), renameTitle]
	const previous = { $schema: schemaVersionUrl('2026-08-06'), kind: 'document', name: 'notice', heading: 'Notice' }

	test('applies in order from an earlier version and the result validates', () => {
		const result = migrateArtifact(previous, { steps })
		if (result.status !== 'migrated') throw new Error('expected a migration')
		expect(result.steps.map((step) => step.summary)).toEqual([
			'No breaking change: adds the layer signatures slot map.',
			'Moves a legacy heading into title.',
		])
		expect(result.artifact).toEqual({ $schema: PARADOC_SCHEMA_URL, kind: 'document', name: 'notice', title: 'Notice' })
		expect(validate(result.artifact).issues).toBeUndefined()
	})

	test('that cannot convert a value names it', () => {
		const error = migrationError(() => migrateArtifact({ ...previous, heading: 42 }, { steps }))
		expect(error.code).toBe('unconvertible-value')
		expect(error.message).toBe('Cannot convert heading = 42: a heading must be text')
	})

	test('whose result does not validate fails', () => {
		const breaking: MigrationStep = { ...renameTitle, apply: (artifact) => ({ ...artifact, name: '' }) }
		const error = migrationError(() =>
			migrateArtifact(previous, { steps: [...MIGRATION_STEPS.filter((step) => step.to !== '2026-09-22'), breaking] }),
		)
		expect(error.code).toBe('invalid-result')
		expect(error.message).toContain('name')
	})
})

describe('migrating file content', () => {
	test('JSON stays JSON with its indentation and trailing newline', () => {
		const source = fixture('lease-2026-08-10.json')
		const result = migrateArtifactSource(source)
		if (result.status !== 'migrated') throw new Error('expected a migration')
		expect(result.content.startsWith(`{\n  "$schema": "${PARADOC_SCHEMA_URL}",\n  "kind": "form",`)).toBe(true)
		expect(result.content.endsWith('}\n')).toBe(true)
		expect(JSON.parse(result.content).layers.markdown.signatures.tenantSignature.placement).toBe('flow')
	})

	test('tab-indented JSON keeps its tabs', () => {
		const source = `${JSON.stringify({ ...current, $schema: schemaVersionUrl('2026-08-10') }, null, '\t')}`
		const result = migrateArtifactSource(source)
		expect(result.content).toContain('\n\t"$schema"')
		expect(result.content.endsWith('\n')).toBe(false)
	})

	test('YAML stays YAML and keeps its comments', () => {
		const result = migrateArtifactSource(fixture('lease-2026-08-10.yaml'), { format: 'yaml' })
		if (result.status !== 'migrated') throw new Error('expected a migration')
		expect(result.content).toContain(`# yaml-language-server: $schema=${PARADOC_SCHEMA_URL}\n$schema: ${PARADOC_SCHEMA_URL}\n`)
		expect(result.content).toContain('  # The animal the addendum covers\n')
		expect(result.content).toContain('placement: flow # marker injected at render\n')
		expect(parseYaml(result.content).layers.markdown.signatures.tenantSignature.placement).toBe('flow')
	})

	test('YAML without $schema gains it as the first key', () => {
		const result = migrateArtifactSource('# A notice\nkind: document\nname: notice\n', { from: SCHEMA_VERSION })
		expect(result.content).toBe(`# A notice\n$schema: ${PARADOC_SCHEMA_URL}\nkind: document\nname: notice\n`)
	})

	test('current content is returned unchanged', () => {
		const source = `$schema: ${PARADOC_SCHEMA_URL}\nkind: document\nname: notice\n`
		expect(migrateArtifactSource(source)).toEqual({ status: 'current', version: SCHEMA_VERSION, content: source })
	})

	test.each([
		['JSON', '{ "kind": ', 'json' as const],
		['YAML', 'kind: [form', 'yaml' as const],
	])('unparseable %s fails', (_label, source, format) => {
		const error = migrationError(() => migrateArtifactSource(source, { format }))
		expect(error.code).toBe('unparseable')
	})
})
