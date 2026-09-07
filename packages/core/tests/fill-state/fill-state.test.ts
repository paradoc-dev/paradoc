import { describe, test, expect } from 'vitest'
import { form, party, FormValidationError } from '@/artifacts'
import type { DraftForm } from '@/artifacts'

// ============================================================================
// Fixtures
// ============================================================================

const createSimpleForm = () =>
	form()
		.name('simple')
		.version('1.0.0')
		.title('Simple Form')
		.fields({
			firstName: { type: 'text', label: 'First Name', required: true },
			lastName: { type: 'text', label: 'Last Name', required: true },
			email: { type: 'email', label: 'Email' },
			age: { type: 'number', label: 'Age' },
		})
		.build()

const createNestedForm = () =>
	form()
		.name('nested')
		.fields({
			profile: {
				type: 'fieldset',
				fields: {
					firstName: { type: 'text', required: true },
					lastName: { type: 'text', required: true },
				},
			},
			location: { type: 'coordinate' },
			rows: {
				type: 'list',
				item: {
					type: 'fieldset',
					fields: {
						label: { type: 'text' },
						value: { type: 'number' },
					},
				},
			},
			status: { type: 'text', default: 'draft' },
			requiredName: { type: 'text', required: true },
		})
		.build()

const createConditionalForm = () =>
	form()
		.name('conditional')
		.version('1.0.0')
		.title('Conditional Form')
		.fields({
			hasSpouse: { type: 'boolean', label: 'Has Spouse', required: true },
			spouseName: { type: 'text', label: 'Spouse Name', visible: 'fields.hasSpouse == true', required: 'fields.hasSpouse == true' },
			dependentCount: { type: 'number', label: 'Dependents', required: true },
			dependentNames: { type: 'text', label: 'Dependent Names', visible: 'fields.dependentCount > 0', required: 'fields.dependentCount > 0' },
		})
		.build()

const createMultiBranchForm = () =>
	form()
		.name('multi-branch')
		.version('1.0.0')
		.title('Multi Branch')
		.fields({
			entityType: { type: 'enum', label: 'Entity Type', enum: [{ value: 'person' }, { value: 'org' }], required: true },
			personName: { type: 'text', label: 'Person Name', visible: 'fields.entityType == "person"', required: 'fields.entityType == "person"' },
			orgName: { type: 'text', label: 'Org Name', visible: 'fields.entityType == "org"', required: 'fields.entityType == "org"' },
			email: { type: 'email', label: 'Email', required: true },
		})
		.build()

const createFormWithParties = () =>
	form()
		.name('with-parties')
		.version('1.0.0')
		.title('With Parties')
		.fields({
			amount: { type: 'number', label: 'Amount', required: true },
		})
		.parties({
			buyer: party().label('Buyer').partyType('person').required(true).build(),
			seller: party().label('Seller').partyType('any').required(false).min(0).build(),
		})
		.annexes({
			receipt: { title: 'Receipt', required: true },
			notes: { title: 'Notes' },
		})
		.build()

const createFormWithProgressiveParties = () =>
	form()
		.name('progressive-parties')
		.parties({
			buyer: party().label('Buyer').partyType('person').min(0).build(),
			witness: party().label('Witness').partyType('person').multiple(true).min(0).max(2).build(),
		})
		.build()

const createCompletePartyPayload = () => ({
	fields: { amount: 100 },
	parties: { buyer: { id: 'buyer-0', name: 'Alice' } },
	annexes: { receipt: { filename: 'receipt.pdf' } },
})

const createFormWithDefsAndRules = () =>
	form()
		.name('defs-rules')
		.version('1.0.0')
		.title('Defs and Rules')
		.fields({
			income: { type: 'number', label: 'Income', required: true },
			expenses: { type: 'number', label: 'Expenses', required: true },
		})
		.defs({
			netIncome: { type: 'number', label: 'Net', value: 'fields.income - fields.expenses' },
		})
		.build()

