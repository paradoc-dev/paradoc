import { describe, expect, test } from 'vitest'
import { form } from '@/artifacts'
import { validateFieldInput } from '@/validation/progressive'

// Regression for issue:datetime-bounds-compare-strings-so (audit finding core-051).
// Datetime min/max bounds compared strings, so fractional seconds broke a bound
// they actually met (or missed one they actually broke).
function f() {
	return form()
		.name('f').version('1.0.0').title('F')
		.fields({
			start: { type: 'datetime', label: 'Start', min: '2024-01-01T00:00:00Z' },
			end: { type: 'datetime', label: 'End', max: '2024-01-01T00:00:00Z' },
		})
		.build()
}

describe('core-051', () => {
	test('a later instant with fractional seconds meets min', () => {
		const r = validateFieldInput(f(), { fieldPath: 'start', value: '2024-01-01T00:00:00.500Z' })
		expect(r.success).toBe(true)
	})
	test('a later instant with fractional seconds breaks max', () => {
		const r = validateFieldInput(f(), { fieldPath: 'end', value: '2024-01-01T00:00:00.500Z' })
		expect(r.success).toBe(false)
	})
	test('fill applies the same bounds', () => {
		const r = f().safeFill({ fields: { start: '2024-01-01T00:00:00.500Z' } })
		expect(r.success).toBe(true)
	})
	test('an instant genuinely before min is still rejected', () => {
		const r = validateFieldInput(f(), { fieldPath: 'start', value: '2023-12-31T23:00:00Z' })
		expect(r.success).toBe(false)
	})
})
