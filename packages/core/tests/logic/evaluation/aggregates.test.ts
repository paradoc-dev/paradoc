/**
 * List aggregates inside a form: computed values, rules, hidden rows,
 * definition ordering, authoring validation, and progressive fill state.
 */

import { describe, expect, it } from 'vitest'
import type { Form, FormField } from '@paradoc/types'
import { buildRegistry, T, Values } from '@paradoc/expr'
import { form } from '@/artifacts'
import { evaluateFormDefs } from '@/logic/runtime/evaluation/form-evaluator'
import { evaluateFormRules } from '@/logic/runtime/evaluation/rule-evaluator'
import { buildFormContext } from '@/logic/runtime/evaluation/context-builder'
import { validateFormDefs } from '@/logic/design-time/validation/validate-form-logic'
import { buildFieldDependencyGraph } from '@/fill-state/dependency-graph'

const lineItem: FormField = {
	type: 'fieldset',
	fields: {
		description: { type: 'text' },
		qty: { type: 'number' },
		amount: { type: 'money' },
		taxable: { type: 'boolean' },
		parts: {
			type: 'list',
			visible: 'fields.showParts',
			item: { type: 'fieldset', fields: { cost: { type: 'number' } } },
		},
	},
}

function invoiceForm(overrides: Partial<Form> = {}): Form {
	return {
		kind: 'form',
		name: 'invoice',
		version: '1.0.0',
		title: 'Invoice',
		fields: {
			itemized: { type: 'boolean' },
			showParts: { type: 'boolean' },
			currency: { type: 'text' },
			items: { type: 'list', visible: 'showItems', item: lineItem },
		},
		defs: {
			// Declared before the definition its rows' visibility reads, so only
			// dependency ordering can evaluate it correctly.
			subtotal: { type: 'money', value: { amount: 'sum(fields.items.amount).amount', currency: 'fields.currency' } },
			taxableSubtotal: { type: 'number', value: 'sum(fields.items.amount.amount, fields.items.taxable)' },
			partsCost: { type: 'number', value: 'sum(fields.items.parts.cost)' },
			rushParts: { type: 'number', value: 'count(fields.items.parts, fields.items.taxable)' },
			showItems: { type: 'boolean', value: 'fields.itemized' },
		},
		...overrides,
	}
}

const usd = (amount: number) => ({ amount, currency: 'USD' })

const rows = [
	{ description: 'Design', qty: 2, amount: usd(1200.1), taxable: true, parts: [{ cost: 3 }, { cost: 4 }] },
	{ description: 'Hosting', qty: 1, amount: usd(99.9), taxable: false, parts: [{ cost: 5 }] },
]

function defs(f: Form, fields: Record<string, unknown>) {
	const result = evaluateFormDefs(f, { fields })
	if (!('value' in result) || !result.value) throw new Error('evaluation failed')
	expect(result.value.issues).toEqual([])
	return result.value.defsValues
}

describe('aggregates in computed values', () => {
	it('derive totals, filtered totals, and nested totals from the rows', () => {
		const values = defs(invoiceForm(), { itemized: true, showParts: true, currency: 'USD', items: rows })
		expect(values.get('subtotal')).toEqual({ amount: 1300, currency: 'USD' })
		expect(values.get('taxableSubtotal')).toBe(1200.1)
		expect(values.get('partsCost')).toBe(12)
		expect(values.get('rushParts')).toBe(2)
	})

	it('follow the rows as they are added and removed', () => {
		const f = invoiceForm()
		const base = { itemized: true, showParts: true, currency: 'USD' }
		expect(defs(f, { ...base, items: rows.slice(0, 1) }).get('taxableSubtotal')).toBe(1200.1)
		expect(defs(f, { ...base, items: [...rows, { amount: usd(10), taxable: true }] }).get('taxableSubtotal')).toBe(1210.1)
		expect(defs(f, { ...base, items: [] }).get('taxableSubtotal')).toBe(0)
	})

	it('skip hidden rows, and count them again once shown', () => {
		const f = invoiceForm()
		const hidden = defs(f, { itemized: false, showParts: true, currency: 'USD', items: rows })
		expect(hidden.get('taxableSubtotal')).toBe(0)
		expect(hidden.get('partsCost')).toBe(0)
		expect(defs(f, { itemized: true, showParts: false, currency: 'USD', items: rows }).get('partsCost')).toBe(0)
		expect(defs(f, { itemized: true, showParts: true, currency: 'USD', items: rows }).get('partsCost')).toBe(12)
	})

	it('skip rows hidden by the item condition', () => {
		const f = invoiceForm({
			fields: {
				itemized: { type: 'boolean' },
				showParts: { type: 'boolean' },
				currency: { type: 'text' },
				items: { type: 'list', item: { ...lineItem, visible: 'fields.itemized' } },
			},
		})
		expect(defs(f, { itemized: false, currency: 'USD', items: rows }).get('taxableSubtotal')).toBe(0)
		expect(defs(f, { itemized: true, currency: 'USD', items: rows }).get('taxableSubtotal')).toBe(1200.1)
	})

	it('fail a mixed-currency total, naming both currencies', () => {
		const result = evaluateFormDefs(invoiceForm(), {
			fields: { itemized: true, currency: 'USD', items: [{ amount: usd(1) }, { amount: { amount: 2, currency: 'EUR' } }] },
		})
		expect('value' in result && result.value.issues[0]?.message).toMatch(/currency-mismatch: sum found more than one currency: EUR, USD/)
	})
})