const createConditionalPartyForm = (
	required: boolean | string | undefined,
	min?: number,
	max = 1,
) =>
	form()
		.name('conditional-party')
		.version('1.0.0')
		.title('Conditional Party')
		.fields({
			needsGuarantor: { type: 'boolean' },
		})
		.parties({
			guarantor: {
				label: 'Guarantor',
				...(min === undefined ? {} : { min }),
				...(max === undefined ? {} : { max }),
				...(required === undefined ? {} : { required }),
			},
		})
		.build()

const createFormWithPartyExpressions = () =>
	form({
		kind: 'form',
		name: 'party-expressions',
		version: '1.0.0',
		title: 'Party Expressions',
		fields: {
			partyName: {
				type: 'text',
				visible: 'partyCount("buyer") > 0',
				required: 'partyCount("buyer") > 0',
			},
		},
		annexes: {
			partyProof: { title: 'Party proof', visible: 'partyCount("buyer") > 0' },
		},
		parties: {
			buyer: { label: 'Buyer', types: ['person'], min: 0 },
		},
		rules: {
			buyerPresent: {
				expr: 'partyCount("buyer") > 0',
				severity: 'error',
				message: 'A buyer is required',
			},
		},
	} as any)

const createCompletionContractForm = () =>
	form({
		kind: 'form',
		name: 'completion-contract',
		version: '1.0.0',
		title: 'Completion Contract',
		fields: {
			enabled: { type: 'boolean' },
			license: {
				type: 'text',
				visible: 'fields.enabled == true',
				required: 'fields.enabled == true',
			},
			requiredFlag: { type: 'boolean', required: true },
			requiredCount: { type: 'number', required: true },
			hiddenText: { type: 'text', visible: false, required: true },
			hiddenSection: {
				type: 'fieldset',
				visible: false,
				fields: { secret: { type: 'text', required: true } },
			},
		},
		annexes: {
			hiddenProof: { title: 'Hidden Proof', visible: false, required: true },
			proof: { title: 'Proof', visible: 'fields.enabled == true', required: 'fields.enabled == true' },
		},
		rules: {
			flagMustBeSet: {
				expr: 'requiredFlag == true',
				severity: 'error',
				message: 'The flag must be set',
			},
		},
	} as any)

// ============================================================================
// Tests
// ============================================================================

