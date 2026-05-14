import { describe, test, expect } from 'vitest'
import { form, party } from '@/artifacts'
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
			entityType: { type: 'enum', label: 'Entity Type', enum: ['person', 'org'], required: true },
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

// ============================================================================
// Tests
// ============================================================================

describe('fill-state', () => {
	// ========================================================================
	// partialFill
	// ========================================================================

	describe('partialFill', () => {
		test('creates draft from empty seed', () => {
			const f = createSimpleForm()
			const draft = f.partialFill()

			expect(draft.phase).toBe('draft')
			expect(draft.fields).toEqual({})
		})

		test('creates draft from partial seed', () => {
			const f = createSimpleForm()
			const draft = f.partialFill({ fields: { firstName: 'Alice' } } as any)

			expect(draft.phase).toBe('draft')
			expect(draft.getField('firstName')).toBe('Alice')
		})

		test('creates draft from full payload', () => {
			const f = createSimpleForm()
			const draft = f.partialFill({
				fields: { firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com', age: 30 },
			} as any)

			expect(draft.getField('firstName')).toBe('Alice')
			expect(draft.getField('lastName')).toBe('Smith')
		})

		test('validates with patch mode by default', () => {
			const f = createSimpleForm()
			// Partial seed should pass patch validation (doesn't require all fields)
			const draft = f.partialFill({ fields: { firstName: 'Bob' } } as any)
			expect(draft.phase).toBe('draft')
		})

		test('throws on invalid field value in patch mode', () => {
			const f = createSimpleForm()
			expect(() =>
				f.partialFill({ fields: { age: 'not-a-number' } } as any)
			).toThrow()
		})

		test('skips validation when validate is none', () => {
			const f = createSimpleForm()
			// Even garbage data passes with no validation
			const draft = f.partialFill(
				{ fields: { age: 'not-a-number' } } as any,
				{ validate: 'none' },
			)
			expect(draft.phase).toBe('draft')
		})

		test('accepts empty call with no arguments', () => {
			const f = createSimpleForm()
			const draft = f.partialFill()
			expect(draft.phase).toBe('draft')
		})
	})

	// ========================================================================
	// safePartialFill
	// ========================================================================

	describe('safePartialFill', () => {
		test('returns success for valid partial data', () => {
			const f = createSimpleForm()
			const result = f.safePartialFill({ fields: { firstName: 'Alice' } } as any)

			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.phase).toBe('draft')
			}
		})

		test('returns failure for invalid data', () => {
			const f = createSimpleForm()
			const result = f.safePartialFill({ fields: { age: 'bad' } } as any)

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error).toBeInstanceOf(Error)
			}
		})

		test('returns success for empty seed', () => {
			const f = createSimpleForm()
			const result = f.safePartialFill()

			expect(result.success).toBe(true)
		})
	})

	// ========================================================================
	// update
	// ========================================================================

	describe('update', () => {
		test('merges field patch into existing data', () => {
			const f = createSimpleForm()
			const draft = f.partialFill({ fields: { firstName: 'Alice' } } as any)
			const updated = draft.update({ fields: { lastName: 'Smith' } } as any)

			expect(updated.getField('firstName')).toBe('Alice')
			expect(updated.getField('lastName')).toBe('Smith')
		})

		test('overwrites existing field values', () => {
			const f = createSimpleForm()
			const draft = f.partialFill({ fields: { firstName: 'Alice' } } as any)
			const updated = draft.update({ fields: { firstName: 'Bob' } } as any)

			expect(updated.getField('firstName')).toBe('Bob')
		})

		test('throws on invalid patch in patch mode', () => {
			const f = createSimpleForm()
			const draft = f.partialFill()

			expect(() =>
				draft.update({ fields: { age: 'bad' } } as any)
			).toThrow()
		})

		test('returns new DraftForm instance', () => {
			const f = createSimpleForm()
			const draft = f.partialFill()
			const updated = draft.update({ fields: { firstName: 'X' } } as any)

			expect(updated).not.toBe(draft)
			expect(updated.phase).toBe('draft')
		})
	})

	// ========================================================================
	// safeUpdate
	// ========================================================================

	describe('safeUpdate', () => {
		test('returns success for valid patch', () => {
			const f = createSimpleForm()
			const draft = f.partialFill()
			const result = draft.safeUpdate({ fields: { firstName: 'Alice' } } as any)

			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.getField('firstName')).toBe('Alice')
			}
		})

		test('returns failure for invalid patch', () => {
			const f = createSimpleForm()
			const draft = f.partialFill()
			const result = draft.safeUpdate({ fields: { age: 'bad' } } as any)

			expect(result.success).toBe(false)
		})
	})

	// ========================================================================
	// getFillState
	// ========================================================================

	describe('getFillState', () => {
		test('reports all required as open when empty', () => {
			const f = createSimpleForm()
			const draft = f.partialFill()
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
			const draft = f.partialFill({ fields: { firstName: 'Alice', lastName: 'Smith' } } as any)
			const state = draft.getFillState()

			expect(state.summary.requiredDone).toBe(2)
			expect(state.summary.completionPercent).toBe(100)
			expect(state.done.filter(d => d.required).length).toBe(2)
		})

		test('reports blocked fields when visibility depends on unfilled field', () => {
			const f = createConditionalForm()
			const draft = f.partialFill()
			const state = draft.getFillState()

			// spouseName and dependentNames should be blocked
			const blockedKeys = state.blocked.map(b => b.key)
			expect(blockedKeys).toContain('spouseName')
			expect(blockedKeys).toContain('dependentNames')
		})

		test('unblocks fields when dependency is filled', () => {
			const f = createConditionalForm()
			const draft = f.partialFill({ fields: { hasSpouse: true } } as any)
			const state = draft.getFillState()

			// spouseName should now be open (visible because hasSpouse is true)
			const openKeys = state.openRequired.map(o => o.key)
			expect(openKeys).toContain('spouseName')
		})

		test('keeps conditional fields blocked when condition is false', () => {
			const f = createConditionalForm()
			const draft = f.partialFill({ fields: { hasSpouse: false, dependentCount: 0 } } as any)
			const state = draft.getFillState()

			// spouseName should be blocked (not visible because hasSpouse is false)
			const blockedKeys = state.blocked.map(b => b.key)
			expect(blockedKeys).toContain('spouseName')
			expect(blockedKeys).toContain('dependentNames')
		})

		test('reports defs values', () => {
			const f = createFormWithDefsAndRules()
			const draft = f.partialFill({ fields: { income: 100, expenses: 40 } } as any)
			const state = draft.getFillState()

			expect(state.defsValues.netIncome).toBe(60)
		})

		test('includes parties in fill state', () => {
			const f = createFormWithParties()
			const draft = f.partialFill()
			const state = draft.getFillState()

			// buyer is required, seller is not
			const openRequiredKeys = state.openRequired.map(o => o.key)
			expect(openRequiredKeys).toContain('buyer')
			expect(openRequiredKeys).toContain('amount')
			expect(openRequiredKeys).toContain('receipt')
		})

		test('includes annexes in fill state', () => {
			const f = createFormWithParties()
			const draft = f.partialFill()
			const state = draft.getFillState()

			// receipt is required, notes is optional
			const openOptionalKeys = state.openOptional.map(o => o.key)
			expect(openOptionalKeys).toContain('notes')
		})

		test('rules section reports valid/errors/warnings', () => {
			const f = createSimpleForm()
			const draft = f.partialFill()
			const state = draft.getFillState()

			// No rules defined → valid
			expect(state.rules.valid).toBe(true)
			expect(state.rules.errors).toEqual([])
			expect(state.rules.warnings).toEqual([])
		})
	})

	// ========================================================================
	// getAvailableFillTargets
	// ========================================================================

	describe('getAvailableFillTargets', () => {
		test('returns required targets in declaration order by default', () => {
			const f = createSimpleForm()
			const draft = f.partialFill()
			const targets = draft.getAvailableFillTargets()

			expect(targets.length).toBe(2) // only required: firstName, lastName
			expect(targets[0]!.key).toBe('firstName')
			expect(targets[1]!.key).toBe('lastName')
		})

		test('includes optional targets when requested', () => {
			const f = createSimpleForm()
			const draft = f.partialFill()
			const targets = draft.getAvailableFillTargets({ includeOptional: true })

			expect(targets.length).toBe(4)
		})

		test('orders parties before fields before annexes', () => {
			const f = createFormWithParties()
			const draft = f.partialFill()
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
			const draft = f.partialFill()
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
			const draft = f.partialFill()
			const targets = draft.getAvailableFillTargets({ includeOptional: true, requiredFirst: false })

			// Should be sorted by order (declaration order)
			for (let i = 1; i < targets.length; i++) {
				expect(targets[i]!.order).toBeGreaterThanOrEqual(targets[i - 1]!.order)
			}
		})

		test('multi-branch form shows correct candidates', () => {
			const f = createMultiBranchForm()
			const draft = f.partialFill({ fields: { entityType: 'person' } } as any)
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
			const draft = f.partialFill()
			const next = draft.getNextFillTarget()

			expect(next).not.toBeNull()
			expect(next!.key).toBe('firstName')
			expect(next!.required).toBe(true)
		})

		test('returns null when all required are filled', () => {
			const f = createSimpleForm()
			const draft = f.partialFill({
				fields: { firstName: 'Alice', lastName: 'Smith' },
			} as any)
			const next = draft.getNextFillTarget()

			expect(next).toBeNull()
		})

		test('returns optional target when includeOptional and all required done', () => {
			const f = createSimpleForm()
			const draft = f.partialFill({
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

		test('fill throws on missing required fields', () => {
			const f = createSimpleForm()
			expect(() => f.fill({ fields: {} } as any)).toThrow()
		})
	})

	// ========================================================================
	// End-to-end progressive flow
	// ========================================================================

	describe('progressive filling flow', () => {
		test('step-by-step filling with conditional fields', () => {
			const f = createConditionalForm()

			// Step 0: empty form
			const d0 = f.partialFill()
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
