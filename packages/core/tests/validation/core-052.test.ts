/**
 * core-052: an empty array fails an optional multi-party role, but null passes.
 * Input: role { label: 'Tenant', max: 3, required: false }; parties [] vs null.
 * Expected: both pass (the role is optional). Actual: [] gives
 *   'Role "tenant" requires at least 1 party(ies), but only 0 provided'.
 */
import { describe, expect, test } from 'vitest'
import { form } from '@/artifacts'
import { validatePartiesForRole } from '@/validation/party'

const role = { label: 'Tenant', max: 3, required: false } as never

describe('core-052', () => {
	test('null passes for an optional role', () => {
		expect(validatePartiesForRole(null, role, 'tenant').success).toBe(true)
	})
	test('an empty list passes for an optional role', () => {
		const r = validatePartiesForRole([], role, 'tenant')
		expect(r.success).toBe(true)
	})
	test('fill with an empty optional role completes', () => {
		const f = form()
			.name('f').version('1.0.0').title('F')
			.fields({ a: { type: 'text', label: 'A' } })
			.parties({ tenant: { label: 'Tenant', partyType: 'person', max: 3, required: false } as never })
			.build()
		const r = f.safeFill({ fields: {}, parties: { tenant: [] } } as never)
		expect(r.success).toBe(true)
		const v = (r as { data: { validate(): { valid: boolean; errors: unknown } } }).data.validate()
		const fs = (r as { data: { getFillState(): { complete?: boolean; openRequired: unknown[] } } }).data.getFillState()
		expect(v.valid).toBe(true)
	})
})
