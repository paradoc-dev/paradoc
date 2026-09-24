import { describe, expect, test } from 'vitest'
import { PARADOC_SCHEMA_URL, SCHEMA_VERSION, schemaVersionUrl } from '@paradoc/schemas'
import { bundle, checklist, document, form, runtimeChecklistFromJSON, runtimeDocumentFromJSON, runtimeFormFromJSON } from '@/artifacts'
import { SchemaVersionError, load, loadFromObject } from '@/serialization'
import { SchemaMigrationError, migrateArtifact } from '@/migration'
import { validate } from '@/validation/artifact'

/**
 * One schema version rule for every entry point of every artifact kind.
 * `load` and `loadFromObject` are covered in depth by load-schema-version.test.ts;
 * here every entry point is held to the same outcome, kind by kind.
 */

const OUTDATED = schemaVersionUrl('2026-08-10')

const bodies = {
	form: { kind: 'form', name: 'intake', fields: { name: { type: 'text' } } },
	document: { kind: 'document', name: 'notice', title: 'Notice' },
	checklist: { kind: 'checklist', name: 'onboarding', items: [{ id: 'done', title: 'Done' }] },
	bundle: { kind: 'bundle', name: 'packet', contents: [{ type: 'path', key: 'cover', path: './cover.yaml' }] },
} as const

type Kind = keyof typeof bodies
const KINDS = Object.keys(bodies) as Kind[]

const apis = { form, document, checklist, bundle } as unknown as Record<
	Kind,
	{
		(input: unknown): { name: string; toJSON(): Record<string, unknown> }
		(): { from(input: unknown): { build(): { name: string } } }
		from(input: unknown): { name: string }
		safeFrom(input: unknown): { success: true; data: { name: string } } | { success: false; error: Error }
	}
>

const entryPoints: Record<string, (kind: Kind, input: Record<string, unknown>) => { name: string }> = {
	'p.<kind>(obj)': (kind, input) => apis[kind](input),
	'.from': (kind, input) => apis[kind].from(input),
	'.safeFrom': (kind, input) => {
		const result = apis[kind].safeFrom(input)
		if (!result.success) throw result.error
		return result.data
	},
	'builder .from(...).build()': (kind, input) => apis[kind]().from(input).build(),
	load: (_kind, input) => load(JSON.stringify(input)),
	loadFromObject: (_kind, input) => loadFromObject(input),
}

const cases = KINDS.flatMap((kind) => Object.keys(entryPoints).map((entry) => [kind, entry] as const))

const withSchema = (kind: Kind, $schema: unknown): Record<string, unknown> => ({ $schema, ...bodies[kind] })

function versionError(run: () => unknown): SchemaVersionError {
	try {
		run()
	} catch (error) {
		if (error instanceof SchemaVersionError) return error
		throw error
	}
	throw new Error('Expected a SchemaVersionError')
}

describe('every entry point of every kind applies the schema version rule', () => {
	test.each(cases)('%s via %s accepts the current $schema', (kind, entry) => {
		expect(entryPoints[entry]!(kind, withSchema(kind, PARADOC_SCHEMA_URL)).name).toBe(bodies[kind].name)
	})

	test.each(cases)('%s via %s refuses an outdated $schema, naming both versions and migrate', (kind, entry) => {
		const error = versionError(() => entryPoints[entry]!(kind, withSchema(kind, OUTDATED)))
		expect(error.code).toBe('outdated-version')
		expect(error.found).toBe(OUTDATED)
		expect(error.message).toContain('2026-08-10')
		expect(error.message).toContain(SCHEMA_VERSION)
		expect(error.message).toContain('paradoc migrate')
	})

	test.each([
		['an unpublished', 'https://schema.paradoc.dev/2030-01-01.json'],
		['an undated', 'https://schema.paradoc.dev/schema.json'],
		['a foreign', 'https://example.com/form.json'],
	])('%s $schema is refused by every entry point of every kind', (_label, address) => {
		for (const [kind, entry] of cases) {
			const error = versionError(() => entryPoints[entry]!(kind, withSchema(kind, address)))
			expect(error.code, `${kind} via ${entry}`).toBe('unknown-version')
		}
	})

	test.each(KINDS)('an in-memory %s without $schema is built, and serializes as current', (kind) => {
		const instance = apis[kind](bodies[kind])
		expect(instance.toJSON().$schema).toBe(PARADOC_SCHEMA_URL)
	})
})

