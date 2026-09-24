/**
 * core-035: bundle validation accepts the paths the bundle type environment
 * provides: object-definition members and inline form parties. A path the
 * environment does not provide is still rejected.
 */
import { describe, expect, test } from 'vitest'
import type { Bundle, Form } from '@paradoc/types'
import { validateBundleDefs } from '@/logic/design-time/validation/validate-bundle-logic'

const main = {
	kind: 'form',
	version: '1.0.0',
	name: 'main-form',
	title: 'Main',
	fields: { amount: { type: 'number' } },
	parties: { buyer: { label: 'Buyer' } },
	defs: { total: { type: 'money', value: { amount: 'fields.amount', currency: '"USD"' } } },
} as unknown as Form

const extra = { kind: 'form', version: '1.0.0', name: 'extra', title: 'Extra', fields: { x: { type: 'text' } } } as unknown as Form

function bundleWith(include: string): Bundle {
	return {
		kind: 'bundle',
		version: '1.0.0',
		name: 'b',
		title: 'B',
		defs: { fee: { type: 'money', value: { amount: 'forms.main.fields.amount', currency: '"USD"' } } },
		contents: [
			{ type: 'inline', key: 'main', artifact: main },
			{ type: 'inline', key: 'extra', artifact: extra, include },
		],
	} as unknown as Bundle
}

describe('core-035: bundle variables come from the bundle type environment', () => {
	test.each([
		['a bundle object-definition member', 'fee.amount > 0'],
		['an inline form party member', 'forms.main.parties.buyer.name != ""'],
		['an inline form object-definition member', 'forms.main.total.amount > 0'],
	])('accepts %s', (_label, include) => {
		expect(validateBundleDefs(bundleWith(include)).issues).toBeUndefined()
	})

	test.each([
		['an unknown definition member', 'fee.nope > 0', 'fee.nope'],
		['an unknown party', 'forms.main.parties.seller.name != ""', 'forms.main.parties.seller.name'],
	])('rejects %s', (_label, include, variable) => {
		expect(validateBundleDefs(bundleWith(include)).issues).toEqual([
			expect.objectContaining({ message: `Unknown variable: "${variable}"`, path: ['contents', 1, 'include'] }),
		])
	})
})
