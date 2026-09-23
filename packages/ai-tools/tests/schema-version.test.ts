import { describe, expect, it, vi } from 'vitest'
import { PARADOC_SCHEMA_URL, SCHEMA_VERSION, schemaVersionUrl } from '@paradoc/core'
import { executeFill } from '../src/tools/fill'
import { executeGetArtifact } from '../src/tools/get-artifact'

const form = (schema?: string) => ({
	...(schema ? { $schema: schema } : {}),
	kind: 'form',
	name: 'intake',
	fields: { x: { type: 'text', label: 'X' } },
})

const registryFetch = (artifact: unknown) =>
	vi.fn().mockImplementation((url: string) =>
		Promise.resolve(new Response(JSON.stringify(url.includes('registry.json') ? { items: [{ name: 'intake' }] } : artifact))),
	)

const fillFromUrl = (artifact: unknown) =>
	executeFill(
		{ source: 'url', url: 'https://example.com/intake.json', data: { fields: { x: 'a' } } },
		{ fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify(artifact))) },
	)

describe('AI tools apply the schema version rules', () => {
	it('fills a current artifact read from a URL', async () => {
		expect((await fillFromUrl(form(PARADOC_SCHEMA_URL))).accepted).toBe(true)
	})

	it.each([
		['missing', undefined, 'missing-version'],
		['outdated', schemaVersionUrl('2026-08-10'), 'outdated-version'],
		['unknown', 'https://schema.paradoc.dev/schema.json', 'unknown-version'],
	])('refuses a %s $schema read from a URL', async (_label, schema, code) => {
		const result = await fillFromUrl(form(schema))
		expect(result.accepted).toBe(false)
		expect(result.error?.code).toBe(code)
		expect(result.error?.message).toContain(SCHEMA_VERSION)
		expect(result.error?.message).toContain('paradoc migrate')
	})

	it('refuses an outdated artifact from a registry', async () => {
		const result = await executeGetArtifact(
			{ registry_url: 'https://registry.example', artifact_name: 'intake' },
			{ fetch: registryFetch(form(schemaVersionUrl('2026-08-10'))) },
		)
		expect(result.artifact).toBeUndefined()
		expect(result.error?.code).toBe('outdated-version')
		expect(result.error?.message).toContain('2026-08-10')

		const current = await executeGetArtifact(
			{ registry_url: 'https://registry.example', artifact_name: 'intake' },
			{ fetch: registryFetch(form(PARADOC_SCHEMA_URL)) },
		)
		expect(current.artifact).toMatchObject({ name: 'intake' })
	})

	it('accepts an inline artifact without $schema but refuses one that declares an old version', async () => {
		const plain = await executeFill({ source: 'artifact', artifact: form(), data: { fields: { x: 'a' } } })
		expect(plain.accepted).toBe(true)
		const old = await executeFill({ source: 'artifact', artifact: form(schemaVersionUrl('2026-08-06')), data: { fields: { x: 'a' } } })
		expect(old.error?.code).toBe('outdated-version')
	})
})
