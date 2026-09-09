import { chat, type AdapterYieldChunk, type AnyTextAdapter } from '@tanstack/ai'
import { describe, expect, it } from 'vitest'
import { operationNames, toolDefinitions } from '@paradoc/ai-tools'
import {
	fill,
	getFillState,
	getRegistry,
	inspectArtifact,
	paradocToolDefinitions,
	paradocTools,
	updateFill,
	validateArtifact,
	validateInput,
} from '../src/index'

const artifact = {
	kind: 'form',
	name: 'test',
	fields: {
		name: { type: 'text', label: 'Name', required: true },
	},
}

describe('paradocTools', () => {
	it('returns all nine native server tools in contract order', () => {
		const tools = paradocTools()

		expect(tools).toHaveLength(9)
		expect(tools.map((tool) => tool.name)).toEqual(operationNames)
		expect(tools.every((tool) => tool.__toolSide === 'server')).toBe(true)
		expect(tools.every((tool) => typeof tool.execute === 'function')).toBe(true)
	})

	it('exposes definition-only tools without server execution', () => {
		const definitions = paradocToolDefinitions()

		expect(definitions).toHaveLength(9)
		expect(definitions.map((definition) => definition.name)).toEqual(operationNames)
		expect(definitions.every((definition) => definition.__toolSide === 'definition')).toBe(true)
		expect(definitions.every((definition) => !('execute' in definition))).toBe(true)
	})

	it('uses the shared descriptions and schemas directly', () => {
		const tools = paradocTools()

		for (const tool of tools) {
			const definition = toolDefinitions[tool.name]
			expect(tool.description).toBe(definition.description)
			expect(tool.inputSchema).toBe(definition.input_schema)
			expect(tool.outputSchema).toBe(definition.output_schema)
		}
	})

	it('validates an artifact through the native server tool', async () => {
		const result = await validateArtifact().execute!({ source: 'artifact', artifact })

		expect(result.valid).toBe(true)
		expect(result.artifact_kind).toBe('form')
	})

	it('preserves progressive fill, state, update, inspection, and input operations', async () => {
		const fillResult = await fill().execute!({ source: 'artifact', artifact, data: { fields: {} } })
		expect(fillResult.accepted).toBe(true)
		expect(fillResult.complete).toBe(false)

		const stateResult = await getFillState().execute!({ source: 'artifact', artifact, data: fillResult.data ?? {} })
		expect(stateResult.artifact_kind).toBe('form')
		expect(stateResult.summary.required_remaining).toBeGreaterThan(0)

		const updateResult = await updateFill().execute!({
			source: 'artifact',
			artifact,
			data: fillResult.data ?? {},
			patch: { fields: { name: 'Ada' } },
		})
		expect(updateResult.accepted).toBe(true)

		const inspectResult = await inspectArtifact().execute!({ source: 'artifact', artifact })
		expect(inspectResult.artifact_kind).toBe('form')
		expect(inspectResult.sections).toHaveProperty('fields')

		const inputResult = await validateInput().execute!({
			source: 'artifact',
			artifact,
			target: 'field',
			field_path: 'name',
			value: 'Ada',
		})
		expect(inputResult.valid).toBe(true)
		expect(inputResult.normalized_value).toBe('Ada')
	})

	it('composes TanStack abortSignal with shared fetch policy', async () => {
		const controller = new AbortController()
		let observedSignal: AbortSignal | undefined
		let resolveFetchStarted: (() => void) | undefined
		const fetchStarted = new Promise<void>((resolve) => {
			resolveFetchStarted = resolve
		})
		const registryTool = getRegistry({
			defaultRegistryUrl: 'https://example.test',
			fetch: async (_input, init) => {
				observedSignal = init?.signal ?? undefined
				resolveFetchStarted?.()
				return await new Promise<Response>((resolve) => {
					init?.signal?.addEventListener(
						'abort',
						() =>
							resolve(
								new Response(JSON.stringify({ artifacts: [] }), {
									status: 200,
									headers: { 'content-type': 'application/json' },
								}),
							),
						{ once: true },
					)
				})
			},
		})

		const pending = registryTool.execute!(
			{},
			{
				abortSignal: controller.signal,
				emitCustomEvent: () => undefined,
			},
		)

		await fetchStarted
		controller.abort(new Error('cancelled'))
		const result = await pending

		expect(observedSignal?.aborted).toBe(true)
		expect(result.items).toEqual([])
		expect(observedSignal).toBeDefined()
		expect(observedSignal).not.toBe(controller.signal)
	})

	it('executes a deterministic tool call through native TanStack chat', async () => {
		let callCount = 0
		let receivedToolCount = 0
		const adapter = {
			kind: 'text' as const,
			name: 'deterministic',
			model: 'deterministic',
			'~types': {} as AnyTextAdapter['~types'],
			structuredOutput: async () => {
				throw new Error('structured output is not part of this harness')
			},
			chatStream: async function* (options: Parameters<AnyTextAdapter['chatStream']>[0]): AsyncGenerator<AdapterYieldChunk> {
				callCount += 1
				receivedToolCount = options.tools?.length ?? 0
				const threadId = options.threadId ?? 'thread-1'
				const runId = options.runId ?? `run-${callCount}`

				yield { type: 'RUN_STARTED', threadId, runId, timestamp: Date.now() } as AdapterYieldChunk
				if (callCount === 1) {
					yield {
						type: 'TOOL_CALL_START',
						toolCallId: 'validate-1',
						toolCallName: 'validate_artifact',
						timestamp: Date.now(),
					} as AdapterYieldChunk
					yield {
						type: 'TOOL_CALL_ARGS',
						toolCallId: 'validate-1',
						delta: JSON.stringify({ source: 'artifact', artifact }),
						timestamp: Date.now(),
					} as AdapterYieldChunk
					yield {
						type: 'TOOL_CALL_END',
						toolCallId: 'validate-1',
						input: { source: 'artifact', artifact },
						timestamp: Date.now(),
					} as AdapterYieldChunk
					yield { type: 'RUN_FINISHED', threadId, runId, finishReason: 'tool_calls', timestamp: Date.now() } as AdapterYieldChunk
					return
				}

				yield { type: 'TEXT_MESSAGE_START', messageId: 'message-2', timestamp: Date.now() } as AdapterYieldChunk
				yield { type: 'TEXT_MESSAGE_CONTENT', messageId: 'message-2', delta: 'done', timestamp: Date.now() } as AdapterYieldChunk
				yield { type: 'TEXT_MESSAGE_END', messageId: 'message-2', timestamp: Date.now() } as AdapterYieldChunk
				yield { type: 'RUN_FINISHED', threadId, runId, finishReason: 'stop', timestamp: Date.now() } as AdapterYieldChunk
			},
		} as AnyTextAdapter

		const chunks: Array<AdapterYieldChunk> = []
		for await (const chunk of chat({
			adapter,
			messages: [{ role: 'user', content: 'Validate this artifact.' }],
			tools: paradocTools(),
		})) {
			chunks.push(chunk)
		}

		const toolResult = chunks.find((chunk) => chunk.type === 'TOOL_CALL_RESULT')
		expect(callCount).toBe(2)
		expect(receivedToolCount).toBe(9)
		expect(toolResult).toMatchObject({
			toolCallId: 'validate-1',
			content: JSON.stringify({ valid: true, artifact_kind: 'form' }),
		})
	})
})
