/**
 * core-036: bundle definitions are type-checked against their declared type,
 * as form definitions are.
 */
import { describe, expect, test } from 'vitest'
import type { Bundle, Form } from '@paradoc/types'
import { validateBundleDefs } from '@/logic/design-time/validation/validate-bundle-logic'

const main = {
	kind: 'form',
	version: '1.0.0',
	name: 'main-form',
	title: 'Main',
	fields: { name: { type: 'text' }, agreed: { type: 'boolean' } },
} as unknown as Form

function bundleWith(value: string): Bundle {
	return {
		kind: 'bundle',
		version: '1.0.0',
		name: 'b',
		title: 'B',
		defs: { needsForm: { type: 'boolean', value } },
		contents: [{ type: 'inline', key: 'main', artifact: main }],
	} as unknown as Bundle
}

describe('core-036: bundle definitions are type-checked', () => {
	test('accepts a definition that returns its declared type', () => {
		expect(validateBundleDefs(bundleWith('forms.main.fields.agreed')).issues).toBeUndefined()
	})

	test('rejects a definition that returns another type', () => {
		expect(validateBundleDefs(bundleWith('forms.main.fields.name')).issues).toEqual([
			expect.objectContaining({
				message: 'Expected expression type boolean, got string',
				path: ['defs', 'needsForm', 'value'],
				expectedType: 'boolean',
				actualType: 'string',
			}),
		])
	})
})
