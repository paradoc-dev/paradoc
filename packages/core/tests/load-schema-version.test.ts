import { describe, expect, test } from 'vitest'
import { PARADOC_SCHEMA_URL, SCHEMA_VERSION, schemaVersionUrl } from '@paradoc/schemas'
import { form } from '@/artifacts'
import {
	LoadError,
	SchemaVersionError,
	load,
	loadFromObject,
	safeLoad,
	safeLoadFromObject,
} from '@/serialization'

const body = { kind: 'document', name: 'notice', title: 'Notice' }
const json = (schema?: unknown) => JSON.stringify(schema === undefined ? body : { $schema: schema, ...body })

function versionError(run: () => unknown): SchemaVersionError {
	try {
		run()
	} catch (error) {
		if (error instanceof SchemaVersionError) return error
		throw error
	}
	throw new Error('Expected a schema version error')
}

describe('loading an artifact file enforces the schema version', () => {
	test('a current artifact loads from JSON and YAML', () => {
		expect(load(json(PARADOC_SCHEMA_URL)).name).toBe('notice')
		expect(load(`$schema: ${PARADOC_SCHEMA_URL}\nkind: document\nname: notice\n`).name).toBe('notice')
	})

	test('a missing $schema fails and names the current version and migrate', () => {
		const error = versionError(() => load(json()))
		expect(error.code).toBe('missing-version')
		expect(error).toBeInstanceOf(LoadError)
		expect(error.message).toContain(SCHEMA_VERSION)
		expect(error.message).toContain('paradoc migrate')
	})

	test('an outdated version fails naming it, the current version, and migrate', () => {
		const error = versionError(() => load(json(schemaVersionUrl('2026-08-10'))))
		expect(error.code).toBe('outdated-version')
		expect(error.found).toBe(schemaVersionUrl('2026-08-10'))
		expect(error.message).toContain('2026-08-10')
		expect(error.message).toContain(SCHEMA_VERSION)
		expect(error.message).toContain('paradoc migrate')
	})

	test.each([
		['an unpublished date', 'https://schema.paradoc.dev/2030-01-01.json', '2030-01-01'],
		['the undated address', 'https://schema.paradoc.dev/schema.json', 'schema.json'],
		['a foreign address', 'https://example.com/form.json', 'example.com'],
		['a non-string', 42, '42'],
	])('%s is an unknown version', (_label, address, named) => {
		const error = versionError(() => load(json(address)))
		expect(error.code).toBe('unknown-version')
		expect(error.message).toContain(named)
		expect(error.message).toContain(SCHEMA_VERSION)
		expect(error.message).toContain('paradoc migrate')
	})

	test('safeLoad returns the version error rather than throwing', () => {
		const result = safeLoad(json(schemaVersionUrl('2026-08-06')))
		expect(result.success).toBe(false)
		if (!result.success) expect(result.error).toBeInstanceOf(SchemaVersionError)
	})

	test('a kind that does not exist is reported before the version', () => {
		expect(() => load('kind: poster\nname: x\n')).toThrow(/Unknown artifact kind/)
	})
})

describe('loading a parsed object', () => {
	test('an object without $schema is an SDK artifact and loads', () => {
		expect(loadFromObject(body).name).toBe('notice')
	})

	test('a $schema it declares must still be current', () => {
		expect(versionError(() => loadFromObject({ $schema: schemaVersionUrl('2026-08-10'), ...body })).code).toBe('outdated-version')
		const result = safeLoadFromObject({ $schema: 'https://schema.paradoc.dev/schema.json', ...body })
		expect(result.success).toBe(false)
		if (!result.success) expect(result.error).toBeInstanceOf(SchemaVersionError)
	})

	test('an SDK-built artifact loads with or without a serialized $schema', () => {
		const intake = form({ name: 'intake', fields: { name: { type: 'text' } } })
		expect(load(JSON.stringify(intake.toJSON())).name).toBe('intake')
		expect(load(intake.toYAML()).name).toBe('intake')
		expect(loadFromObject(intake.toJSON({ includeSchema: false })).name).toBe('intake')
	})
})