describe('aggregates with row references', () => {
	const rowForm = (): Form => ({
		kind: 'form',
		name: 'orders',
		version: '1.0.0',
		title: 'Orders',
		fields: {
			items: {
				type: 'list',
				item: {
					type: 'fieldset',
					visible: 'item.qty > 0',
					fields: {
						qty: { type: 'number' },
						parts: {
							type: 'list',
							item: { type: 'fieldset', visible: 'not item.spare', fields: { cost: { type: 'number' }, spare: { type: 'boolean' } } },
						},
						review: { type: 'text', required: 'sum(item.parts.cost) > 10' },
					},
				},
			},
		},
		defs: {
			totalQty: { type: 'number', value: 'sum(fields.items.qty)' },
			partsCost: { type: 'number', value: 'sum(fields.items.parts.cost)' },
		},
	})

	const items = [
		{ qty: 2, parts: [{ cost: 8, spare: false }, { cost: 9, spare: true }] },
		{ qty: 0, parts: [{ cost: 50, spare: false }] },
		{ qty: 1, parts: [{ cost: 6, spare: false }, { cost: 7, spare: false }] },
	]

	function evaluate(data: unknown[]) {
		const result = evaluateFormDefs(rowForm(), { fields: { items: data } })
		if (!('value' in result) || !result.value) throw new Error('evaluation failed')
		expect(result.value.issues).toEqual([])
		return result.value
	}

	it('skip rows whose own item condition hides them', () => {
		const state = evaluate(items)
		expect(state.defsValues.get('totalQty')).toBe(3)
		expect(state.defsValues.get('partsCost')).toBe(21)
	})

	it('skip hidden rows of a list inside the current row', () => {
		const state = evaluate(items)
		// Row 0 counts only its non-spare part (8); row 2 counts both (13).
		expect(state.fields.get('items[0].review')?.required).toBe(false)
		expect(state.fields.get('items[2].review')?.required).toBe(true)
	})

	it('accept an aggregate over the current row at authoring time', () => {
		expect(validateFormDefs(rowForm())).toEqual({ value: rowForm() })
	})
})

describe('aggregates in rules and conditions', () => {
	const ruled = invoiceForm({
		rules: {
			positiveQuantities: { expr: 'count(fields.items, fields.items.qty <= 0) == 0', message: 'Every row needs a positive quantity' },
			someTaxable: { expr: 'any(items.taxable)', message: 'At least one row must be taxable' },
		},
	})

	function ruleErrors(items: unknown[], itemized = true): string[] {
		const fields = { itemized, currency: 'USD', items }
		const context = buildFormContext(ruled, { fields })
		const state = evaluateFormDefs(ruled, { fields })
		if (!('value' in state) || !state.value) throw new Error('evaluation failed')
		return evaluateFormRules(ruled, fields, state.value.defsValues, context).errors.map((e) => e.ruleId)
	}

	it('pass when every row satisfies them', () => {
		expect(ruleErrors(rows)).toEqual([])
	})

	it('fail on the offending rows', () => {
		expect(ruleErrors([{ qty: 0, taxable: false }])).toEqual(['positiveQuantities', 'someTaxable'])
	})

	it('ignore hidden rows', () => {
		expect(ruleErrors([{ qty: 0, taxable: true }], false)).toEqual(['someTaxable'])
	})

	it('drive a field condition from the rows', () => {
		const f = invoiceForm({
			fields: { ...invoiceForm().fields, approver: { type: 'text', visible: 'sum(fields.items.qty) > 2' } },
		})
		const visible = (items: unknown[]) => {
			const result = evaluateFormDefs(f, { fields: { itemized: true, currency: 'USD', items } })
			if (!('value' in result) || !result.value) throw new Error('evaluation failed')
			return result.value.fields.get('approver')?.visible
		}
		expect(visible(rows)).toBe(true)
		expect(visible(rows.slice(1))).toBe(false)
	})

	it('resolve a row condition that aggregates its own rows without recursing', () => {
		let probes = 0
		const f = invoiceForm({
			fields: {
				currency: { type: 'text' },
				items: { type: 'list', visible: 'probe() and sum(fields.items.qty) > 0', item: lineItem },
			},
			defs: undefined,
		})
		const probe = { name: 'probe', category: 'domain', params: [], returns: { kind: 'fixed', type: T.boolean }, deterministic: true } as const
		const result = evaluateFormDefs(f, {
			fields: { items: rows },
			expressionFunctions: { probe: () => { probes++; return Values.boolean(true) } },
			expressionRegistry: buildRegistry([probe]),
		})
		expect('value' in result && result.value?.fields.get('items')?.visible).toBe(true)
		expect(probes).toBeLessThan(10)
	})
})

