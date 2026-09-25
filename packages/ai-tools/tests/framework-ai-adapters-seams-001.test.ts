import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { toolDefinitions } from '../src/index'

describe('model-facing input schemas', () => {
	for (const [name, definition] of Object.entries(toolDefinitions)) {
		it(`${name} has an object root`, () => {
			const json = z.toJSONSchema(definition.input_schema as z.ZodType) as Record<string, unknown>
			expect(json.type).toBe('object')
		})
	}
})