describe('fill-state', () => {
	// ========================================================================
	// fill
	// ========================================================================

	describe('fill', () => {
		test('creates draft from empty seed', () => {
			const f = createSimpleForm()
			const draft = f.fill()

			expect(draft.phase).toBe('draft')
			expect(draft.fields).toEqual({})
		})

		test('creates draft from partial seed', () => {
			const f = createSimpleForm()
			const draft = f.fill({ fields: { firstName: 'Alice' } } as any)

			expect(draft.phase).toBe('draft')
			expect(draft.getField('firstName')).toBe('Alice')
		})

		test('creates draft from full payload', () => {
			const f = createSimpleForm()
			const draft = f.fill({
				fields: { firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com', age: 30 },
			} as any)

			expect(draft.getField('firstName')).toBe('Alice')
			expect(draft.getField('lastName')).toBe('Smith')
		})

		test('validates with patch mode by default', () => {
			const f = createSimpleForm()
			// Partial seed should pass patch validation (doesn't require all fields)
			const draft = f.fill({ fields: { firstName: 'Bob' } } as any)
			expect(draft.phase).toBe('draft')
		})

		test('throws on invalid field value in patch mode', () => {
			const f = createSimpleForm()
			expect(() =>
				f.fill({ fields: { age: 'not-a-number' } } as any)
			).toThrow()
		})

		test('rejects malformed supplied data', () => {
			const f = createSimpleForm()
			expect(() => f.fill({ fields: { age: 'not-a-number' } } as any)).toThrow(FormValidationError)
		})

		test('accepts empty call with no arguments', () => {
			const f = createSimpleForm()
			const draft = f.fill()
			expect(draft.phase).toBe('draft')
		})

		test('stores normalized parties returned by patch validation', () => {
			const f = createFormWithProgressiveParties()
			const parties = {
				buyer: { name: 'Alice' },
				witness: [{ name: 'Wanda' }, { id: 'witness-1', name: 'Wally' }],
			}
			const validation = f.validatePartiesPatch(parties)
			const draft = f.fill({ parties } as any)

			expect(validation.success).toBe(true)
			if (validation.success) {
				expect(draft.parties).toEqual(validation.value)
			}
		})
	})

	// ========================================================================
	// safeFill
	// ========================================================================

	describe('safeFill', () => {
		test('returns success for valid partial data', () => {
			const f = createSimpleForm()
			const result = f.safeFill({ fields: { firstName: 'Alice' } } as any)

			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.phase).toBe('draft')
			}
		})

		test('returns failure for invalid data', () => {
			const f = createSimpleForm()
			const result = f.safeFill({ fields: { age: 'bad' } } as any)

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error).toBeInstanceOf(Error)
			}
		})

		test('returns success for empty seed', () => {
			const f = createSimpleForm()
			const result = f.safeFill()

			expect(result.success).toBe(true)
		})
	})

	// ========================================================================
	// update
	// ========================================================================

	describe('update', () => {
		test('recursively merges nested objects and preserves omitted members', () => {
			const f = createNestedForm()
			const draft = f.fill({
				fields: {
					profile: { firstName: 'Ada', lastName: 'Lovelace' },
					rows: [{ label: 'old', value: 1 }],
				},
			} as any)

			const updated = draft.update({ fields: { profile: { firstName: 'Grace' } } } as any)

			expect(updated.fields.profile).toEqual({ firstName: 'Grace', lastName: 'Lovelace' })
			expect(updated.fields.rows).toEqual([{ label: 'old', value: 1 }])
		})

		test('replaces supplied arrays instead of merging by index', () => {
			const f = createNestedForm()
			const draft = f.fill({
				fields: { rows: [{ label: 'old', value: 1 }, { label: 'keep?', value: 2 }] },
			} as any)

			const updated = draft.update({ fields: { rows: [{ label: 'new', value: 3 }] } } as any)

			expect(updated.fields.rows).toEqual([{ label: 'new', value: 3 }])
		})

		test('does not treat undefined as a deletion sentinel', () => {
			const f = createNestedForm()
			const draft = f.fill({
				fields: { profile: { firstName: 'Ada', lastName: 'Lovelace' } },
			} as any)

			const updated = draft.update({ fields: { profile: { lastName: undefined } } } as any)

			expect(updated.fields.profile).toEqual({ firstName: 'Ada', lastName: 'Lovelace' })
		})

		test('rejects null instead of treating it as a deletion sentinel', () => {
			const f = createNestedForm()
			const draft = f.fill({ fields: { profile: { firstName: 'Ada' } } } as any)

			expect(() => draft.update({ fields: { profile: null } } as any)).toThrow()
		})

		test('recursively merges primitive object field values', () => {
			const f = createNestedForm()
			const draft = f.fill({ fields: { location: { lat: 40, lon: -74 } } } as any)

			const updated = draft.update({ fields: { location: { lat: 41 } } } as any)

			expect(updated.fields.location).toEqual({ lat: 41, lon: -74 })
		})

		test('updates preserve defaults applied at draft creation', () => {
			const f = form()
				.name('defaults')
				.fields({
					requiredName: { type: 'text', required: true },
					status: { type: 'text', default: 'draft' },
				})
				.build()
			const draft = f.fill({ fields: { requiredName: 'before' } } as any)

			const updated = draft.update(
				{ fields: { requiredName: 'after' } } as any,
			)

			expect(updated.fields).toEqual({ requiredName: 'after', status: 'draft' })
		})

		test('merges field patch into existing data', () => {
			const f = createSimpleForm()
			const draft = f.fill({ fields: { firstName: 'Alice' } } as any)
			const updated = draft.update({ fields: { lastName: 'Smith' } } as any)

			expect(updated.getField('firstName')).toBe('Alice')
			expect(updated.getField('lastName')).toBe('Smith')
		})

		test('overwrites existing field values', () => {
			const f = createSimpleForm()
			const draft = f.fill({ fields: { firstName: 'Alice' } } as any)
			const updated = draft.update({ fields: { firstName: 'Bob' } } as any)

			expect(updated.getField('firstName')).toBe('Bob')
		})

		test('throws on invalid patch in patch mode', () => {
			const f = createSimpleForm()
			const draft = f.fill()

			expect(() =>
				draft.update({ fields: { age: 'bad' } } as any)
			).toThrow()
		})

		test('returns new DraftForm instance', () => {
			const f = createSimpleForm()
			const draft = f.fill()
			const updated = draft.update({ fields: { firstName: 'X' } } as any)

			expect(updated).not.toBe(draft)
			expect(updated.phase).toBe('draft')
		})

		test('stores normalized party patch values while preserving existing parties', () => {
			const f = createFormWithProgressiveParties()
			const draft = f.fill({ parties: { buyer: { name: 'Alice' } } } as any)
			const parties = {
				witness: [{ name: 'Wanda' }, { id: 'witness-1', name: 'Wally' }],
			}
			const validation = f.validatePartiesPatch(parties)
			const updated = draft.update({ parties } as any)

			expect(validation.success).toBe(true)
			if (validation.success) {
				expect(updated.parties).toEqual({ ...draft.parties, ...validation.value })
			}

			const repeated = updated.update({
				parties: { buyer: { id: 'buyer-0', name: 'Alice Updated' } },
			} as any)
			expect(repeated.getParty('buyer')).toEqual({ id: 'buyer-0', name: 'Alice Updated' })
		})
	})

	// ========================================================================
	// safeUpdate
	// ========================================================================

	describe('safeUpdate', () => {
		test('returns success for valid patch', () => {
			const f = createSimpleForm()
			const draft = f.fill()
			const result = draft.safeUpdate({ fields: { firstName: 'Alice' } } as any)

			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.getField('firstName')).toBe('Alice')
			}
		})

		test('returns failure for invalid patch', () => {
			const f = createSimpleForm()
			const draft = f.fill()
			const result = draft.safeUpdate({ fields: { age: 'bad' } } as any)

			expect(result.success).toBe(false)
		})
	})

	// ========================================================================
	// getFillState
	// ========================================================================

	describe('getFillState', () => {
		test('tracks required fields inside list items with indexed paths', () => {
			const repeated = form().name('repeated').fields({
				items: {
					type: 'list', required: true, minItems: 1,
					item: { type: 'fieldset', fields: { name: { type: 'text', required: true } } },
				},
			}).build()
			const state = repeated.fill({ fields: { items: [{}] } } as any).getFillState()
			expect(state.openRequired.map((item) => item.key)).toContain('items[0].name')
		})

		test('reports all required as open when empty', () => {
			const f = createSimpleForm()
			const draft = f.fill()
			const state = draft.getFillState()

			expect(state.phase).toBe('draft')
			expect(state.summary.requiredTotal).toBe(2) // firstName, lastName
			expect(state.summary.requiredDone).toBe(0)
			expect(state.summary.requiredRemaining).toBe(2)
			expect(state.summary.completionPercent).toBe(0)
			expect(state.openRequired.length).toBe(2)
		})

		test('moves filled items to done', () => {
			const f = createSimpleForm()
			const draft = f.fill({ fields: { firstName: 'Alice', lastName: 'Smith' } } as any)
			const state = draft.getFillState()

			expect(state.summary.requiredDone).toBe(2)
			expect(state.summary.completionPercent).toBe(100)
			expect(state.done.filter(d => d.required).length).toBe(2)
		})

		test('reports blocked fields when visibility depends on unfilled field', () => {
			const f = createConditionalForm()
			const draft = f.fill()
			const state = draft.getFillState()

			// spouseName and dependentNames should be blocked
			const blockedKeys = state.blocked.map(b => b.key)
			expect(blockedKeys).toContain('spouseName')
			expect(blockedKeys).toContain('dependentNames')
		})

		test('unblocks fields when dependency is filled', () => {
			const f = createConditionalForm()
			const draft = f.fill({ fields: { hasSpouse: true } } as any)
			const state = draft.getFillState()

			// spouseName should now be open (visible because hasSpouse is true)
			const openKeys = state.openRequired.map(o => o.key)
			expect(openKeys).toContain('spouseName')
		})

		test('keeps conditional fields blocked when condition is false', () => {
			const f = createConditionalForm()
			const draft = f.fill({ fields: { hasSpouse: false, dependentCount: 0 } } as any)
			const state = draft.getFillState()

			// spouseName should be blocked (not visible because hasSpouse is false)
			const blockedKeys = state.blocked.map(b => b.key)
			expect(blockedKeys).toContain('spouseName')
			expect(blockedKeys).toContain('dependentNames')
		})

		test('reports defs values', () => {
			const f = createFormWithDefsAndRules()
			const draft = f.fill({ fields: { income: 100, expenses: 40 } } as any)
			const state = draft.getFillState()

			expect(state.defsValues.netIncome).toBe(60)
		})

		test('includes parties in fill state', () => {
			const f = createFormWithParties()
			const draft = f.fill()
			const state = draft.getFillState()

			// buyer is required, seller is not
			const openRequiredKeys = state.openRequired.map(o => o.key)
			expect(openRequiredKeys).toContain('buyer')
			expect(openRequiredKeys).toContain('amount')
			expect(openRequiredKeys).toContain('receipt')
		})

		test('uses conditional party requiredness in fill state and full validation', () => {
			const f = createConditionalPartyForm('fields.needsGuarantor == true', 0)

			const notNeeded = f.fill({ fields: { needsGuarantor: false } } as any)
			const notNeededState = notNeeded.getFillState()
			expect(notNeededState.openRequired.some((item) => item.key === 'guarantor')).toBe(false)
			expect(notNeededState.openOptional.some((item) => item.key === 'guarantor')).toBe(true)
			expect(() => f.fill(
				{ fields: { needsGuarantor: false } } as any,
			)).not.toThrow()

			const needed = f.fill({ fields: { needsGuarantor: true } } as any)
			const neededState = needed.getFillState()
			expect(neededState.openRequired.some((item) => item.key === 'guarantor')).toBe(true)
			expect(needed.isValid()).toBe(false)
			expect(() => needed.prepareForSigning()).toThrow(/guarantor.*requires at least 1 party/i)
		})

		test('preserves omitted and explicit optional party defaults', () => {
			const omittedOptional = createConditionalPartyForm(undefined, 0)
			const omittedOptionalState = omittedOptional.fill().getFillState()
			expect(omittedOptionalState.openRequired.some((item) => item.key === 'guarantor')).toBe(false)

			const omittedRequired = createConditionalPartyForm(undefined)
			const omittedRequiredState = omittedRequired.fill().getFillState()
			expect(omittedRequiredState.openRequired.some((item) => item.key === 'guarantor')).toBe(true)

			const explicitlyOptional = createConditionalPartyForm(false)
			const explicitlyOptionalState = explicitlyOptional.fill().getFillState()
			expect(explicitlyOptionalState.openRequired.some((item) => item.key === 'guarantor')).toBe(false)
			expect(() => explicitlyOptional.fill(undefined)).not.toThrow()
		})

		test('keeps supplied party cardinalities enforceable after condition resolution', () => {
			const conditional = createConditionalPartyForm('fields.needsGuarantor == true', 0, 2)
			expect(conditional.fill({ fields: { needsGuarantor: true }, parties: { guarantor: [] } } as any).isValid()).toBe(false)

			const optional = createConditionalPartyForm('fields.needsGuarantor == false', 1, 2)
			expect(optional.fill({ fields: { needsGuarantor: false }, parties: { guarantor: [] } } as any).isValid()).toBe(false)
		})

		test('includes annexes in fill state', () => {
			const f = createFormWithParties()
			const draft = f.fill()
			const state = draft.getFillState()

			// receipt is required, notes is optional
			const openOptionalKeys = state.openOptional.map(o => o.key)
			expect(openOptionalKeys).toContain('notes')
		})

		test('rules section reports valid/errors/warnings', () => {
			const f = createSimpleForm()
			const draft = f.fill()
			const state = draft.getFillState()

			// No rules defined → valid
			expect(state.rules.valid).toBe(true)
			expect(state.rules.errors).toEqual([])
			expect(state.rules.warnings).toEqual([])
		})

		test('forwards parties to field, annex, and rule evaluation', () => {
			const f = createFormWithPartyExpressions()
			const empty = f.fill()
			const emptyState = empty.getFillState()

			expect(empty.isFieldVisible('partyName')).toBe(false)
			expect(empty.isAnnexVisible('partyProof')).toBe(false)
			expect(emptyState.rules.valid).toBe(false)

			const withBuyer = f.fill({
				parties: { buyer: { id: 'buyer-0', name: 'Alice' } },
			} as any)
			const state = withBuyer.getFillState()

			expect(withBuyer.isFieldVisible('partyName')).toBe(true)
			expect(withBuyer.isFieldRequired('partyName')).toBe(true)
			expect(withBuyer.isAnnexVisible('partyProof')).toBe(true)
			expect(state.rules.valid).toBe(true)
			expect(() => f.fill({
				fields: { partyName: 'Alice' },
				parties: { buyer: { id: 'buyer-0', name: 'Alice' } },
			} as any)).not.toThrow()
		})
	})

	// ========================================================================
	// getAvailableFillTargets
	// ========================================================================

	describe('getAvailableFillTargets', () => {
		test('returns required targets in declaration order by default', () => {
			const f = createSimpleForm()
			const draft = f.fill()
			const targets = draft.getAvailableFillTargets()

			expect(targets.length).toBe(2) // only required: firstName, lastName
			expect(targets[0]!.key).toBe('firstName')
			expect(targets[1]!.key).toBe('lastName')
		})

		test('includes optional targets when requested', () => {
			const f = createSimpleForm()
			const draft = f.fill()
			const targets = draft.getAvailableFillTargets({ includeOptional: true })

			expect(targets.length).toBe(4)
		})

		test('orders parties before fields before annexes', () => {
			const f = createFormWithParties()
			const draft = f.fill()
			const targets = draft.getAvailableFillTargets({ includeOptional: true })

			const kinds = targets.map(t => t.kind)
			const firstPartyIdx = kinds.indexOf('party')
			const firstFieldIdx = kinds.indexOf('field')
			const firstAnnexIdx = kinds.indexOf('annex')

			if (firstPartyIdx >= 0 && firstFieldIdx >= 0) {
				expect(firstPartyIdx).toBeLessThan(firstFieldIdx)
			}
			if (firstFieldIdx >= 0 && firstAnnexIdx >= 0) {
				expect(firstFieldIdx).toBeLessThan(firstAnnexIdx)
			}
		})

		test('respects requiredFirst option', () => {
			const f = createFormWithParties()
			const draft = f.fill()
			const targets = draft.getAvailableFillTargets({ includeOptional: true, requiredFirst: true })

			// All required should come before optional
			const firstOptionalIdx = targets.findIndex(t => !t.required)
			const lastRequiredIdx = targets.map(t => t.required).lastIndexOf(true)

			if (firstOptionalIdx >= 0 && lastRequiredIdx >= 0) {
				expect(lastRequiredIdx).toBeLessThan(firstOptionalIdx)
			}
		})

		test('interleaves by declaration order when requiredFirst is false', () => {
			const f = createFormWithParties()
			const draft = f.fill()
			const targets = draft.getAvailableFillTargets({ includeOptional: true, requiredFirst: false })

			// Should be sorted by order (declaration order)
			for (let i = 1; i < targets.length; i++) {
				expect(targets[i]!.order).toBeGreaterThanOrEqual(targets[i - 1]!.order)
			}
		})

		test('multi-branch form shows correct candidates', () => {
			const f = createMultiBranchForm()
			const draft = f.fill({ fields: { entityType: 'person' } } as any)
			const targets = draft.getAvailableFillTargets()

			const keys = targets.map(t => t.key)
			expect(keys).toContain('personName')
			expect(keys).toContain('email')
			expect(keys).not.toContain('orgName') // not visible
		})
	})

	// ========================================================================
	// getNextFillTarget
	// ========================================================================

	describe('getNextFillTarget', () => {
		test('returns first required unfilled target', () => {
			const f = createSimpleForm()
			const draft = f.fill()
			const next = draft.getNextFillTarget()

			expect(next).not.toBeNull()
			expect(next!.key).toBe('firstName')
			expect(next!.required).toBe(true)
		})

		test('returns null when all required are filled', () => {
			const f = createSimpleForm()
			const draft = f.fill({
				fields: { firstName: 'Alice', lastName: 'Smith' },
			} as any)
			const next = draft.getNextFillTarget()

			expect(next).toBeNull()
		})

		test('returns optional target when includeOptional and all required done', () => {
			const f = createSimpleForm()
			const draft = f.fill({
				fields: { firstName: 'Alice', lastName: 'Smith' },
			} as any)
			const next = draft.getNextFillTarget({ includeOptional: true })

			expect(next).not.toBeNull()
			expect(next!.required).toBe(false)
		})
	})

	// ========================================================================
	// Regression: fill/safeFill unchanged
	// ========================================================================

	describe('regression: fill/safeFill still work', () => {
		test('full validation includes required parties and annexes', () => {
			const f = createFormWithParties()
			const payload = createCompletePartyPayload() as any

			expect(f.safeParseData(payload).success).toBe(true)
			const result = f.safeFill(payload)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.parties).toEqual(payload.parties)
				expect(result.data.annexes).toEqual(payload.annexes)
			}
		})

		test('field-only mutations do not require missing party or annex sections', () => {
			const f = createFormWithParties()
			const draft = f.fill({ fields: { amount: 100 } } as any)

			expect(draft.setField('amount', 101).getField('amount')).toBe(101)
			expect(draft.updateFields({ amount: 102 }).getField('amount')).toBe(102)
		})

		test('full updates validate merged parties and annexes', () => {
			const f = createFormWithParties()
			const payload = createCompletePartyPayload() as any
			const draft = f.fill(payload)

			const updated = draft.update({ fields: { amount: 101 } })
			expect(updated.getField('amount')).toBe(101)
			expect(updated.parties).toEqual(payload.parties)
			expect(updated.annexes).toEqual(payload.annexes)
		})

		test('full update and partial fill reject malformed optional parties', () => {
			const f = createFormWithParties()
			const validPayload = createCompletePartyPayload() as any
			const draft = f.fill(validPayload)
			const malformedParty = { parties: { seller: null } } as any

			expect(() => draft.update(malformedParty)).toThrow(FormValidationError)
			const updateResult = draft.safeUpdate(malformedParty)
			expect(updateResult.success).toBe(false)

			const partialResult = f.safeFill(
				{ ...validPayload, parties: { buyer: validPayload.parties.buyer, seller: null } },
			)
			expect(partialResult.success).toBe(false)
			expect(() =>
				f.fill(
					{ ...validPayload, parties: { buyer: validPayload.parties.buyer, seller: null } },
				),
			).toThrow(FormValidationError)
		})

		test('fill creates draft with full validation', () => {
			const f = createSimpleForm()
			const draft = f.fill({
				fields: { firstName: 'Alice', lastName: 'Smith' },
			} as any)

			expect(draft.phase).toBe('draft')
			expect(draft.getField('firstName')).toBe('Alice')
		})

		test('safeFill returns success/failure discriminated union', () => {
			const f = createSimpleForm()
			const result = f.safeFill({
				fields: { firstName: 'Alice', lastName: 'Smith' },
			} as any)

			expect(result.success).toBe(true)
		})

		test('fill creates an incomplete draft for missing required fields', () => {
			const f = createSimpleForm()
			expect(f.fill({ fields: {} } as any).isValid()).toBe(false)
		})
	})

	// ========================================================================
	// Full validation and completion contract
	// ========================================================================

	describe('full validation and completion contract', () => {
		const completeVisiblePayload = {
			fields: {
				enabled: true,
				license: 'DL-123',
				requiredFlag: true,
				requiredCount: 0,
			},
			annexes: { proof: { filename: 'proof.pdf' } },
		}

		test('full fill resolves conditional requiredness and ignores hidden required values', () => {
			const f = createCompletionContractForm()
			const result = f.safeFill({
				fields: { enabled: false, requiredFlag: true, requiredCount: 0 },
			} as any)

			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.isValid()).toBe(true)
				expect(result.data.getFillState().summary.requiredRemaining).toBe(0)
				expect(result.data.isAnnexRequired('hiddenProof')).toBe(false)
			}

			const incomplete = f.safeFill({
				fields: { enabled: true, requiredFlag: true, requiredCount: 0 },
				annexes: { proof: { filename: 'proof.pdf' } },
			} as any)
			expect(incomplete.success).toBe(true)
			if (incomplete.success) expect(incomplete.data.isValid()).toBe(false)
			expect(f.safeFill(completeVisiblePayload as any).success).toBe(true)
		})

		test('runtime validation reports missing and invalid values after progressive filling', () => {
			const f = createCompletionContractForm()
			const incomplete = f.fill({ fields: { enabled: false } } as any)
			const incompleteValidation = incomplete.validate()

			expect(incomplete.isValid()).toBe(false)
			expect(incompleteValidation.valid).toBe(false)
			expect(incompleteValidation.errors.map((error) => error.field)).toEqual([
				'fields.requiredFlag',
				'fields.requiredCount',
			])
			expect(incomplete.validateRules().valid).toBe(false)

			expect(() => f.fill({ fields: { requiredFlag: true, requiredCount: 'bad' } } as any)).toThrow(FormValidationError)
		})

		test('false and zero values satisfy required fields', () => {
			const f = createCompletionContractForm()
			const result = f.safeFill({
				fields: { enabled: false, requiredFlag: false, requiredCount: 0 },
			} as any)

			expect(result.success).toBe(true)
		})

		test('hidden stored values remain available and are still type checked', () => {
			const f = createCompletionContractForm()
			const draft = f.fill({
				fields: { enabled: false, hiddenText: 'kept', requiredFlag: true, requiredCount: 0 },
				annexes: {
					hiddenProof: { filename: 'kept.pdf' },
					proof: { filename: 'kept-conditional.pdf' },
				},
			} as any)
			const shown = draft.update({ fields: { enabled: true } } as any)

			expect(shown.getField('hiddenText')).toBe('kept')
			expect(shown.getAnnex('hiddenProof')).toEqual({ filename: 'kept.pdf' })
			expect(shown.getAnnex('proof')).toEqual({ filename: 'kept-conditional.pdf' })
			expect(shown.isAnnexRequired('proof')).toBe(true)
			expect(() => f.fill({ fields: { hiddenText: 123 } } as any)).toThrow(FormValidationError)
		})

		test('null and undefined do not satisfy a visible required annex', () => {
			const f = createCompletionContractForm()
			for (const value of [null, undefined]) {
				const result = f.safeFill({
					fields: { enabled: true, license: 'DL-123', requiredFlag: true, requiredCount: 0 },
					annexes: { proof: value },
				} as any)
				expect(result.success).toBe(true)
				if (result.success) expect(result.data.isValid()).toBe(false)
			}
		})

		test('validate keeps rules separate from full value validity', () => {
			const f = createCompletionContractForm()
			const draft = f.fill({
				...completeVisiblePayload,
				fields: { ...completeVisiblePayload.fields, requiredFlag: false },
			} as any)
			const validation = draft.validate()

			expect(validation.valid).toBe(false)
			expect(validation.errors).toEqual([])
			expect(validation.rules.valid).toBe(false)
		})
	})

	// ========================================================================
	// End-to-end progressive flow
	// ========================================================================

	describe('progressive filling flow', () => {
		test('step-by-step filling with conditional fields', () => {
			const f = createConditionalForm()

			// Step 0: empty form
			const d0 = f.fill()
			const s0 = d0.getFillState()
			expect(s0.summary.completionPercent).toBe(0)
			expect(s0.blocked.length).toBeGreaterThan(0)

			// Step 1: fill hasSpouse
			const d1 = d0.update({ fields: { hasSpouse: true } } as any)
			const s1 = d1.getFillState()
			// spouseName should now be open required
			expect(s1.openRequired.some(o => o.key === 'spouseName')).toBe(true)

			// Step 2: fill spouseName and dependentCount
			const d2 = d1.update({ fields: { spouseName: 'Bob', dependentCount: 2 } } as any)
			const s2 = d2.getFillState()
			// dependentNames should now be open
			expect(s2.openRequired.some(o => o.key === 'dependentNames')).toBe(true)

			// Step 3: fill dependentNames
			const d3 = d2.update({ fields: { dependentNames: 'Child1, Child2' } } as any)
			const s3 = d3.getFillState()
			expect(s3.summary.completionPercent).toBe(100)
			expect(s3.next).toBeNull()
		})
	})
})