describe('authoring validation', () => {
	const withDef = (value: string, type: 'number' | 'boolean' = 'number'): Form =>
		invoiceForm({ defs: { showItems: { type: 'boolean', value: 'true' }, probe: { type, value } } })

	const messages = (f: Form) => {
		const result = validateFormDefs(f)
		return 'issues' in result && result.issues ? result.issues.map((issue) => issue.message) : []
	}

	it('accepts aggregates over list rows', () => {
		expect(messages(invoiceForm())).toEqual([])
		expect(messages(withDef('count(fields.items, fields.items.description == "Design") > 0', 'boolean'))).toEqual([])
	})

	it('rejects an aggregate over an incompatible type', () => {
		expect(messages(withDef('sum(fields.items.description)'))).toContain('sum needs number or money values; fields.items.description is string')
	})

	it('rejects a non-boolean filter', () => {
		expect(messages(withDef('sum(fields.items.qty, fields.items.qty)'))).toContain('The sum filter must be boolean, got number')
	})

	it('rejects an aggregate over a path that is not a list', () => {
		expect(messages(withDef('count(fields.currency)'))).toContain('count needs a path into a list field; fields.currency is string')
	})

	it('rejects a filter on a different list', () => {
		const f = invoiceForm({
			fields: { ...invoiceForm().fields, notes: { type: 'list', item: { type: 'fieldset', fields: { urgent: { type: 'boolean' } } } } },
			defs: { showItems: { type: 'boolean', value: 'true' }, probe: { type: 'number', value: 'sum(fields.items.qty, fields.notes.urgent)' } },
		})
		expect(messages(f)).toContain('The filter reads fields.notes.urgent from fields.notes, a different list than fields.items')
	})

	it('rejects a row value read outside an aggregate', () => {
		const f = invoiceForm({ fields: { ...invoiceForm().fields, approver: { type: 'text', visible: 'fields.items.qty > 2' } } })
		expect(messages(f)).toContain(
			'fields.items.qty reads a value from every row of fields.items; use it inside an aggregate such as sum(fields.items.qty) or count(fields.items)',
		)
	})

	it('reports a definition whose rows are hidden by that same definition as circular', () => {
		const f = invoiceForm({
			fields: { ...invoiceForm().fields, items: { type: 'list', visible: 'subtotal.amount < 1000', item: lineItem } },
		})
		expect(messages(f)).toContain('Circular dependency detected: defs key "subtotal" is involved in a dependency cycle')
	})
})

describe('fill state', () => {
	const f = form()
		.name('approval')
		.fields({
			items: { type: 'list', item: { type: 'fieldset', fields: { amount: { type: 'number' } } } },
			approver: { type: 'text', required: true, visible: 'sum(fields.items.amount) > 1000' },
		})
		.defs({ total: { type: 'number', value: 'sum(fields.items.amount)' } })
		.build()

	it('names the list as the prerequisite of a condition over its rows', () => {
		expect(buildFieldDependencyGraph(f.toJSON() as Form).dependsOn.get('approver')?.has('items')).toBe(true)
		const state = f.fill().getFillState()
		expect(state.blocked.find((item) => item.key === 'approver')?.blockedBy).toEqual(['items'])
	})

	it('updates derived totals and next targets as rows land', () => {
		const small = f.fill({ fields: { items: [{ amount: 400 }] } } as never).getFillState()
		expect(small.defsValues.total).toBe(400)
		expect(small.next).toBeNull()

		const large = f.fill({ fields: { items: [{ amount: 400 }, { amount: 700 }] } } as never).getFillState()
		expect(large.defsValues.total).toBe(1100)
		expect(large.next?.key).toBe('approver')
	})
})
