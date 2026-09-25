import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { Agent } from '@mastra/core/agent'
import {
	createExtractTool,
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
import { executeExtract, operationNames, toolDefinitions } from '@paradoc/ai-tools'
import { PARADOC_SCHEMA_URL } from '@paradoc/core'

const documentArtifact = {
	$schema: PARADOC_SCHEMA_URL,
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
		text: { kind: 'inline' as const, mimeType: 'text/plain', text: 'Name: {{fields.name}}' },
	},
	defaultLayer: 'text',
}

async function execute<Tool extends { execute?: (input: never, context: never) => Promise<unknown> }>(tool: Tool, input: unknown, context: unknown = {}) {
	return tool.execute?.(input as never, context as never)
}

/** A one-field AcroForm PDF whose field already holds a value, and the form that binds it. */
const filledPdf = [
	'%PDF-1.4',
	'1 0 obj << /Type /Catalog /Pages 2 0 R /AcroForm 4 0 R >> endobj',
	'2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
	'3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Annots [5 0 R] >> endobj',
	'4 0 obj << /Fields [5 0 R] >> endobj',
	'5 0 obj << /FT /Tx /T (applicant) /Subtype /Widget /Rect [10 10 190 30] /P 3 0 R /V (Ada Lovelace) >> endobj',
	'trailer << /Root 1 0 R >>',
	'%%EOF',
	'',
].join('\n')
const extractInput = {
	source: 'artifact' as const,
	artifact: {
		kind: 'form',
		name: 'intake',
		fields: { name: { type: 'text', label: 'Name', required: true } },
		layers: { pdf: { kind: 'file', mimeType: 'application/pdf', path: 'intake.pdf', bindings: { applicant: 'name' } } },
	},
	pdf: btoa(filledPdf),
}

describe('@paradoc/mastra', () => {
	it('publishes the ten canonical operations as native Mastra tools', () => {
		const tools = paradocTools()

		expect(Object.keys(tools)).toEqual(operationNames)
		for (const name of operationNames) {
			const tool = tools[name]
			expect(tool.id).toBe(name)
			expect(tool.description).toBe(toolDefinitions[name].description)
			expect(tool.inputSchema).toBe(toolDefinitions[name].input_schema)
			expect((z.toJSONSchema(toolDefinitions[name].input_schema) as Record<string, unknown>).type, name).toBe('object')
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
			createExtractTool,
		]
		expect(factories.map((factory) => factory().id)).toEqual(operationNames)
	})

	it('reads a filled PDF through the extract tool with the shared result', async () => {
		const result = await execute(createExtractTool(), extractInput)

		expect(result).toMatchObject({ success: true, layer: 'pdf', data: { fields: { name: 'Ada Lovelace' } } })
		expect(result).toEqual(await executeExtract(extractInput))
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
		const tool = createRenderTool({ maxOutputBytes: 8 })
		const output = { success: true, encoding: 'utf-8' as const, content: '0123456789', byte_length: 10 }
		const modelOutput = tool.toModelOutput?.(output)

		expect(output.content).toBe('0123456789')
		expect(modelOutput).toMatchObject({ type: 'json', value: { content: '01234567', byte_length: 10, truncated: true } })
		const defaultOutput = createRenderTool().toModelOutput?.({ success: true, content: 'x'.repeat(DEFAULT_MODEL_OUTPUT_MAX_BYTES + 1), encoding: 'utf-8' as const })
		expect(defaultOutput).toMatchObject({ type: 'json', value: { truncated: true } })
	})

	it('keeps base64 model output decodable at the configured byte bound', () => {
		const tool = createRenderTool({ maxOutputBytes: 6 })
		const output = { success: true, encoding: 'base64' as const, content: 'QUJDREVGRw==', byte_length: 7 }
		const modelOutput = tool.toModelOutput?.(output)

		expect(modelOutput).toMatchObject({ type: 'json', value: { content: 'QUJD', truncated: true } })
	})

	it('sends a typed bounded tool result through a real Mastra Agent', async () => {
		let call = 0
		let secondPrompt: unknown
		const model = {
			specificationVersion: 'v3',
			provider: 'test',
			modelId: 'capture',
			supportedUrls: {},
			doGenerate: async (options: { prompt: unknown }) => {
				call += 1
				if (call === 1) {
					return {
						content: [{ type: 'tool-call' as const, toolCallId: 'render-1', toolName: 'render', input: JSON.stringify({ source: 'artifact', artifact: documentArtifact }) }],
						finishReason: { unified: 'tool-calls' as const, raw: 'tool_calls' },
						usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
						warnings: [],
					}
				}
				secondPrompt = options.prompt
				return {
					content: [{ type: 'text' as const, text: 'done' }],
					finishReason: { unified: 'stop' as const, raw: 'stop' },
					usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
					warnings: [],
				}
			},
			doStream: async () => { throw new Error('not used') },
		}
		const agent = new Agent({
			id: 'model-output-test',
			name: 'Model output test',
			instructions: 'Render the document.',
			model: model as never,
			tools: { render: createRenderTool({ maxOutputBytes: 4 }) },
		})

		await agent.generate('Render it', { maxSteps: 2 })
		const serialized = JSON.stringify(secondPrompt)
		expect(serialized).toContain('"type":"json"')
		expect(serialized).toContain('"truncated":true')
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

	it.each(['signal', 'context'] as const)('honors an aborted config %s signal', async (source) => {
		const controller = new AbortController()
		controller.abort(new Error('cancelled before execution'))
		const fetch = vi.fn(async () => Response.json({ items: [] }))
		const signalConfig = source === 'signal'
			? { signal: controller.signal }
			: { context: { signal: controller.signal } }

		const result = await execute(createGetRegistryTool({
			...signalConfig,
			fetch,
			defaultRegistryUrl: 'https://registry.example',
		}), {})

		expect(fetch).not.toHaveBeenCalled()
		expect(result).toMatchObject({ items: [], error: { code: 'registry_fetch_error' } })
	})

	it('creates a fresh request cache for each Mastra call', async () => {
		const fetch = vi.fn(async () => Response.json({ items: [] }))
		const tool = createGetRegistryTool({ fetch, defaultRegistryUrl: 'https://registry.example' })

		await execute(tool, {})
		await execute(tool, {})

		expect(fetch).toHaveBeenCalledTimes(2)
	})
})
