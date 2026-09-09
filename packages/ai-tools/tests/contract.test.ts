import { describe, expect, it, vi } from 'vitest'
import {
	createToolExecutionContext,
	buildArtifactItemUrl,
	executeFill,
	executeGetArtifact,
	executeGetFillState,
	executeInspectArtifact,
	executeRender,
	executeUpdateFill,
	executeValidateInput,
	resolveSource,
	safeFetch,
	toolDefinitions,
	validateFetchUrl,
} from '../src'

const formArtifact = {
	kind: 'form' as const,
	name: 'lease-intake',
	fields: {
		name: { type: 'text' as const, label: 'Name', required: true },
		city: { type: 'text' as const, label: 'City', default: 'New York' },
	},
	parties: {
		tenant: { label: 'Tenant', partyType: 'person' as const, min: 1, max: 1 },
	},
	annexes: { identity: { title: 'Identity document' } },
	layers: {
		text: { kind: 'inline' as const, mimeType: 'text/plain', text: '{{name}} / {{parties.tenant.name}} / {{city}}' },
	},
	defaultLayer: 'text',
}

const checklistArtifact = {
	kind: 'checklist' as const,
	name: 'onboarding',
	items: [
		{ id: 'identity', title: 'Identity reviewed', status: { kind: 'boolean' as const } },
		{ id: 'approval', title: 'Approval', status: { kind: 'enum' as const, options: [{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }] } },
	],
	layers: { text: { kind: 'inline' as const, mimeType: 'text/plain', text: '{{items.identity}} {{items.approval}}' } },
	defaultLayer: 'text',
}

const documentArtifact = {
	kind: 'document' as const,
	name: 'notice',
	layers: { text: { kind: 'inline' as const, mimeType: 'text/plain', text: 'A notice document.' } },
	defaultLayer: 'text',
}

const tenant = { name: 'Alice Tenant', firstName: 'Alice', lastName: 'Tenant' }