describe('restoring a runtime holds its definition to the rule', () => {
	const runtimes = {
		form: () => [form(bodies.form).fill({ fields: {} }).toJSON(), 'form', runtimeFormFromJSON],
		document: () => [document(bodies.document).prepare().toJSON(), 'document', runtimeDocumentFromJSON],
		checklist: () => [checklist(bodies.checklist).fill({}).toJSON(), 'checklist', runtimeChecklistFromJSON],
	} as unknown as Record<string, () => [Record<string, any>, string, (json: unknown) => { phase: string }]>

	test.each(Object.keys(runtimes))('a %s runtime restores with the current definition and refuses an outdated one', (kind) => {
		const [json, key, restore] = runtimes[kind]!()
		expect(restore(structuredClone(json)).phase).toBe(json.phase)
		const outdated = { ...json, [key]: { ...json[key], $schema: OUTDATED } }
		expect(versionError(() => restore(outdated)).code).toBe('outdated-version')
	})
})

describe('validate() reports the version', () => {
	test.each(KINDS)('an outdated %s is an issue at $schema', (kind) => {
		const result = validate(withSchema(kind, OUTDATED))
		expect(result.issues).toHaveLength(1)
		expect(result.issues?.[0]?.path).toEqual(['$schema'])
		expect(result.issues?.[0]?.message).toContain(SCHEMA_VERSION)
		expect(result.issues?.[0]?.message).toContain('paradoc migrate')
	})

	test.each(KINDS)('a current %s, or one without $schema, is valid', (kind) => {
		expect(validate(withSchema(kind, PARADOC_SCHEMA_URL)).issues).toBeUndefined()
		expect(validate(bodies[kind]).issues).toBeUndefined()
	})
})

describe('a bundle holds its inline parts to the rule', () => {
	const packet = (child: Record<string, unknown>) => ({
		$schema: PARADOC_SCHEMA_URL,
		kind: 'bundle',
		name: 'packet',
		contents: [
			{ type: 'inline', key: 'cover', artifact: bodies.document },
			{ type: 'inline', key: 'notice', artifact: child },
		],
	})
	const outdatedChild = { $schema: OUTDATED, ...bodies.document }

	test.each(Object.keys(entryPoints))('an outdated inline part is refused via %s, naming the part', (entry) => {
		const error = versionError(() => entryPoints[entry]!('bundle', packet(outdatedChild)))
		expect(error.code).toBe('outdated-version')
		expect(error.message).toContain('"notice"')
		expect(error.path).toEqual(['contents', 1, 'artifact', '$schema'])
	})

	test('an outdated part of a nested inline bundle is refused', () => {
		const nested = { kind: 'bundle', name: 'inner', contents: [{ type: 'inline', key: 'deep', artifact: outdatedChild }] }
		const error = versionError(() => bundle.from(packet(nested)))
		expect(error.message).toContain('"deep"')
		expect(error.path).toEqual(['contents', 1, 'artifact', 'contents', 0, 'artifact', '$schema'])
	})

	test('the builder refuses an outdated inline part at build()', () => {
		expect(() => bundle().name('packet').inline('notice', outdatedChild as never).build()).toThrow(SchemaVersionError)
	})

	test('validate() reports the part at its path', () => {
		const result = validate(packet(outdatedChild))
		expect(result.issues?.[0]?.path).toEqual(['contents', 1, 'artifact', '$schema'])
	})

	test('current inline parts, with or without $schema, are accepted', () => {
		const current = packet({ $schema: PARADOC_SCHEMA_URL, ...bodies.document })
		expect(bundle.from(current).name).toBe('packet')
		expect(loadFromObject(current).name).toBe('packet')
		expect(validate(current).issues).toBeUndefined()
	})
})

