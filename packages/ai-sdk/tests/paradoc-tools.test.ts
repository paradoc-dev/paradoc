import { generateText, InvalidToolInputError, stepCountIs, type LanguageModel } from 'ai'
import { describe, expect, it } from 'vitest'
import {
	extract,
	fill,
	getArtifact,
	getFillState,
	getRegistry,
	inspectArtifact,
	paradocTools,
	render,
	updateFill,
	validateArtifact,
	validateInput,
} from '../src/index'
import { executeExtract, operationNames, toolDefinitions } from '@paradoc/ai-tools'

const executionOptions = {
	toolCallId: 'test-call',
	messages: [],
	context: {},
}

async function resolveToolResult<T>(result: T | PromiseLike<T> | AsyncIterable<T>): Promise<T> {
	if (typeof result === 'object' && result !== null && Symbol.asyncIterator in result) {
		let last: T | undefined
		for await (const value of result) last = value
		return last as T
	}
	return await result
}

const formArtifact = {
	kind: 'form',
	name: 'test',
	fields: { name: { type: 'text', label: 'Name', required: true } },
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

describe('AI SDK 7 Paradoc tools', () => {
	it('returns the ten canonical tools under their model-facing names', () => {
		const tools = paradocTools()

		expect(Object.keys(tools)).toEqual(operationNames)
		for (const name of operationNames) {
			expect(tools[name], `${name} should be executable`).toHaveProperty('execute')
			expect(tools[name].description).toBe(toolDefinitions[name].description)
			expect(tools[name].inputSchema).toBe(toolDefinitions[name].input_schema)
			expect(tools[name].outputSchema).toBe(toolDefinitions[name].output_schema)
		}
	})

	it('exposes each operation as an individual native tool factory', () => {
		const tools = {
			get_registry: getRegistry(),
			get_artifact: getArtifact(),
			inspect_artifact: inspectArtifact(),
			validate_artifact: validateArtifact(),
			validate_input: validateInput(),
			fill: fill(),
			get_fill_state: getFillState(),
			update_fill: updateFill(),
			render: render(),
			extract: extract(),
		}

		expect(Object.keys(tools)).toEqual(operationNames)
		for (const [name, tool] of Object.entries(tools)) {
			expect(tool, `${name} should expose the AI SDK execute callback`).toHaveProperty('execute')
		}
	})

	it('reads a filled PDF through the extract tool with the shared result', async () => {
		const result = await resolveToolResult(paradocTools().extract.execute(extractInput, executionOptions))

		expect(result).toMatchObject({ success: true, layer: 'pdf', data: { fields: { name: 'Ada Lovelace' } } })
		expect(result).toEqual(await executeExtract(extractInput))
	})

	it('uses canonical snake_case input without a second adapter parse', async () => {
		const tools = paradocTools()
		const result = await resolveToolResult(tools.validate_artifact.execute({
			source: 'artifact',
			artifact: formArtifact,
		}, executionOptions))

		expect(result).toEqual({ valid: true, artifact_kind: 'form' })
	})

	it('executes a deterministic AI SDK 7 tool call through the native generation loop', async () => {
		const model = {
			specificationVersion: 'v3',
			provider: 'test',
			modelId: 'deterministic',
			supportedUrls: {},
			doGenerate: async () => ({
				content: [{
					type: 'tool-call' as const,
					toolCallId: 'validate-1',
					toolName: 'validate_artifact',
					input: JSON.stringify({ source: 'artifact', artifact: formArtifact }),
				}],
				finishReason: { unified: 'tool-calls' as const, raw: 'tool_calls' },
				usage: {
					inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
					outputTokens: { total: 1, text: 1, reasoning: 0 },
				},
				warnings: [],
			}),
			doStream: async () => {
				throw new Error('streaming is not part of this deterministic harness')
			},
		} as LanguageModel

		const result = await generateText({
			model,
			tools: paradocTools(),
			prompt: 'Validate the supplied artifact.',
			stopWhen: stepCountIs(1),
		})

		expect(result.toolCalls).toHaveLength(1)
		expect(result.toolCalls[0]).toMatchObject({
			toolName: 'validate_artifact',
			input: { source: 'artifact', artifact: formArtifact },
		})
		expect(result.toolResults[0]).toMatchObject({
			toolName: 'validate_artifact',
			output: { valid: true, artifact_kind: 'form' },
		})
	})

	it('keeps malformed model calls in AI SDK structured invalid-call handling', async () => {
		const model = {
			specificationVersion: 'v3',
			provider: 'test',
			modelId: 'deterministic-invalid',
			supportedUrls: {},
			doGenerate: async () => ({
				content: [{
					type: 'tool-call' as const,
					toolCallId: 'invalid-1',
					toolName: 'validate_artifact',
					input: JSON.stringify({ source: 'artifact' }),
				}],
				finishReason: { unified: 'tool-calls' as const, raw: 'tool_calls' },
				usage: {
					inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
					outputTokens: { total: 1, text: 1, reasoning: 0 },
				},
				warnings: [],
			}),
			doStream: async () => {
				throw new Error('streaming is not part of this deterministic harness')
			},
		} as LanguageModel

		const result = await generateText({
			model,
			tools: paradocTools(),
			prompt: 'Validate the supplied artifact.',
			stopWhen: stepCountIs(1),
		})
		const invalidCall = result.toolCalls[0] as { invalid?: boolean; error?: unknown }

		expect(invalidCall.invalid).toBe(true)
		expect(InvalidToolInputError.isInstance(invalidCall.error)).toBe(true)
		expect(result.toolResults).toHaveLength(0)
	})

	it('exposes canonical native schema errors for malformed model input', () => {
		const tools = paradocTools()
		const parsed = toolDefinitions.validate_artifact.input_schema.safeParse({ source: 'artifact' })

		expect(parsed.success).toBe(false)
		if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(['artifact'])
	})

	it('preserves accepted draft data and evaluation context from the shared executor', async () => {
		const tools = paradocTools()
		const result = await resolveToolResult(tools.fill.execute({
			source: 'artifact',
			artifact: formArtifact,
			data: { fields: {} },
		}, executionOptions))

		expect(result.accepted).toBe(true)
		expect(result.complete).toBe(false)
		expect(result.data).toEqual({ fields: {}, parties: {} })
		expect(result).not.toHaveProperty('detectedKind')
	})

	it('propagates the AI SDK abort signal into registry fetches', async () => {
		const controller = new AbortController()
		let observedSignal: AbortSignal | undefined
		let resolveFetchStarted: (() => void) | undefined
		const fetchStarted = new Promise<void>((resolve) => {
			resolveFetchStarted = resolve
		})
		const fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
			observedSignal = init?.signal ?? undefined
			resolveFetchStarted?.()
			await new Promise<void>((resolve) => {
				init?.signal?.addEventListener('abort', () => resolve(), { once: true })
			})
			return new Response(JSON.stringify({ items: [] }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			})
		}

		const tools = paradocTools({
			fetch,
			defaultRegistryUrl: 'https://public.paradoc.dev',
		})
		const pending = resolveToolResult(tools.get_registry.execute({}, { ...executionOptions, abortSignal: controller.signal }))

		await fetchStarted
		controller.abort(new Error('cancelled'))
		const result = await pending

		expect(observedSignal?.aborted).toBe(true)
		expect(result.items).toEqual([])
	})

	it('composes a caller context signal with the AI SDK abort signal', async () => {
		const contextController = new AbortController()
		const modelController = new AbortController()
		let observedSignal: AbortSignal | undefined
		let resolveFetchStarted: (() => void) | undefined
		const fetchStarted = new Promise<void>((resolve) => {
			resolveFetchStarted = resolve
		})
		const fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
			observedSignal = init?.signal ?? undefined
			resolveFetchStarted?.()
			await new Promise<void>((resolve) => {
				init?.signal?.addEventListener('abort', () => resolve(), { once: true })
			})
			return new Response(JSON.stringify({ items: [] }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			})
		}

		const tools = paradocTools({
			fetch,
			context: { signal: contextController.signal },
			defaultRegistryUrl: 'https://public.paradoc.dev',
		})
		const pending = resolveToolResult(tools.get_registry.execute({}, { ...executionOptions, abortSignal: modelController.signal }))

		await fetchStarted
		contextController.abort(new Error('context cancelled'))
		await new Promise((resolve) => setTimeout(resolve, 0))
		const contextAbortReachedRequest = observedSignal?.aborted === true

		modelController.abort(new Error('model cancelled'))
		await pending

		expect(contextAbortReachedRequest).toBe(true)
	})

	it('creates a fresh request cache for each AI SDK call', async () => {
		let calls = 0
		const tools = paradocTools({
			defaultRegistryUrl: 'https://registry.example',
			fetch: async () => {
				calls += 1
				return Response.json({ items: [] })
			},
		})

		await resolveToolResult(tools.get_registry.execute({}, executionOptions))
		await resolveToolResult(tools.get_registry.execute({}, executionOptions))
		expect(calls).toBe(2)
	})

	it('keeps application output complete while bounding the model copy', async () => {
		const tool = render({ maxOutputBytes: 4 })
		const output = { success: true, content: '0123456789', encoding: 'utf-8' as const, byte_length: 10 }
		const modelOutput = await tool.toModelOutput?.({ toolCallId: 'render-1', input: {}, output })

		expect(output.content).toBe('0123456789')
		expect(modelOutput).toEqual({ type: 'json', value: { ...output, content: '0123', truncated: true } })
	})
})
