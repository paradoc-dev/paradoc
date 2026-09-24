/**
 * Rules, gates, and aggregates evaluate against the full form context: the
 * clock, host functions, registry, row visibility, and signing state.
 *
 * Regressions for audit findings core-031, core-032, core-033, core-034,
 * core-039, core-048, and core-050.
 */
import { describe, expect, test } from 'vitest'
import { buildRegistry, T, Values } from '@paradoc/expr'
import type { Attestation, Form, SignatureCapture, ValidationRule } from '@paradoc/types'
import { form } from '@/artifacts'
import { buildFormContext } from '@/logic/runtime/evaluation/context-builder'
import { evaluateExpression } from '@/logic/runtime/evaluation/expression-evaluator'
import { evaluateFormDefs } from '@/logic/runtime/evaluation/form-evaluator'
import { evaluateFormRules, evaluateRule } from '@/logic/runtime/evaluation/rule-evaluator'
import { signingStateOf } from '@/logic/runtime/evaluation/signing-state'
import { validateFormDefs } from '@/logic/design-time/validation/validate-form-logic'

const issueMessages = (f: Form): string[] => {
	const result = validateFormDefs(f)
	return 'issues' in result && result.issues ? result.issues.map((issue) => issue.message) : []
}

describe('rule context (core-031)', () => {
	test('a rule can call today() when the form carries a clock', () => {
		const def = form({
			kind: 'form',
			name: 'clock-rule',
			fields: { startDate: { type: 'date' } },
			rules: { notPast: { expr: 'fields.startDate >= today()', message: 'Start date is in the past' } },
		} as any)
		const context = { context: { asOf: '2026-09-12T12:00:00Z' } }
		const future = def.fill({ fields: { startDate: '2026-10-01' } } as any, context).validateRules()
		const past = def.fill({ fields: { startDate: '2026-09-01' } } as any, context).validateRules()
		expect(future.rules[0]).toEqual({ ruleId: 'notPast', passed: true, severity: 'error' })
		expect(past.rules[0]).toEqual({ ruleId: 'notPast', passed: false, message: 'Start date is in the past', severity: 'error' })
	})

	test('a rule can call a configured host function', () => {
		const f = {
			kind: 'form',
			name: 'fn-rule',
			fields: { amount: { type: 'number' } },
			rules: { approved: { expr: 'probe()', message: 'Not approved' } },
		} as unknown as Form
		const probe = { name: 'probe', category: 'domain', params: [], returns: { kind: 'fixed', type: T.boolean }, deterministic: true } as const
		const run = (approved: boolean) => {
			const data = {
				fields: { amount: 1 },
				expressionFunctions: { probe: () => Values.boolean(approved) },
				expressionRegistry: buildRegistry([probe]),
			}
			return evaluateFormRules(f, data.fields, new Map(), buildFormContext(f, data)).rules[0]
		}
		expect(run(true)).toEqual({ ruleId: 'approved', passed: true, severity: 'error' })
		expect(run(false)).toEqual({ ruleId: 'approved', passed: false, message: 'Not approved', severity: 'error' })
	})

	test('a rule reads a field by its bare id and through fields', () => {
		const f = {
			kind: 'form',
			name: 'flat-rule',
			fields: { age: { type: 'number' } },
			rules: { adult: { expr: 'age >= 18 and fields.age >= 18', message: 'Must be an adult' } },
		} as unknown as Form
		const run = (age: number) => evaluateFormRules(f, { age }, new Map(), buildFormContext(f, { fields: { age } })).valid
		expect(run(20)).toBe(true)
		expect(run(10)).toBe(false)
	})
})

describe('row visibility in aggregates (core-032)', () => {
	const lines = {
		kind: 'form',
		name: 'lines',
		version: '1.0.0',
		title: 'Lines',
		fields: {
			lines: {
				type: 'list',
				item: {
					type: 'fieldset',
					visible: 'item.quantity * item.unitPrice > 0',
					fields: { quantity: { type: 'number' }, unitPrice: { type: 'number' }, amount: { type: 'number' } },
				},
			},
		},
		defs: { total: { type: 'number', value: 'sum(fields.lines.amount)' } },
	} as unknown as Form

	test('a row hidden by missing input is not counted by sum()', () => {
		const result = evaluateFormDefs(lines, { fields: { lines: [{ amount: 50 }, { quantity: 1, unitPrice: 2, amount: 7 }] } })
		if (!('value' in result) || !result.value) throw new Error('evaluation failed')
		expect(result.value.fields.get('lines[0]')?.visible).toBe(false)
		expect(result.value.fields.get('lines[1]')?.visible).toBe(true)
		expect(result.value.defsValues.get('total')).toBe(7)
	})

	test('a row whose condition fails with its inputs present still counts', () => {
		const failing = {
			...lines,
			fields: {
				lines: {
					type: 'list',
					item: {
						type: 'fieldset',
						visible: 'item.quantity / item.unitPrice > 0',
						fields: { quantity: { type: 'number' }, unitPrice: { type: 'number' }, amount: { type: 'number' } },
					},
				},
			},
		} as unknown as Form
		const result = evaluateFormDefs(failing, { fields: { lines: [{ quantity: 1, unitPrice: 0, amount: 5 }] } })
		if (!('value' in result) || !result.value) throw new Error('evaluation failed')
		expect(result.value.defsValues.get('total')).toBe(5)
	})
})

