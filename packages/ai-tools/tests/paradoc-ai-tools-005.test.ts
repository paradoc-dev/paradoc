import { describe, expect, it } from 'vitest'
import { executeFill, executeInspectArtifact } from '../src/index'

describe('execute input validation', () => {
	it('rejects an incomplete artifact source as invalid input', async () => {
		const result = await executeFill({ source: 'artifact', data: {} } as never)
		expect(result.error?.code).toBe('invalid_input')
	})

	it('does not treat a missing source as registry mode', async () => {
		const result = await executeInspectArtifact({ artifact: { kind: 'form', name: 'f', fields: {} } } as never)
		expect(result.error?.code).toBe('invalid_input')
	})
})
