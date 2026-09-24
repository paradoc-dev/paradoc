/**
 * schemas-007: multiselect default is not checked against its options; duplicate option values pass.
 * Input: { type:'multiselect', enum:[{value:'a'},{value:'b'}], default:['zzz'] }
 *        { type:'multiselect', enum:[{value:'a'},{value:'a'}] }, { type:'enum', enum:[{value:'a'},{value:'a'}] }
 * Expected: all three rejected.
 * Actual: all three accepted.
 */
import { describe, expect, it } from 'vitest'
import { FormFieldSchema } from '../src/zod'

describe('schemas-007', () => {
	it('rejects a multiselect default outside its options', () => {
		const r = FormFieldSchema.safeParse({ type: 'multiselect', enum: [{ value: 'a' }, { value: 'b' }], default: ['zzz'] })
		expect(r.success).toBe(false)
	})

	it('rejects duplicate option values', () => {
		expect(FormFieldSchema.safeParse({ type: 'multiselect', enum: [{ value: 'a' }, { value: 'a' }] }).success).toBe(false)
		expect(FormFieldSchema.safeParse({ type: 'enum', enum: [{ value: 'a' }, { value: 'a' }] }).success).toBe(false)
	})

	it('accepts a valid multiselect default', () => {
		expect(FormFieldSchema.safeParse({ type: 'multiselect', enum: [{ value: 'a' }, { value: 'b' }], default: ['b'] }).success).toBe(true)
	})
})
