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

		expect(result.steps.map((step) => step.to)).toEqual(['2026-09-22', '2026-09-23', '2026-09-24'])
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

	test('drops the party key multiple, which never had an effect', () => {
		const source = JSON.parse(fixture('lease-2026-08-10.json'))
		source.parties.tenant.multiple = true
		source.parties.tenant.max = 4
		expect(validate(source).issues).toBeDefined()

		const result = migrateArtifact(source)
		if (result.status !== 'migrated') throw new Error('expected a migration')
		const artifact = result.artifact as Json
		expect(artifact.parties.tenant).toEqual({ label: 'Tenant', max: 4 })
		expect(validate(artifact).issues).toBeUndefined()
	})

	test('moves a flat bbox definition to corners without loss', () => {
		const source = JSON.parse(fixture('lease-2026-08-10.json'))
		source.defs = {
			box: { type: 'bbox', value: { north: '10', south: '5', east: '20', west: '15' } },
		}

		const result = migrateArtifact(source)
		if (result.status !== 'migrated') throw new Error('expected a migration')
		const artifact = result.artifact as Json
		expect(artifact.defs.box.value).toEqual({
			southWest: { lat: '5', lon: '15' },
			northEast: { lat: '10', lon: '20' },
		})
		expect(validate(artifact).issues).toBeUndefined()
	})

	test('a flat bbox definition with another member cannot be converted and is named', () => {
		const source = JSON.parse(fixture('lease-2026-08-10.json'))
		source.defs = {
			box: { type: 'bbox', value: { north: '10', south: '5', east: '20', west: '15', centre: '0' } },
		}
		const error = migrationError(() => migrateArtifact(source))
		expect(error.code).toBe('unconvertible-value')
		expect(error.message).toContain('defs.box.value.centre = "0"')
	})

	test('an unknown field key is not dropped: the result fails naming it', () => {
		const source = JSON.parse(fixture('lease-2026-08-10.json'))
		source.fields.petName.maxLenght = 20
		const error = migrationError(() => migrateArtifact(source))
		expect(error.code).toBe('invalid-result')
		expect(error.message).toContain('maxLenght')
	})

	test('an inline React layer cannot be converted and is named', () => {
		const source = JSON.parse(fixture('lease-2026-08-10.json'))
		source.layers.markdown.mimeType = 'text/tsx'
		const error = migrationError(() => migrateArtifact(source))
		expect(error.code).toBe('unconvertible-value')
		expect(error.message).toContain('layers.markdown.mimeType = "text/tsx"')
	})
})