describe('defs cannot replace context roots or settings (core-034)', () => {
	test('a def named asOf does not replace the clock', () => {
		const f = {
			kind: 'form',
			name: 'asof-shadow',
			version: '1.0.0',
			title: 'Shadow',
			fields: { signedOn: { type: 'date' } },
			defs: {
				asOf: { type: 'date', value: 'fields.signedOn' },
				stamp: { type: 'date', value: 'today()' },
			},
		} as unknown as Form
		const draft = form(f as any).fill({ fields: { signedOn: '2020-01-01' } } as any, {
			context: { asOf: '2026-09-12T12:00:00Z' },
		})
		expect(draft.getLogicValue('stamp')).toBe('2026-09-12')
		expect(draft.getLogicValue('asOf')).toBe('2020-01-01')
	})

	test.each(['fields', 'parties', 'item', 'parent'])('a def named %s fails validation', (name) => {
		const f = {
			kind: 'form',
			name: 'root-shadow',
			version: '1.0.0',
			title: 'Shadow',
			fields: { age: { type: 'number' } },
			defs: { [name]: { type: 'string', value: '"x"' } },
		} as unknown as Form
		expect(issueMessages(f)).toContainEqual(expect.stringContaining(`"${name}" is reserved`))
	})

	test('a def with an ordinary name passes validation', () => {
		const f = {
			kind: 'form',
			name: 'no-shadow',
			version: '1.0.0',
			title: 'Shadow',
			fields: { age: { type: 'number' } },
			defs: { label: { type: 'string', value: '"x"' } },
		} as unknown as Form
		expect(issueMessages(f)).toEqual([])
	})
})

describe('one gate evaluator (core-039)', () => {
	const rule: ValidationRule = { expr: 'fields.tags', message: 'tags must be non-empty' }

	test('a rule treats an empty list as false, as truthy() does', () => {
		expect(evaluateRule('tags', rule, { fields: { tags: [] } }).passed).toBe(false)
	})

	test('a rule treats a non-empty list as true', () => {
		expect(evaluateRule('tags', rule, { fields: { tags: ['a'] } }).passed).toBe(true)
	})
})

describe('unconvertible values (core-050)', () => {
	test('a NaN field value fails evaluation instead of reading as null', () => {
		const product = evaluateExpression('fields.amount * 2', { fields: { amount: Number.NaN } })
		const isNull = evaluateExpression('fields.amount == null', { fields: { amount: Number.NaN } })
		expect(product).toMatchObject({ success: false, code: 'type-error', error: expect.stringContaining('fields.amount') })
		expect(isNull).toMatchObject({ success: false, code: 'type-error' })
	})

	test('one bad list item fails the read instead of emptying the list', () => {
		const result = evaluateExpression('count(fields.rows)', { fields: { rows: [1, 2, Number.POSITIVE_INFINITY] } })
		expect(result).toMatchObject({ success: false, code: 'type-error', error: expect.stringContaining('fields.rows[2]') })
	})

	test('finite values still convert', () => {
		expect(evaluateExpression('count(fields.rows)', { fields: { rows: [1, 2, 3] } })).toEqual({ success: true, value: 3 })
	})
})

