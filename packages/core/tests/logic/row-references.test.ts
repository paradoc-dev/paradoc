import { describe, test, expect } from 'vitest'
import { checkBooleanGate, createTypeEnv, T } from '@paradoc/expr'
import type { Bundle, Form, FormField } from '@paradoc/types'
import { form } from '@/artifacts'
import { validateFormDefs } from '@/logic/design-time/validation/validate-form-logic'
import { validateBundleDefs } from '@/logic/design-time/validation/validate-bundle-logic'
import { withRowScopeTypes } from '@/logic/design-time/type-checking'
import { evaluateFormDefs } from '@/logic/runtime/evaluation/form-evaluator'

// ============================================================================
// Fixtures
// ============================================================================

/** Expense lines whose explanation is required only for rows of type "other". */
const expenseLines = (): Form => ({
	kind: 'form',
	name: 'expenses',
	version: '1.0.0',
	title: 'Expenses',
	fields: {
		lines: {
			type: 'list',
			item: {
				type: 'fieldset',
				fields: {
					kind: { type: 'enum', enum: [{ value: 'travel' }, { value: 'other' }], required: true },
					amount: { type: 'number' },
					explanation: {
						type: 'text',
						visible: "item.kind == 'other'",
						required: "item.kind == 'other'",
					},
				},
			},
		},
	},
})

/** Line items with nested parts; a part's note is required when its line is flagged. */
const nestedParts = (): Form => ({
	kind: 'form',
	name: 'orders',
	version: '1.0.0',
	title: 'Orders',
	fields: {
		lines: {
			type: 'list',
			item: {
				type: 'fieldset',
				fields: {
					flagged: { type: 'boolean' },
					parts: {
						type: 'list',
						item: {
							type: 'fieldset',
							fields: {
								cost: { type: 'number' },
								note: { type: 'text', required: 'parent.flagged and item.cost > 100' },
							},
						},
					},
				},
			},
		},
	},
})

const withFields = (fields: Record<string, FormField>, extra: Partial<Form> = {}): Form => ({
	kind: 'form',
	name: 'row-refs',
	version: '1.0.0',
	title: 'Row references',
	fields,
	...extra,
})

const messages = (result: ReturnType<typeof validateFormDefs>): string[] =>
	(result.issues ?? []).map((issue) => issue.message)

// ============================================================================
// Direct checking with and without a row context
// ============================================================================

describe('row references in the type environment', () => {
	const formEnv = createTypeEnv({ 'fields.limit': T.number })
	const row: FormField = { type: 'fieldset', fields: { cost: { type: 'number' }, label: { type: 'text' } } }

	test('item members resolve with their field types inside a row', () => {
		const env = withRowScopeTypes(formEnv, { item: row })
		expect(checkBooleanGate('item.cost > fields.limit', env).diagnostics).toEqual([])
		const mismatch = checkBooleanGate('item.label > 3', env)
		expect(mismatch.diagnostics.map((d) => d.code)).toContain('type-mismatch')
	})

	test('item and parent do not resolve without a row context', () => {
		expect(checkBooleanGate('item.cost > 1', formEnv).diagnostics.map((d) => d.code)).toEqual(['unknown-identifier'])
		const env = withRowScopeTypes(formEnv, { item: row })
		expect(checkBooleanGate('parent.cost > 1', env).diagnostics.map((d) => d.code)).toEqual(['unknown-identifier'])
	})

	test('an enclosing row never leaks its members into a nested row', () => {
		const outer = withRowScopeTypes(formEnv, { item: row })
		const inner = withRowScopeTypes(outer, { item: { type: 'fieldset', fields: { qty: { type: 'number' } } }, parent: row })
		expect(checkBooleanGate('item.cost > 1', inner).diagnostics.map((d) => d.code)).toEqual(['unknown-identifier'])
		expect(checkBooleanGate('item.qty > parent.cost', inner).diagnostics).toEqual([])
	})

	test('a scalar row exposes its value and composite members', () => {
		const env = withRowScopeTypes(formEnv, { item: { type: 'money' } })
		expect(checkBooleanGate('item.amount > 0', env).diagnostics).toEqual([])
		expect(checkBooleanGate("item.currency == 'USD'", env).diagnostics).toEqual([])
	})
})

// ============================================================================
// Authoring validation
// ============================================================================

