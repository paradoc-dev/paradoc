import { describe, expect, it } from 'vitest'
import { PARADOC_SCHEMA_URL } from '@paradoc/core'
import { FillStateOutputSchema, executeGetFillState } from '../src'

const ruledForm = {
	kind: 'form' as const,
	name: 'loan-request',
	fields: {
		amount: { type: 'number' as const, label: 'Amount', required: true },
		term: { type: 'number' as const, label: 'Term in months' },
	},
	rules: {
		amountPositive: { expr: 'amount > 0', message: 'Amount must be positive' },
		termReasonable: { expr: 'term <= 360', message: 'Term is unusually long', severity: 'warning' as const },
	},
	layers: { text: { kind: 'inline' as const, mimeType: 'text/plain', text: '{{fields.amount}}' } },
	defaultLayer: 'text',
}

describe('get_fill_state rule results', () => {
	it('names the violated rule in each error and warning', async () => {
		const state = await executeGetFillState({ source: 'artifact', artifact: ruledForm, data: { fields: { amount: -5, term: 480 } } })

		expect(state.rules).toEqual({
			valid: false,
			errors: [{ rule_id: 'amountPositive', message: 'Amount must be positive' }],
			warnings: [{ rule_id: 'termReasonable', message: 'Term is unusually long' }],
		})
		expect(state.errors).toBeUndefined()
		expect(FillStateOutputSchema.parse(state).rules.errors[0]?.rule_id).toBe('amountPositive')
	})

	it('reports no violations when every rule passes', async () => {
		const state = await executeGetFillState({ source: 'artifact', artifact: ruledForm, data: { fields: { amount: 1000, term: 36 } } })

		expect(state.rules).toEqual({ valid: true, errors: [], warnings: [] })
		expect(FillStateOutputSchema.safeParse(state).success).toBe(true)
	})

	it('reports unresolved logic as tool errors, not as rule violations', async () => {
		const unresolved = {
			kind: 'form' as const,
			name: 'unresolved-runtime',
			fields: {
				amount: { type: 'number' as const },
				dependent: { type: 'text' as const, visible: 'fields.amount / 0 > 1', required: true },
			},
			layers: { text: { kind: 'inline' as const, mimeType: 'text/plain', text: '{{fields.amount}}' } },
			defaultLayer: 'text',
		}
		const state = await executeGetFillState({ source: 'artifact', artifact: unresolved })

		expect(state.rules).toEqual({ valid: false, errors: [], warnings: [] })
		expect(state.errors?.length).toBeGreaterThan(0)
		expect(state.errors?.every((error) => error.code === 'logic_unresolved')).toBe(true)
		expect(state.candidates).toEqual([])
		expect(FillStateOutputSchema.safeParse(state).success).toBe(true)
	})

	it('keeps rule arrays structured for an unsupported artifact', async () => {
		const document = {
			$schema: PARADOC_SCHEMA_URL,
			kind: 'document' as const,
			name: 'notice',
			layers: { text: { kind: 'inline' as const, mimeType: 'text/plain', text: 'A notice.' } },
			defaultLayer: 'text',
		}
		const state = await executeGetFillState({ source: 'artifact', artifact: document })

		expect(state.phase).toBe('unsupported')
		expect(state.rules).toEqual({ valid: false, errors: [], warnings: [] })
		expect(state.errors).toEqual([{ code: 'unsupported_artifact', message: 'Only form and checklist artifacts support fill state.' }])
		expect(FillStateOutputSchema.safeParse(state).success).toBe(true)
	})

	it('rejects a plain string rule entry in the output schema', () => {
		const parsed = FillStateOutputSchema.safeParse({
			artifact_kind: 'form',
			phase: 'draft',
			summary: { required_total: 0, required_done: 0, required_remaining: 0, completion_percent: 100 },
			rules: { valid: false, errors: ['Amount must be positive'], warnings: [] },
			open_required: [], open_optional: [], blocked: [], done: [], candidates: [], next: null,
		})
		expect(parsed.success).toBe(false)
	})
})
