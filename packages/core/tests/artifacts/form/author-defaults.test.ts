import { describe, expect, test } from 'vitest'
import { form } from '@/artifacts'
import { validateArtifact as validate } from '@/validation'

// schemas-004: the definition schema must not inject defaults, so `toJSON`
// writes back what the author wrote, and core still applies the defaults.
describe('a form keeps what its author wrote', () => {
	const input = {
		kind: 'form',
		name: 'sale',
		parties: { buyer: { label: 'Buyer', signature: {} } },
		rules: { positive: { expr: 'true', message: 'Must hold' } },
	} as const

	test('toJSON adds no default the author did not write', () => {
		const { $schema: _schema, ...written } = form.from(input).toJSON()
		expect(written).toEqual(input)
	})

	test('an omitted party count still defaults to one party', () => {
		const sale = form.from(input)
		expect(() => sale.fill({ parties: { buyer: { id: 'buyer-0', name: 'A' } } })).not.toThrow()
		expect(() => sale.fill({ parties: { buyer: [{ id: 'buyer-0', name: 'A' }, { id: 'buyer-1', name: 'B' }] } })).toThrow(/must be an object/)
	})

	test('a zero rating step and an invalid pattern are rejected at validation', () => {
		expect(validate({ kind: 'form', name: 'r', fields: { score: { type: 'rating', step: 0 } } }).issues).toBeDefined()
		expect(validate({ kind: 'form', name: 'p', fields: { code: { type: 'text', pattern: '(' } } }).issues).toBeDefined()
		expect(validate({ kind: 'form', name: 'p', fields: { code: { type: 'text', pattern: '^[a-z]+$' } } }).issues).toBeUndefined()
	})
})