describe('authoring validation of row references', () => {
	test('accepts item in list-item conditions and parent in a nested list', () => {
		expect(validateFormDefs(expenseLines()).issues).toBeUndefined()
		expect(validateFormDefs(nestedParts()).issues).toBeUndefined()
	})

	test('rejects item outside a list item with an actionable message', () => {
		const result = validateFormDefs(withFields({
			kind: { type: 'text' },
			note: { type: 'text', visible: "item.kind == 'other'" },
		}))
		expect(result.issues?.[0]).toMatchObject({
			path: ['fields', 'note', 'visible'],
			variable: 'item.kind',
		})
		expect(result.issues?.[0]?.message).toContain('"item" refers to the current list row')
	})

	test('rejects the list field itself using item, since no row encloses it', () => {
		const result = validateFormDefs(withFields({
			lines: {
				type: 'list',
				visible: 'item.amount > 0',
				item: { type: 'fieldset', fields: { amount: { type: 'number' } } },
			},
		}))
		expect(messages(result)[0]).toContain('"item" refers to the current list row')
	})

	test('rejects parent in a list that is not nested in another list item', () => {
		const result = validateFormDefs(withFields({
			lines: {
				type: 'list',
				item: {
					type: 'fieldset',
					fields: {
						amount: { type: 'number' },
						note: { type: 'text', required: 'parent.amount > 0' },
					},
				},
			},
		}))
		expect(result.issues?.[0]?.path).toEqual(['fields', 'lines', 'item', 'fields', 'note', 'required'])
		expect(messages(result)[0]).toContain('this list is not nested inside another list item')
	})

	test('rejects item and parent in rules, definitions, and annexes', () => {
		const result = validateFormDefs(withFields(
			{ lines: { type: 'list', item: { type: 'fieldset', fields: { amount: { type: 'number' } } } } },
			{
				defs: { big: { type: 'boolean', value: 'item.amount > 10' } },
				rules: { positive: { expr: 'parent.amount > 0', message: 'Positive' } },
				annexes: { receipt: { title: 'Receipt', visible: 'item.amount > 0' } },
			} as Partial<Form>,
		))
		const at = (path: string) => (result.issues ?? []).filter((issue) => (issue.path ?? []).join('.') === path).map((issue) => issue.message)
		expect(at('defs.big.value')).toContainEqual(expect.stringContaining('"item" refers to the current list row'))
		expect(at('rules.positive.expr')).toContainEqual(expect.stringContaining('"parent" refers to the enclosing row'))
		expect(at('annexes.receipt.visible')).toContainEqual(expect.stringContaining('"item" refers to the current list row'))
	})

	test('rejects unknown row members as unknown variables', () => {
		const result = validateFormDefs(withFields({
			lines: {
				type: 'list',
				item: { type: 'fieldset', fields: { amount: { type: 'number' }, note: { type: 'text', visible: 'item.missing' } } },
			},
		}))
		expect(messages(result)).toContain('Unknown variable: "item.missing"')
	})

	test('does not let a nested row see the enclosing row as item', () => {
		const form = nestedParts()
		const parts = (form.fields!.lines as { item: { fields: Record<string, FormField> } }).item.fields.parts as {
			item: { fields: Record<string, FormField> }
		}
		parts.item.fields.note = { type: 'text', required: 'item.flagged' }
		expect(messages(validateFormDefs(form))).toContain('Unknown variable: "item.flagged"')
	})

	test('type-checks row members against their field types', () => {
		const result = validateFormDefs(withFields({
			lines: {
				type: 'list',
				item: { type: 'fieldset', fields: { amount: { type: 'number' }, note: { type: 'text', visible: "item.amount == 'x' and item.amount > 'y'" } } },
			},
		}))
		expect(result.issues).toContainEqual(expect.objectContaining({
			message: expect.stringMatching(/^Cannot compare number and string/),
		}))
	})

	test('rejects computed values named item or parent', () => {
		const result = validateFormDefs(withFields(
			{ amount: { type: 'number' } },
			{
				defs: {
					item: { type: 'boolean', value: 'fields.amount > 0' },
					parent: { type: 'number', value: 'fields.amount' },
				},
			} as Partial<Form>,
		))
		expect(result.issues).toEqual(expect.arrayContaining([
			expect.objectContaining({ path: ['defs', 'item'], message: expect.stringContaining('"item" is reserved for list row references') }),
			expect.objectContaining({ path: ['defs', 'parent'], message: expect.stringContaining('"parent" is reserved for list row references') }),
		]))
	})

	test('rejects a bundle computed value named item', () => {
		const bundle = {
			kind: 'bundle',
			name: 'b',
			version: '1.0.0',
			title: 'B',
			defs: { item: { type: 'boolean', value: 'true' } },
			contents: [],
		} as unknown as Bundle
		expect(validateBundleDefs(bundle).issues?.[0]).toMatchObject({ path: ['defs', 'item'] })
	})
})

