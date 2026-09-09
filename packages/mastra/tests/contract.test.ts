import { describe, expect, it, vi } from 'vitest'
import {
	createFillTool,
	createGetArtifactTool,
	createGetFillStateTool,
	createGetRegistryTool,
	createInspectArtifactTool,
	createRenderTool,
	createUpdateFillTool,
	createValidateArtifactTool,
	createValidateInputTool,
	DEFAULT_MODEL_OUTPUT_MAX_BYTES,
	paradocTools,
} from '../src'
import { operationNames, toolDefinitions } from '@paradoc/ai-tools'

const documentArtifact = {
	kind: 'document' as const,
	name: 'notice',
	layers: {
		text: { kind: 'inline' as const, mimeType: 'text/plain', text: 'A notice.' },
	},
	defaultLayer: 'text',
}

const formArtifact = {
	kind: 'form' as const,
	name: 'intake',
	fields: {
		name: { type: 'text' as const, label: 'Name', required: true },
	},
	layers: {
		text: { kind: 'inline' as const, mimeType: 'text/plain', text: 'Name: {{name}}' },
	},
	defaultLayer: 'text',
}

async function execute<Tool extends { execute?: (input: never, context: never) => Promise<unknown> }>(tool: Tool, input: unknown, context: unknown = {}) {
	return tool.execute?.(input as never, context as never)
}

describe('@paradoc/mastra', () => {
	it('publishes the nine canonical operations as native Mastra tools', () => {
		const tools = paradocTools()

		expect(Object.keys(tools)).toEqual(operationNames)
		for (const name of operationNames) {
			const tool = tools[name]
			expect(tool.id).toBe(name)
			expect(tool.description).toBe(toolDefinitions[name].description)
			expect(tool.inputSchema).toBe(toolDefinitions[name].input_schema)
			expect(tool.outputSchema).toBe(toolDefinitions[name].output_schema)
			expect(tool.execute).toBeTypeOf('function')
		}
	})

	it('exports every operation as an individually importable factory', () => {
		const factories = [
			createGetRegistryTool,
			createGetArtifactTool,
			createInspectArtifactTool,
			createValidateArtifactTool,
			createValidateInputTool,
			createFillTool,
			createGetFillStateTool,
			createUpdateFillTool,
			createRenderTool,
		]
		expect(factories.map((factory) => factory().id)).toEqual(operationNames)
	})

	it('executes registry, validation, draft, and rendering operations through Mastra', async () => {
		const fetch = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input)
			if (url.endsWith('/registry.json')) return Response.json({ items: [{ name: 'notice', path: 'notice.json' }] })
			if (url.endsWith('/notice.json')) return Response.json(documentArtifact)
			return new Response('missing', { status: 404 })
		})
		const tools = paradocTools({ fetch })

		const registry = await execute(tools.get_registry, { registry_url: 'https://registry.example' })
		expect(registry).toMatchObject({ items: [{ name: 'notice', path: 'notice.json' }] })
		const fetched = await execute(tools.get_artifact, { registry_url: 'https://registry.example', artifact_name: 'notice' })
		expect(fetched).toMatchObject({ artifact_name: 'notice', artifact: documentArtifact })

		const validation = await execute(tools.validate_artifact, { source: 'artifact', artifact: documentArtifact })
		expect(validation).toMatchObject({ valid: true, artifact_kind: 'document' })
		const inspected = await execute(tools.inspect_artifact, { source: 'artifact', artifact: documentArtifact, sections: ['layers'] })
		expect(inspected).toMatchObject({ artifact_kind: 'document', sections: { layers: expect.anything() } })

		const input = await execute(tools.validate_input, { source: 'artifact', artifact: formArtifact, target: 'field', field_path: 'name', value: 'Ada' })
		expect(input).toMatchObject({ valid: true, target: 'field', normalized_value: 'Ada' })
		const filled = await execute(tools.fill, { source: 'artifact', artifact: formArtifact, data: { fields: { name: 'Ada' } } }) as { data?: Record<string, unknown>; evaluation_context?: Record<string, unknown> }
		expect(filled).toMatchObject({ accepted: true, complete: true, data: { fields: { name: 'Ada' } } })
		const state = await execute(tools.get_fill_state, { source: 'artifact', artifact: formArtifact, data: filled?.data, evaluation_context: filled?.evaluation_context })
		expect(state).toMatchObject({ artifact_kind: 'form', summary: { required_remaining: 0 } })
		const updated = await execute(tools.update_fill, { source: 'artifact', artifact: formArtifact, data: filled?.data, patch: { fields: { name: 'Grace' } }, evaluation_context: filled?.evaluation_context }) as { data?: Record<string, unknown> }
		expect(updated).toMatchObject({ accepted: true, data: { fields: { name: 'Grace' } } })
		const rendered = await execute(tools.render, { source: 'artifact', artifact: formArtifact, data: updated?.data })
		expect(rendered).toMatchObject({ success: true, content: 'Name: Grace' })

		expect(fetch).toHaveBeenCalledTimes(3)
	})

	it('returns a structured result for malformed validation input', async () => {
		const result = await execute(createValidateArtifactTool(), {
			source: 'artifact',
			artifact: { malformed: true },
		})

		expect(result).toMatchObject({ valid: false })
})

	it('keeps the complete render result while bounding only model output', () => {
		const tool = createRenderTool({ modelOutputMaxBytes: 8 })
		const output = { success: true, encoding: 'utf-8' as const, content: '0123456789', byte_length: 10 }
		const modelOutput = tool.toModelOutput?.(output)

		expect(output.content).toBe('0123456789')
		expect(modelOutput).toMatchObject({ content: '01234567', byte_length: 10, truncated: true })
		const defaultOutput = createRenderTool().toModelOutput?.({ success: true, content: 'x'.repeat(DEFAULT_MODEL_OUTPUT_MAX_BYTES + 1), encoding: 'utf-8' as const })
		expect(defaultOutput).toMatchObject({ truncated: true })
	})

	it('keeps base64 model output decodable at the configured byte bound', () => {
		const tool = createRenderTool({ modelOutputMaxBytes: 6 })
		const output = { success: true, encoding: 'base64' as const, content: 'QUJDREVGRw==', byte_length: 7 }
		const modelOutput = tool.toModelOutput?.(output)

		expect(modelOutput).toMatchObject({ content: 'QUJDREVG', truncated: true })
	})

	it('propagates Mastra cancellation into the shared fetch policy', async () => {
		const controller = new AbortController()
		let observedSignal: AbortSignal | undefined
		const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			observedSignal = init?.signal ?? undefined
			await new Promise<void>((resolve) => observedSignal?.addEventListener('abort', () => resolve(), { once: true }))
			throw new Error('aborted by test')
		})
		const pending = execute(createGetRegistryTool({ fetch }), { registry_url: 'https://registry.example' }, { abortSignal: controller.signal })

		await vi.waitFor(() => expect(observedSignal).toBeDefined())
		controller.abort()
		const result = await pending

		expect(observedSignal?.aborted).toBe(true)
		expect(result).toMatchObject({ items: [], error: { code: 'registry_fetch_error' } })
	})
})
