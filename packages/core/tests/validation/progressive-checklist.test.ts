import { describe, expect, test } from 'vitest'
import { checklist } from '@/artifacts'
import {
	validateChecklistItemInput,
	validateChecklistItemsPatch,
} from '@/validation'

function createChecklistForProgressiveValidation() {
	return checklist({
		name: 'onboarding-checklist',
		version: '1.0.0',
		title: 'Onboarding Checklist',
		items: [
			{ id: 'reviewed', title: 'Reviewed', status: { kind: 'boolean' } },
			{
				id: 'approval',
				title: 'Approval',
				status: {
					kind: 'enum',
					options: [
						{ value: 'pending', label: 'Pending' },
						{ value: 'approved', label: 'Approved' },
						{ value: 'rejected', label: 'Rejected' },
					],
				},
			},
		],
	})
}

describe('progressive checklist validation', () => {
	describe('standalone validators', () => {
		test('validates a boolean checklist item input', () => {
			const checklistInstance = createChecklistForProgressiveValidation()
			const result = validateChecklistItemInput(checklistInstance, {
				itemId: 'reviewed',
				value: true,
			})

			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.value).toBe(true)
			}
		})

		test('returns structured error for invalid enum status', () => {
			const checklistInstance = createChecklistForProgressiveValidation()
			const result = validateChecklistItemInput(checklistInstance, {
				itemId: 'approval',
				value: 'unknown',
			})

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.errors[0]?.field).toBe('items.approval')
				expect(result.errors[0]?.message).toContain('is not in')
			}
		})

		test('validates partial checklist items patch', () => {
			const checklistInstance = createChecklistForProgressiveValidation()
			const result = validateChecklistItemsPatch(checklistInstance, {
				reviewed: true,
				approval: 'approved',
			})

			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.value.reviewed).toBe(true)
				expect(result.value.approval).toBe('approved')
			}
		})

		test('rejects unknown checklist item id', () => {
			const checklistInstance = createChecklistForProgressiveValidation()
			const result = validateChecklistItemsPatch(checklistInstance, {
				unknown: true,
			})

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.errors[0]?.field).toBe('items.unknown')
				expect(result.errors[0]?.message).toContain('Unknown item')
			}
		})
	})

	describe('ChecklistInstance convenience methods', () => {
		test('delegates validateItemInput and validateItemsPatch', () => {
			const checklistInstance = createChecklistForProgressiveValidation()

			const itemResult = checklistInstance.validateItemInput({
				itemId: 'approval',
				value: 'pending',
			})
			expect(itemResult.success).toBe(true)

			const patchResult = checklistInstance.validateItemsPatch({
				reviewed: false,
			})
			expect(patchResult.success).toBe(true)
		})
	})
})