describe('shared AI tool contract', () => {
	it('publishes exactly nine independently usable operations', () => {
		expect(Object.keys(toolDefinitions)).toEqual([
			'get_registry',
			'get_artifact',
			'inspect_artifact',
			'validate_artifact',
			'validate_input',
			'fill',
			'get_fill_state',
			'update_fill',
			'render',
		])
		for (const [name, definition] of Object.entries(toolDefinitions)) {
			expect(definition.name).toBe(name)
			expect(definition.description.length).toBeGreaterThan(10)
			expect(definition.input_schema).toBeDefined()
			expect(definition.output_schema).toBeDefined()
			expect(definition.execute).toBeTypeOf('function')
		}
	})

	it('returns a lossless reusable form payload and separates acceptance from completeness', async () => {
		const incomplete = await executeFill({ source: 'artifact', artifact: formArtifact, data: { fields: {}, parties: { tenant } } })
		expect(incomplete.accepted).toBe(true)
		expect(incomplete.complete).toBe(false)
		expect(incomplete.data).toMatchObject({ fields: { city: 'New York' }, parties: { tenant: { id: 'tenant-0', name: 'Alice Tenant' } } })

		const filled = await executeFill({
			source: 'artifact',
			artifact: formArtifact,
			data: { fields: { name: 'Application' }, parties: { tenant }, annexes: { identity: { name: 'id.pdf', mimeType: 'application/pdf' } } },
		})
		expect(filled.accepted).toBe(true)
		expect(filled.complete).toBe(true)
		expect(filled.data).toMatchObject({ fields: { name: 'Application', city: 'New York' }, parties: { tenant: { id: 'tenant-0' } }, annexes: { identity: { name: 'id.pdf' } } })
		const rendered = await executeRender({ source: 'artifact', artifact: formArtifact, data: filled.data, evaluation_context: filled.evaluation_context })
		expect(rendered.success).toBe(true)
		expect(rendered.content).toContain('Application / Alice Tenant / New York')
	})

	it('updates, clears, and resets while preserving untouched data and context', async () => {
		const context = { asOf: { date: '2025-01-02', datetime: '2025-01-02T03:04:05.000Z' } }
		const result = await executeUpdateFill({
			source: 'artifact',
			artifact: formArtifact,
			data: { fields: { name: 'Application', city: 'Boston' }, parties: { tenant }, annexes: { identity: { name: 'id.pdf' } } },
			patch: { fields: { name: 'Updated application' } },
			clear: ['fields.city'],
			reset: ['fields.city'],
			evaluation_context: context,
		})
		expect(result.accepted).toBe(true)
		expect(result.data).toMatchObject({ fields: { name: 'Updated application', city: 'New York' }, parties: { tenant: { id: 'tenant-0' } }, annexes: { identity: { name: 'id.pdf' } } })
		expect(result.evaluation_context).toEqual(context)
	})

	it('reports bounded selectable inspection and truthful fill state', async () => {
		const inspected = await executeInspectArtifact({ source: 'artifact', artifact: formArtifact, sections: ['fields', 'layers'], max_items: 1 })
		expect(inspected.sections.fields).toEqual({ name: expect.any(Object) })
		expect(inspected.sections.layers).toHaveLength(1)
		expect(inspected.truncated).toBe(true)

		const state = await executeGetFillState({ source: 'artifact', artifact: formArtifact, data: { fields: {} }, include_optional: true })
		expect(state.artifact_kind).toBe('form')
		expect(state.summary.required_remaining).toBeGreaterThan(0)
		expect(state.open_required.length).toBeGreaterThan(0)
		expect(state.next).toBeDefined()
	})

	it('uses owning core APIs for each progressive validation target', async () => {
		const field = await executeValidateInput({ source: 'artifact', artifact: formArtifact, target: 'field', field_path: 'name', value: 'Okay' })
		expect(field.valid).toBe(true)
		expect(field.normalized_value).toBe('Okay')
		const party = await executeValidateInput({ source: 'artifact', artifact: formArtifact, target: 'party', role_id: 'tenant', value: tenant })
		expect(party.valid).toBe(true)
		expect(party.normalized_value).toMatchObject({ roleId: 'tenant', index: 0, party: { id: 'tenant-0' } })
		const annex = await executeValidateInput({ source: 'artifact', artifact: formArtifact, target: 'annex', annex_id: 'identity', value: { name: 'id.pdf', mimeType: 'application/pdf' } })
		expect(annex.valid).toBe(true)
		const item = await executeValidateInput({ source: 'artifact', artifact: checklistArtifact, target: 'checklist_item', item_id: 'approval', value: 'approved' })
		expect(item.valid).toBe(true)
	})

	it('renders documents and checklists without synthetic document fill data', async () => {
		const document = await executeRender({ source: 'artifact', artifact: documentArtifact })
		expect(document).toMatchObject({ success: true, artifact_kind: 'document', content: 'A notice document.' })
		const checklist = await executeRender({ source: 'artifact', artifact: checklistArtifact, data: { identity: true, approval: 'approved' } })
		expect(checklist.success).toBe(true)
		expect(checklist.artifact_kind).toBe('checklist')
	})

	it('applies default registry precedence, indexed membership, and request caching', async () => {
		const fetch = vi.fn(async (input: string | URL) => {
			const url = String(input)
			if (url.endsWith('/registry.json')) return Response.json({ items: [{ name: 'notice', path: 'notice.json' }] })
			if (url.endsWith('/notice.json')) return Response.json(documentArtifact)
			return new Response('missing', { status: 404 })
		})
		const context = createToolExecutionContext()
		const result = await executeGetArtifact({ artifact_name: 'notice' }, { defaultRegistryUrl: 'https://registry.example', fetch, context })
		expect(result.artifact_name).toBe('notice')
		expect(result.artifact).toEqual(documentArtifact)
		const missing = await executeGetArtifact({ artifact_name: 'other' }, { defaultRegistryUrl: 'https://registry.example', fetch, context })
		expect(missing.error?.code).toBe('artifact_not_found')
		expect(fetch).toHaveBeenCalledTimes(2)
	})

	it('bounds request cache entries and isolates custom fetch identities', async () => {
		const context = createToolExecutionContext({ maxCacheEntries: 1 })
		const firstFetch = vi.fn(async () => Response.json({ value: 'first' }))
		const secondFetch = vi.fn(async () => Response.json({ value: 'second' }))
		await safeFetch('https://registry.example/one', 1024, firstFetch, { context })
		await safeFetch('https://registry.example/two', 1024, firstFetch, { context })
		await safeFetch('https://registry.example/one', 1024, firstFetch, { context })
		await safeFetch('https://registry.example/one', 1024, secondFetch, { context })
		expect(firstFetch).toHaveBeenCalledTimes(3)
		expect(secondFetch).toHaveBeenCalledTimes(1)
		expect(context.cache?.responses.size).toBeLessThanOrEqual(1)
	})

	it('derives source bases from the final validated redirect location', async () => {
		const fetch = vi.fn(async (input: string) => {
			if (input.endsWith('/start')) return new Response(null, { status: 302, headers: { location: 'https://cdn.example/assets/notice.json' } })
			return Response.json(documentArtifact)
		})
		const resolved = await resolveSource({ source: 'url', url: 'https://registry.example/start' }, { fetch })
		expect(resolved.artifact).toEqual(documentArtifact)
		expect(resolved.artifact_url).toBe('https://cdn.example/assets/notice.json')
		expect(resolved.base_url).toBe('https://cdn.example/assets')
	})

	it('uses the final registry index location for indexed artifact reads', async () => {
		const fetch = vi.fn(async (input: string) => {
			if (input === 'https://registry.example/registry.json') return new Response(null, { status: 302, headers: { location: 'https://cdn.example/catalog/registry.json' } })
			if (input === 'https://cdn.example/catalog/registry.json') return Response.json({ items: [{ name: 'notice', path: 'notice.json' }] })
			if (input === 'https://cdn.example/catalog/notice.json') return Response.json(documentArtifact)
			return new Response('missing', { status: 404 })
		})
		const result = await executeGetArtifact({ registry_url: 'https://registry.example', artifact_name: 'notice' }, { fetch })
		expect(result.error).toBeUndefined()
		expect(result.artifact).toEqual(documentArtifact)
		expect(fetch).toHaveBeenCalledWith('https://cdn.example/catalog/notice.json', expect.anything())
	})

	it('enforces redirect and address policy without claiming DNS rebinding protection', async () => {
		expect(() => validateFetchUrl('https://[::ffff:127.0.0.1]/artifact.json')).toThrow(/private|local/i)
		expect(() => validateFetchUrl('http://127.0.0.1:8787/artifact.json', { allowLocalDevelopment: true })).not.toThrow()
		const fetch = vi.fn(async (input: string) => {
			if (input.endsWith('/start')) return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } })
			return Response.json({ ok: true })
		})
		await expect(safeFetch('https://registry.example/start', 1024, fetch)).rejects.toThrow(/private|local|https/i)
		expect(fetch).toHaveBeenCalledTimes(1)
	})

	it('keeps indexed artifact paths inside the configured registry root', () => {
		expect(() => buildArtifactItemUrl('https://registry.example/catalog', '../outside', 'notice', 'notice.json')).toThrow(/inside the registry root/i)
		expect(buildArtifactItemUrl('https://registry.example/catalog', 'artifacts', 'notice', 'notice.json')).toBe('https://registry.example/catalog/artifacts/notice.json')
	})

	it('bounds model-facing render presentation', async () => {
		const result = await executeRender({ source: 'artifact', artifact: documentArtifact, presentation: { max_bytes: 4 } })
		expect(result.success).toBe(true)
		expect(result.truncated).toBe(true)
		expect(result.byte_length).toBeGreaterThan(4)
		expect(result.content).toBe('A no')
	})
})
