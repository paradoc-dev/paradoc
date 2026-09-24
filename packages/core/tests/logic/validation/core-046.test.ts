/**
 * core-046: the boolean-gate check does not repeat unknown-variable issues,
 * and a dependency cycle is an error (decision D6: logic issues have no
 * severity; every issue fails validation).
 */
import { describe, expect, test } from 'vitest'
import { form } from '@/artifacts'
import { validateLogic } from '@/logic'
import { validate } from '@/validation/artifact'

describe('core-046', () => {
	test('an unknown variable in a boolean gate is reported once', () => {
		const f = form()
			.name('f').version('1.0.0').title('F')
			.fields({ a: { type: 'text', label: 'A', visible: 'fields.nope' } as never })
			.build()
		expect(validateLogic(f as never).issues).toEqual([
			expect.objectContaining({ message: 'Unknown variable: "fields.nope"' }),
		])
	})

	test('a gate that resolves but is not boolean is still a type issue', () => {
		const f = form()
			.name('f').version('1.0.0').title('F')
			.fields({ n: { type: 'number', label: 'N' }, a: { type: 'text', label: 'A', visible: 'fields.n' } as never })
			.build()
		expect(validateLogic(f as never).issues).toEqual([
			expect.objectContaining({ path: ['fields', 'a', 'visible'], expectedType: 'boolean', actualType: 'number' }),
		])
	})

	test('a dependency cycle is an error that fails validate(), and issues carry no severity', () => {
		const f = form()
			.name('f').version('1.0.0').title('F')
			.fields({ a: { type: 'boolean', label: 'A' } })
			.def('x', 'y')
			.def('y', 'x')
			.build()
		const logic = validateLogic(f as never)
		expect(logic.issues?.map((i) => i.message)).toEqual([
			'Circular dependency detected: defs key "x" is involved in a dependency cycle',
			'Circular dependency detected: defs key "y" is involved in a dependency cycle',
		])
		expect(logic.issues?.every((i) => !('severity' in i))).toBe(true)
		expect(validate(f.toJSON()).issues).toHaveLength(2)
	})

	test('definitions without a cycle pass', () => {
		const f = form()
			.name('f').version('1.0.0').title('F')
			.fields({ a: { type: 'boolean', label: 'A' } })
			.def('x', 'fields.a')
			.def('y', 'x')
			.build()
		expect(validateLogic(f as never).issues).toBeUndefined()
	})
})
