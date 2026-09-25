import { convertSchemaToJsonSchema } from '@tanstack/ai'
import { describe, expect, it } from 'vitest'
import { paradocTools } from '../src/index'

describe('provider-facing input schemas', () => {
	it('gives every tool an object-rooted JSON schema', () => {
		for (const tool of paradocTools()) {
			const json = convertSchemaToJsonSchema(tool.inputSchema) as Record<string, unknown>
			expect(json.type, tool.name).toBe('object')
		}
	})
})