describe('signing predicates (core-033, core-048)', () => {
	const signingForm = {
		kind: 'form',
		name: 'signing',
		fields: {},
		parties: {
			buyer: { label: 'Buyer', max: 2 },
			seller: { label: 'Seller' },
		},
	} as unknown as Form
	const parties = {
		buyer: [
			{ id: 'buyer-0', name: 'Ann Buyer' },
			{ id: 'buyer-1', name: 'Bo Buyer' },
		],
		seller: { id: 'seller-0', name: 'Acme Inc', legalName: 'Acme Inc' },
	}
	const witnesses = [
		{ id: 'w1', party: { name: 'Wendy Witness' } },
		{ id: 'w2', party: { name: 'Walt Witness' } },
	]
	const capture = (role: string, partyId: string, type: SignatureCapture['type'] = 'signature'): SignatureCapture => ({
		role, partyId, signerId: `${partyId}-signer`, locationId: `${partyId}-${type}`, type, timestamp: '2026-09-12T00:00:00Z',
	})
	const attestation = (witnessId: string): Attestation => ({
		witnessId,
		signature: { timestamp: '2026-09-12T00:00:00Z', method: 'drawn', type: 'signature' },
		attestsTo: [{ role: 'buyer', partyId: 'buyer-0', signerId: 'buyer-0-signer' }],
	})
	const evaluate = (expr: string, captures: SignatureCapture[] = [], attestations: Attestation[] = []) => {
		const context = buildFormContext(signingForm, {
			fields: {},
			parties: parties as never,
			witnesses: witnesses as never,
			signing: signingStateOf(captures, attestations),
		})
		return evaluateExpression(expr, context).value
	}

	test('nobody has signed without signing records', () => {
		expect(evaluate('signedCount("buyer")')).toBe(0)
		expect(evaluate('anySigned("buyer")')).toBe(false)
		expect(evaluate('allSigned("buyer")')).toBe(false)
		expect(evaluate('anyWitnessSigned()')).toBe(false)
		expect(evaluate('allWitnessesSigned()')).toBe(false)
	})

	test('a captured signature marks its party signed', () => {
		const one = [capture('buyer', 'buyer-1')]
		expect(evaluate('signedCount("buyer")', one)).toBe(1)
		expect(evaluate('anySigned("buyer")', one)).toBe(true)
		expect(evaluate('allSigned("buyer")', one)).toBe(false)
		expect(evaluate('anySigned("seller")', one)).toBe(false)
	})

	test('every party signed makes allSigned true', () => {
		const both = [capture('buyer', 'buyer-0'), capture('buyer', 'buyer-1'), capture('buyer', 'buyer-1')]
		expect(evaluate('signedCount("buyer")', both)).toBe(2)
		expect(evaluate('allSigned("buyer")', both)).toBe(true)
	})

	test('initials alone do not mark a party signed', () => {
		expect(evaluate('anySigned("seller")', [capture('seller', 'seller-0', 'initials')])).toBe(false)
	})

	test('a role with no parties is never all signed', () => {
		expect(evaluate('allSigned("guarantor")', [capture('buyer', 'buyer-0')])).toBe(false)
		expect(evaluate('signedCount("guarantor")')).toBe(0)
		expect(evaluate('partyCount("guarantor")')).toBe(0)
	})

	test('partyType reads the first party of a role', () => {
		expect(evaluate('partyType("buyer")')).toBe('person')
		expect(evaluate('partyType("seller")')).toBe('organization')
		expect(evaluate('partyType("guarantor")')).toBe('')
	})

	test('witness predicates follow attestations', () => {
		expect(evaluate('witnessCount()')).toBe(2)
		expect(evaluate('anyWitnessSigned()', [], [attestation('w1')])).toBe(true)
		expect(evaluate('allWitnessesSigned()', [], [attestation('w1')])).toBe(false)
		expect(evaluate('allWitnessesSigned()', [], [attestation('w1'), attestation('w2')])).toBe(true)
	})

	test('a form with no witnesses is never all witnessed', () => {
		const context = buildFormContext(signingForm, { fields: {}, parties: parties as never })
		expect(evaluateExpression('allWitnessesSigned()', context).value).toBe(false)
		expect(evaluateExpression('witnessCount()', context).value).toBe(0)
	})

	test('a filled form supplies its captured signatures to its logic', () => {
		const def = form({
			kind: 'form',
			name: 'sign-probe',
			fields: { name: { type: 'text' } },
			parties: { buyer: { label: 'Buyer', partyType: 'person', signature: { required: true } } },
			defs: {
				buyerSigned: { type: 'boolean', value: 'allSigned("buyer")' },
				buyerSignedCount: { type: 'number', value: 'signedCount("buyer")' },
			},
			rules: { signed: { expr: 'allSigned("buyer")', message: 'The buyer has not signed', severity: 'warning' } },
		} as any)
		const signable = def.fill({
			fields: { name: 'x' },
			parties: { buyer: { id: 'buyer-0', name: 'Ann Buyer' } },
		} as any)
			.addSigner('buyer-signer', { person: { name: 'Ann Buyer' } } as any)
			.addSignatory('buyer', 'buyer-0', { signerId: 'buyer-signer' } as any)
			.prepareForSigning()
		expect(signable.getLogicValue('buyerSigned')).toBe(false)
		expect(signable.validateRules().warnings.map((warning) => warning.ruleId)).toEqual(['signed'])

		const signed = signable.captureSignature('buyer', 'buyer-0', 'buyer-signer', 'sig-buyer-0')
		expect({
			signed: signed.getLogicValue('buyerSigned'),
			count: signed.getLogicValue('buyerSignedCount'),
			warnings: signed.validateRules().warnings,
			executed: signed.finalize().getLogicValue('buyerSigned'),
		}).toEqual({ signed: true, count: 1, warnings: [], executed: true })
	})
})
