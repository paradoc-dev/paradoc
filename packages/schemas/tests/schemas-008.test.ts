/**
 * schemas-008: defs expressions and checklist status specs silently drop unknown keys.
 * Input: defs { d:{ type:'boolean', value:'true', lable:'typo' } };
 *        checklist item { id:'a', title:'A', status:{ kind:'boolean', defualt:true } }.
 * Expected: rejected (unrecognized key), like fields and artifact roots.
 * Actual: parse succeeds and the typo key is stripped.
 */
import { describe, expect, it } from 'vitest'
import { ChecklistItemSchema, DefsSectionSchema } from '../src/zod'

describe('schemas-008', () => {
	it('rejects an unknown key in a defs expression', () => {
		expect(DefsSectionSchema.safeParse({ d: { type: 'boolean', value: 'true', lable: 'typo' } }).success).toBe(false)
	})

	it('rejects an unknown key in a checklist status spec', () => {
		expect(ChecklistItemSchema.safeParse({ id: 'a', title: 'A', status: { kind: 'boolean', defualt: true } }).success).toBe(false)
	})

	it('accepts known keys in defs expressions and status specs', () => {
		expect(DefsSectionSchema.safeParse({ d: { type: 'money', label: 'Total', value: { amount: '1', currency: '"USD"' } } }).success).toBe(true)
		expect(DefsSectionSchema.safeParse({ d: { type: 'money', value: { amount: '1', currency: '"USD"', cents: '1' } } }).success).toBe(false)
		expect(ChecklistItemSchema.safeParse({ id: 'a', title: 'A', status: { kind: 'boolean', default: true } }).success).toBe(true)
	})
})
