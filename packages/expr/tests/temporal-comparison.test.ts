import { describe, expect, it } from 'vitest'
import { createContext, evaluateExpression } from '../src/index'

// Regression for issue:datetime-ordering-equality-and-min-max (audit finding expr-001).
// Datetime ordering, equality, and min/max compared raw ISO strings, not instants.
// Inputs mix offsets and precisions; results must reflect the actual instant.
function run(src: string, data: Record<string, unknown>, asOf?: { date: string; datetime: string }) {
	const r = evaluateExpression(src, createContext(data, asOf ? { asOf } : {}))
	if (!r.success) throw new Error(`eval failed: ${r.error}`)
	return r.value.kind === 'string' || r.value.kind === 'boolean' ? r.value.value : r.value
}

describe('datetime comparison compares instants', () => {
	it('deadline 10:00-04:00 (14:00Z) is not before now 13:30Z', () => {
		expect(
			run('fields.deadline < now()', { fields: { deadline: '2026-09-23T10:00:00-04:00' } }, { date: '2026-09-23', datetime: '2026-09-23T13:30:00Z' }),
		).toBe(false)
	})

	it('10:00:30Z is not before 10:00Z', () => {
		expect(run('fields.a < fields.b', { fields: { a: '2026-09-23T10:00:30Z', b: '2026-09-23T10:00Z' } })).toBe(false)
	})

	it('same instant with different offsets is equal', () => {
		expect(run('fields.a == fields.b', { fields: { a: '2026-09-23T10:00:00Z', b: '2026-09-23T12:00:00+02:00' } })).toBe(true)
	})

	it('different instants with the same offset are not equal', () => {
		expect(run('fields.a == fields.b', { fields: { a: '2026-09-23T10:00:00Z', b: '2026-09-23T10:00:00.5Z' } })).toBe(false)
	})

	it('max picks the later instant', () => {
		expect(
			run('max(fields.items.at)', {
				fields: { items: [{ at: '2026-09-23T10:00:00Z' }, { at: '2026-09-23T11:00:00+05:00' }] },
			}),
		).toBe('2026-09-23T10:00:00Z')
	})

	it('min picks the earlier instant', () => {
		expect(
			run('min(fields.items.at)', {
				fields: { items: [{ at: '2026-09-23T10:00:00Z' }, { at: '2026-09-23T11:00:00+05:00' }] },
			}),
		).toBe('2026-09-23T11:00:00+05:00')
	})

	it('falls back to lexical comparison for non-datetime strings', () => {
		expect(run('fields.a < fields.b', { fields: { a: 'apple', b: 'banana' } })).toBe(true)
		expect(run('fields.a == fields.b', { fields: { a: 'apple', b: 'Apple' } })).toBe(false)
	})
})