describe('2026-09-22 to 2026-09-23', () => {
	const notice = (layers: Record<string, unknown>) => ({
		$schema: schemaVersionUrl('2026-09-22'),
		kind: 'form',
		name: 'notice',
		fields: { name: { type: 'text', label: 'Name' } },
		layers,
	})
	const pdf = { kind: 'file', mimeType: 'application/pdf', path: 'notice.pdf' }

	test('keeps bindings on PDF layers, and the result validates', () => {
		const source = notice({
			copyA: { ...pdf, bindings: { 'topmostSubform[0].Page1[0].f1_01[0]': 'fields.name' } },
			copyB: { ...pdf, path: 'notice-b.pdf', bindingsFrom: 'copyA' },
		})
		const result = migrateArtifact(source)
		if (result.status !== 'migrated') throw new Error('expected a migration')
		expect(result).toMatchObject({ from: '2026-09-22', to: SCHEMA_VERSION })
		expect(result.steps.map((step) => step.to)).toEqual(['2026-09-23', '2026-09-24'])
		expect(result.artifact).toEqual({ ...source, $schema: PARADOC_SCHEMA_URL })
		expect(validate(result.artifact).issues).toBeUndefined()
	})

	test.each([
		['an inline markdown layer', { kind: 'inline', mimeType: 'text/markdown', text: 'Dear {{name}}' }],
		['a DOCX file layer', { kind: 'file', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', path: 'n.docx' }],
	])('bindings on %s cannot be converted and are named', (_label, layer) => {
		const error = migrationError(() => migrateArtifact(notice({ copy: { ...layer, bindings: { name: 'fields.name' } } })))
		expect(error.code).toBe('unconvertible-value')
		expect(error.message).toContain('layers.copy.bindings = {"name":"fields.name"}')
		expect(error.message).toContain('{{fields.fieldName}}')
	})

	test('bindingsFrom on a layer that is not a PDF cannot be converted and is named', () => {
		const source = notice({
			pdf: { ...pdf, bindings: { f1_01: 'fields.name' } },
			copy: { kind: 'file', mimeType: 'text/html', path: 'n.html', bindingsFrom: 'pdf' },
		})
		const error = migrationError(() => migrateArtifact(source))
		expect(error.code).toBe('unconvertible-value')
		expect(error.message).toContain('layers.copy.bindingsFrom = "pdf"')
	})

	test('names bindings on a layer of an inline artifact in a bundle', () => {
		const { $schema: _, ...form } = notice({ copy: { kind: 'inline', mimeType: 'text/markdown', text: 'x', bindings: { a: 'fields.name' } } })
		const bundle = { $schema: schemaVersionUrl('2026-09-22'), kind: 'bundle', name: 'packet', contents: [{ type: 'inline', key: 'notice', artifact: form }] }
		const error = migrationError(() => migrateArtifact(bundle))
		expect(error.message).toContain('contents.0.artifact.layers.copy.bindings')
	})
})

describe('2026-09-23 to 2026-09-24', () => {
	const parties = {
		taxpayer: { label: 'Taxpayer', partyType: 'person', signature: { required: true } },
		spouse: { label: 'Spouse', partyType: 'person', max: 2 },
	}
	const form = (layer: Record<string, unknown>) => ({
		$schema: schemaVersionUrl('2026-09-23'),
		kind: 'form',
		name: 'return',
		fields: { name: { type: 'text', label: 'Name' } },
		parties,
		layers: { pdf: { kind: 'file', mimeType: 'application/pdf', path: 'return.pdf', ...layer } },
	})

	test('moves signatureBlocks and anchorBlocks into signatures, and the result validates', () => {
		const source = form({
			signatureBlocks: {
				sig: { type: 'signature', page: 1, x: 72, y: 600, width: 180, height: 36, partyRole: 'taxpayer', label: 'Sign here', required: true },
				date: { type: 'date', page: 1, x: 300, y: 600, width: 90, height: 36, partyRole: 'taxpayer' },
			},
			anchorBlocks: {
				spouseSig: { type: 'initials', anchor: { text: 'Spouse initials', offsetX: 0, offsetY: 12 }, width: 60, height: 20, partyRole: 'spouse', partyIndex: 1, required: false },
			},
		})
		const result = migrateArtifact(source)
		if (result.status !== 'migrated') throw new Error('expected a migration')
		expect(result.steps.map((step) => step.to)).toEqual(['2026-09-24'])
		const layer = (result.artifact as Json).layers.pdf
		expect(layer.signatureBlocks).toBeUndefined()
		expect(layer.anchorBlocks).toBeUndefined()
		expect(layer.signatures).toEqual({
			sig: { party: { role: 'taxpayer' }, type: 'signature', required: true, label: 'Sign here', placement: { page: 1, x: 72, y: 600, width: 180, height: 36 } },
			date: { party: { role: 'taxpayer' }, type: 'date_signed', placement: { page: 1, x: 300, y: 600, width: 90, height: 36 } },
			spouseSig: {
				party: { role: 'spouse', index: 1 },
				type: 'initials',
				required: false,
				placement: { anchor: { text: 'Spouse initials', offsetX: 0, offsetY: 12 }, width: 60, height: 20 },
			},
		})
		expect(validate(result.artifact).issues).toBeUndefined()
		// The input is never changed.
		expect(source.layers.pdf).toHaveProperty('signatureBlocks')
	})

	test('keeps existing signatures beside the moved blocks', () => {
		const existing = { party: { role: 'taxpayer' }, type: 'signature', placement: { page: 2, x: 72, y: 600, width: 180, height: 36 } }
		const result = migrateArtifact(form({
			signatures: { page2: existing },
			signatureBlocks: { page1: { type: 'signature', page: 1, x: 72, y: 600, width: 180, height: 36, partyRole: 'taxpayer' } },
		}))
		const signatures = (result.artifact as Json).layers.pdf.signatures
		expect(Object.keys(signatures)).toEqual(['page2', 'page1'])
		expect(signatures.page2).toEqual(existing)
	})

	test('a block with no party role cannot be converted and is named', () => {
		const error = migrationError(() => migrateArtifact(form({
			signatureBlocks: { loose: { type: 'signature', page: 1, x: 72, y: 600, width: 180, height: 36 } },
		})))
		expect(error.code).toBe('unconvertible-value')
		expect(error.message).toContain('layers.pdf.signatureBlocks.loose')
		expect(error.message).toContain('partyRole')
	})

	test('a block id already used in signatures is named', () => {
		const error = migrationError(() => migrateArtifact(form({
			signatures: { sig: { party: { role: 'taxpayer' }, type: 'signature', placement: { page: 1, x: 1, y: 1, width: 10, height: 10 } } },
			anchorBlocks: { sig: { type: 'signature', anchor: { text: 'Sign', offsetX: 0, offsetY: 0 }, width: 60, height: 20, partyRole: 'taxpayer' } },
		})))
		expect(error.code).toBe('unconvertible-value')
		expect(error.message).toContain('layers.pdf.anchorBlocks.sig')
		expect(error.message).toContain('already used by another slot')
	})

	test('the same id in signatureBlocks and anchorBlocks is named', () => {
		const error = migrationError(() => migrateArtifact(form({
			signatureBlocks: { sig: { type: 'signature', page: 1, x: 72, y: 600, width: 180, height: 36, partyRole: 'taxpayer' } },
			anchorBlocks: { sig: { type: 'signature', anchor: { text: 'Sign', offsetX: 0, offsetY: 0 }, width: 60, height: 20, partyRole: 'taxpayer' } },
		})))
		expect(error.message).toContain('layers.pdf.anchorBlocks.sig')
		expect(error.message).toContain('already used by another slot')
	})

	test.each([
		['signatureBlocks', ['sig']],
		['signatures', 'sig'],
	])('%s that is not a map is named', (key, value) => {
		const error = migrationError(() => migrateArtifact(form({
			...(key === 'signatures' && { signatureBlocks: {} }),
			[key]: value,
		})))
		expect(error.code).toBe('unconvertible-value')
		expect(error.message).toContain(`layers.pdf.${key}`)
		expect(error.message).toContain('must be a map')
	})

	test('moves blocks in an inline artifact of a bundle', () => {
		const { $schema: _, ...inner } = form({
			signatureBlocks: { sig: { type: 'signature', page: 1, x: 72, y: 600, width: 180, height: 36, partyRole: 'taxpayer' } },
		})
		const bundle = { $schema: schemaVersionUrl('2026-09-23'), kind: 'bundle', name: 'packet', contents: [{ type: 'inline', key: 'return', artifact: inner }] }
		const result = migrateArtifact(bundle)
		const layer = (result.artifact as Json).contents[0].artifact.layers.pdf
		expect(layer.signatureBlocks).toBeUndefined()
		expect(layer.signatures.sig.party).toEqual({ role: 'taxpayer' })
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
			'Allows bindings and bindingsFrom only on PDF file layers; names any other layer that declares them.',
			'Moves layer signatureBlocks and anchorBlocks into signatures.',
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
