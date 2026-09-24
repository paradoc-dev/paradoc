/**
 * core-015: `p.field` spread `field` into a plain object literal and then
 * listed 24 of its members again, which dropped `field`'s own callable form.
 *
 * Expected: `p.field` behaves exactly like the `field` builder it re-exports
 * — both callable directly and with its named members (e.g. `p.field.text`).
 */
import { describe, test, expect } from 'vitest'
import { p } from '@/artifacts'

describe('core-015: p.field stays callable, like the field builder it wraps', () => {
	test('p.field.text still works (a member)', () => {
		expect(() => p.field.text().label('x')).not.toThrow()
	})

	test('p.field(...) is callable directly', () => {
		expect(() => (p.field as unknown as (...args: unknown[]) => unknown)()).not.toThrow()
	})
})