describe('migrate stays the one path that accepts an older version', () => {
	test.each(KINDS)('an outdated %s migrates, and the result loads through every entry point', (kind) => {
		const result = migrateArtifact(withSchema(kind, OUTDATED))
		expect(result).toMatchObject({ status: 'migrated', from: '2026-08-10', to: SCHEMA_VERSION })
		for (const entry of Object.keys(entryPoints)) {
			expect(entryPoints[entry]!(kind, result.artifact as Record<string, unknown>).name).toBe(bodies[kind].name)
		}
	})

	test('a bundle with an outdated inline part migrates, and then loads', () => {
		const source = {
			$schema: OUTDATED,
			kind: 'bundle',
			name: 'packet',
			contents: [{ type: 'inline', key: 'notice', artifact: { $schema: OUTDATED, ...bodies.document } }],
		}
		const result = migrateArtifact(source)
		expect(result.status).toBe('migrated')
		expect(bundle.from(result.artifact).name).toBe('packet')
	})

	/** A form whose party carries `multiple`, which the 2026-08-10 to 2026-09-22 step drops. */
	const oldForm = (schema?: string) => ({
		...(schema && { $schema: schema }),
		kind: 'form',
		name: 'order',
		parties: { buyer: { label: 'Buyer', multiple: true } },
	})
	const holding = (schema: string | undefined, artifact: Record<string, unknown>) => ({
		...(schema && { $schema: schema }),
		kind: 'bundle',
		name: 'packet',
		contents: [{ type: 'inline', key: 'order', artifact }],
	})
	const partOf = (artifact: Record<string, any>, ...keys: string[]) =>
		keys.reduce((current, key) => current.contents.find((item: any) => item.key === key).artifact, artifact)

	test('an outdated part two bundles deep migrates and is stamped current', () => {
		const source = holding(OUTDATED, { kind: 'bundle', name: 'inner', contents: [{ type: 'inline', key: 'deep', artifact: oldForm(OUTDATED) }] })
		const result = migrateArtifact(source)
		const deep = partOf(result.artifact, 'order', 'deep')
		expect(deep.$schema).toBe(PARADOC_SCHEMA_URL)
		expect(deep.parties.buyer).not.toHaveProperty('multiple')
		expect(bundle.from(result.artifact).name).toBe('packet')
	})

	test('a current bundle with an outdated part migrates the part', () => {
		const source = holding(PARADOC_SCHEMA_URL, oldForm(OUTDATED))
		expect(() => bundle.from(source)).toThrow(SchemaVersionError)
		const result = migrateArtifact(source)
		expect(result.status).toBe('migrated')
		const part = partOf(result.artifact, 'order')
		expect(part.$schema).toBe(PARADOC_SCHEMA_URL)
		expect(part.parties.buyer).not.toHaveProperty('multiple')
		expect(bundle.from(result.artifact).name).toBe('packet')
	})

	test('a part without $schema follows its bundle through the steps', () => {
		const result = migrateArtifact(holding(OUTDATED, oldForm()))
		const part = partOf(result.artifact, 'order')
		expect(part).not.toHaveProperty('$schema')
		expect(part.parties.buyer).not.toHaveProperty('multiple')
	})

	test('a current bundle whose parts are all current is left as it is', () => {
		const source = holding(PARADOC_SCHEMA_URL, { $schema: PARADOC_SCHEMA_URL, ...bodies.document })
		expect(migrateArtifact(source)).toMatchObject({ status: 'current', artifact: source })
	})

	test.each([
		['later than its bundle', schemaVersionUrl('2026-09-22'), schemaVersionUrl('2026-08-10'), 'version-conflict'],
		['with no published version', 'https://schema.paradoc.dev/schema.json', PARADOC_SCHEMA_URL, 'unknown-version'],
	])('a part %s is refused, naming it', (_label, partSchema, bundleSchema, code) => {
		const error = (() => {
			try {
				migrateArtifact(holding(bundleSchema, { $schema: partSchema, ...bodies.document }))
			} catch (caught) {
				return caught
			}
		})()
		expect(error).toBeInstanceOf(SchemaMigrationError)
		expect((error as SchemaMigrationError).code).toBe(code)
		expect((error as SchemaMigrationError).message).toContain('"order"')
	})
})
