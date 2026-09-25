import { generateText, stepCountIs, type LanguageModel } from 'ai'
import { describe, expect, it } from 'vitest'
import { operationNames } from '@paradoc/ai-tools'
import { paradocTools } from '../src/index'

describe('provider-facing input schemas', () => {
	it('gives every tool an object-rooted JSON schema', async () => {
		let seenTools: Array<{ type: string; name: string; inputSchema: Record<string, unknown> }> = []
		const model = {
			specificationVersion: 'v3', provider: 'test', modelId: 'capture', supportedUrls: {},
			doGenerate: async (options: { tools?: typeof seenTools }) => {
				seenTools = options.tools ?? []
				return { content: [{ type: 'text' as const, text: 'ok' }], finishReason: { unified: 'stop' as const, raw: 'stop' }, usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }, warnings: [] }
			},
			doStream: async () => { throw new Error('not used') },
		} as unknown as LanguageModel
		await generateText({ model, tools: paradocTools(), prompt: 'hi', stopWhen: stepCountIs(1) })
		expect(seenTools.map((tool) => tool.name).sort()).toEqual([...operationNames].sort())
		expect(seenTools.every((tool) => tool.inputSchema.type === 'object')).toBe(true)
	})
})