// ============================================================================
// Runtime evaluation
// ============================================================================

describe('evaluating row references', () => {
	const evaluate = (definition: Form, fields: Record<string, unknown>) => {
		const result = evaluateFormDefs(definition, { fields })
		if (!('value' in result)) throw new Error('evaluation failed')
		expect(result.value.issues).toEqual([])
		return result.value.fields
	}

	test('item refers to each row, and follows rows as they are inserted, removed, and reordered', () => {
		const travel = { kind: 'travel', amount: 10 }
		const other = { kind: 'other', amount: 20 }

		let state = evaluate(expenseLines(), { lines: [travel, other] })
		expect(state.get('lines[0].explanation')).toMatchObject({ visible: false, required: false })
		expect(state.get('lines[1].explanation')).toMatchObject({ visible: true, required: true })

		state = evaluate(expenseLines(), { lines: [other, travel] })
		expect(state.get('lines[0].explanation')?.required).toBe(true)
		expect(state.get('lines[1].explanation')?.required).toBe(false)

		state = evaluate(expenseLines(), { lines: [travel, other, travel] })
		expect(state.get('lines[1].explanation')?.required).toBe(true)
		expect(state.get('lines[2].explanation')?.required).toBe(false)

		state = evaluate(expenseLines(), { lines: [travel] })
		expect(state.get('lines[0].explanation')?.required).toBe(false)
		expect(state.has('lines[1].explanation')).toBe(false)
	})

	test('item gates the row itself', () => {
		const definition = withFields({
			amounts: { type: 'list', item: { type: 'number', required: 'item > 0' } },
		})
		const state = evaluate(definition, { amounts: [5, 0] })
		expect(state.get('amounts[0]')?.required).toBe(true)
		expect(state.get('amounts[1]')?.required).toBe(false)
	})

	test('parent refers to the enclosing row of a nested list', () => {
		const state = evaluate(nestedParts(), {
			lines: [
				{ flagged: true, parts: [{ cost: 150 }, { cost: 50 }] },
				{ flagged: false, parts: [{ cost: 500 }] },
			],
		})
		expect(state.get('lines[0].parts[0].note')?.required).toBe(true)
		expect(state.get('lines[0].parts[1].note')?.required).toBe(false)
		expect(state.get('lines[1].parts[0].note')?.required).toBe(false)
	})

	test('a failing row condition marks the snapshot unresolved rather than hiding the row', () => {
		const definition = withFields({
			lines: {
				type: 'list',
				item: { type: 'fieldset', fields: { amount: { type: 'number' }, note: { type: 'text', visible: 'item.amount / 0 > 1' } } },
			},
		})
		const result = evaluateFormDefs(definition, { fields: { lines: [{ amount: 1 }] } })
		if (!('value' in result)) throw new Error('evaluation failed')
		expect(result.value.resolved).toBe(false)
		expect(result.value.issues[0]?.path).toEqual(['lines[0]', 'note', 'visible'])
		expect(result.value.fields.get('lines[0].note')?.visible).toBe(true)
	})
})

// ============================================================================
// Progressive fill state
// ============================================================================

describe('fill state with row references', () => {
	test('adding a row that requires an explanation makes that explanation the next target', () => {
		const expenses = form(expenseLines())

		const before = expenses.fill({ fields: { lines: [{ kind: 'travel', amount: 10 }] } } as never).getFillState()
		expect(before.next).toBeNull()

		const after = expenses.fill({
			fields: { lines: [{ kind: 'travel', amount: 10 }, { kind: 'other', amount: 20 }] },
		} as never).getFillState()
		expect(after.next).toMatchObject({ kind: 'field', key: 'lines[1].explanation', required: true })
		expect(after.openRequired.map((item) => item.key)).toEqual(['lines[1].explanation'])
	})

	test('a nested row requirement driven by parent reaches the fill state', () => {
		const orders = form(nestedParts())
		const state = orders.fill({
			fields: { lines: [{ flagged: true, parts: [{ cost: 50 }, { cost: 200 }] }] },
		} as never).getFillState()
		expect(state.next?.key).toBe('lines[0].parts[1].note')
	})
})
