import { describe, test, expect } from 'vitest'
import { validateFormDefs, validateBundleDefs } from '@/logic/design-time/validation'
import type { Form, Bundle } from '@paradoc/types'
import type { LogicValidationIssue } from '@/logic/design-time/validation/validate-form-logic'

describe('Expression Type Checking', () => {
	describe('validateFormDefs - type checking', () => {
		test('passes when visible expression returns boolean (comparison)', () => {
			const form: Form = {
				kind: 'form',
				version: '1.0.0',
				name: 'test-form',
				title: 'Test Form',
				fields: {
					age: { type: 'number', label: 'Age' },
					consent: {
						type: 'boolean',
						label: 'Consent',
						visible: 'fields.age >= 18',
					},
				},
			}

			const result = validateFormDefs(form)
			expect(result.issues).toBeUndefined()
			expect('value' in result && result.value).toBeDefined()
		})

		test('passes when required expression returns boolean (logic key)', () => {
			const form: Form = {
				kind: 'form',
				version: '1.0.0',
				name: 'test-form',
				title: 'Test Form',
				defs: {
					isAdult: { type: 'boolean', value: 'fields.age >= 18' },
				},
				fields: {
					age: { type: 'number', label: 'Age' },
					taxId: {
						type: 'text',
						label: 'Tax ID',
						required: 'isAdult',
					},
				},
			}

			const result = validateFormDefs(form)
			expect(result.issues).toBeUndefined()
			expect('value' in result && result.value).toBeDefined()
		})

		test('passes with boolean literal expressions', () => {
			const form: Form = {
				kind: 'form',
				version: '1.0.0',
				name: 'test-form',
				title: 'Test Form',
				fields: {
					name: {
						type: 'text',
						label: 'Name',
						required: true,
						visible: true,
					},
				},
			}

			const result = validateFormDefs(form)
			expect(result.issues).toBeUndefined()
		})

		test('passes with logical operators (and, or, not)', () => {
			const form: Form = {
				kind: 'form',
				version: '1.0.0',
				name: 'test-form',
				title: 'Test Form',
				fields: {
					age: { type: 'number', label: 'Age' },
					hasLicense: { type: 'boolean', label: 'Has License' },
					canDrive: {
						type: 'boolean',
						label: 'Can Drive',
						visible: 'fields.age >= 16 and fields.hasLicense',
					},
					needsParent: {
						type: 'boolean',
						label: 'Needs Parent',
						visible: 'not (fields.age >= 18)',
					},
				},
			}

			const result = validateFormDefs(form)
			expect(result.issues).toBeUndefined()
		})

		test('fails with ERROR when visible expression returns number', () => {
			const form: Form = {
				kind: 'form',
				version: '1.0.0',
				name: 'test-form',
				title: 'Test Form',
				fields: {
					age: { type: 'number', label: 'Age' },
					info: {
						type: 'text',
						label: 'Info',
						visible: 'fields.age + 10', // Returns number, not boolean
					},
				},
			}

			const result = validateFormDefs(form)
			expect(result.issues).toBeDefined()
			expect(result.issues?.length).toBeGreaterThan(0)

			const issue = result.issues?.[0] as LogicValidationIssue
			expect(issue.severity).toBe('error')
			expect(issue.actualType).toBe('number')
			expect(issue.expectedType).toBe('boolean')
			expect(issue.path).toContain('visible')
		})

		test('fails with ERROR when required expression returns string (using text field)', () => {
			const form: Form = {
				kind: 'form',
				version: '1.0.0',
				name: 'test-form',
				title: 'Test Form',
				fields: {
					name: { type: 'text', label: 'Name' },
					info: {
						type: 'text',
						label: 'Info',
						// Text field returns string, not boolean
						required: 'fields.name',
					},
				},
			}

			const result = validateFormDefs(form)
			expect(result.issues).toBeDefined()

			const issue = result.issues?.[0] as LogicValidationIssue
			expect(issue.severity).toBe('error')
			expect(issue.actualType).toBe('string')
		})

		test('fails with ERROR when logic key returns non-boolean (transitive check)', () => {
			const form: Form = {
				kind: 'form',
				version: '1.0.0',
				name: 'test-form',
				title: 'Test Form',
				defs: {
					// This logic key returns a number, not boolean
					ageCalc: { type: 'boolean', value: 'fields.age + 10' },
				},
				fields: {
					age: { type: 'number', label: 'Age' },
					info: {
						type: 'text',
						label: 'Info',
						// Using ageCalc which returns number - should fail
						visible: 'ageCalc',
					},
				},
			}

			const result = validateFormDefs(form)
			expect(result.issues).toBeDefined()

			const issue = result.issues?.[0] as LogicValidationIssue
			expect(issue.severity).toBe('error')
			expect(issue.actualType).toBe('number')
		})

		test('passes when logic key returns boolean transitively', () => {
			const form: Form = {
				kind: 'form',
				version: '1.0.0',
				name: 'test-form',
				title: 'Test Form',
				defs: {
					isAdult: { type: 'boolean', value: 'fields.age >= 18' },
					isVeryOld: { type: 'boolean', value: 'fields.age >= 65' },
					needsSpecialForm: { type: 'boolean', value: 'isAdult and isVeryOld' },
				},
				fields: {
					age: { type: 'number', label: 'Age' },
					specialInfo: {
						type: 'text',
						label: 'Special Info',
						visible: 'needsSpecialForm',
					},
				},
			}

			const result = validateFormDefs(form)
			expect(result.issues).toBeUndefined()
		})

		test('warns when expression type is unknown (unknown variable)', () => {
			const form: Form = {
				kind: 'form',
				version: '1.0.0',
				name: 'test-form',
				title: 'Test Form',
				fields: {
					data: { type: 'text', label: 'Data' },
					info: {
						type: 'text',
						label: 'Info',
						// externalVar is not defined - should result in unknown type warning
						// (after the unknown variable error from syntax validation)
						visible: 'externalVar',
					},
				},
			}

			const result = validateFormDefs(form)
			// Should have issues (unknown variable + type warning)
			expect(result.issues).toBeDefined()
			expect(result.issues?.length).toBeGreaterThan(0)

			// First issue is the unknown variable error (from syntax validation)
			const issue = result.issues?.[0] as LogicValidationIssue
			expect(issue.message).toContain('Unknown variable')
		})

		test('validates nested fieldset expressions', () => {
			const form: Form = {
				kind: 'form',
				version: '1.0.0',
				name: 'test-form',
				title: 'Test Form',
				fields: {
					age: { type: 'number', label: 'Age' },
					address: {
						type: 'fieldset',
						label: 'Address',
						fields: {
							city: {
								type: 'text',
								label: 'City',
								visible: 'fields.age >= 18', // Valid boolean
							},
							state: {
								type: 'text',
								label: 'State',
								visible: 'fields.age + 1', // Invalid - returns number
							},
						},
					},
				},
			}

			const result = validateFormDefs(form)
			expect(result.issues).toBeDefined()

			// Should have error for the state field
			const stateIssue = result.issues?.find(
				(i) => (i as LogicValidationIssue).path.includes('state')
			) as LogicValidationIssue
			expect(stateIssue).toBeDefined()
			expect(stateIssue.severity).toBe('error')
		})

		test('validates annex expressions', () => {
			const form: Form = {
				kind: 'form',
				version: '1.0.0',
				name: 'test-form',
				title: 'Test Form',
				fields: {
					amount: { type: 'number', label: 'Amount' },
				},
				annexes: {
					receipt: {
						title: 'Receipt',
						required: 'fields.amount > 100', // Valid boolean
					},
					invoice: {
						title: 'Invoice',
						visible: 'fields.amount * 2', // Invalid - returns number
					},
				},
			}

			const result = validateFormDefs(form)
			expect(result.issues).toBeDefined()

			const invoiceIssue = result.issues?.find(
				(i) => (i as LogicValidationIssue).path.includes('invoice')
			) as LogicValidationIssue
			expect(invoiceIssue).toBeDefined()
			expect(invoiceIssue.severity).toBe('error')
		})
	})

	describe('validateBundleDefs - type checking', () => {
		test('passes when include expression returns boolean', () => {
			const form: Form = {
				kind: 'form',
				version: '1.0.0',
				name: 'main-form',
				title: 'Main Form',
				fields: {
					amount: { type: 'number', label: 'Amount' },
				},
			}

			const bundle: Bundle = {
				kind: 'bundle',
				version: '1.0.0',
				name: 'test-bundle',
				title: 'Test Bundle',
				defs: {
					isHighValue: { type: 'boolean', value: 'forms.main.fields.amount > 1000' },
				},
				contents: [
					{ type: 'inline', key: 'main', artifact: form },
					{ type: 'registry', key: 'extra', slug: '@org/extra-form', include: 'isHighValue' },
				],
			}

			const result = validateBundleDefs(bundle)
			expect(result.issues).toBeUndefined()
		})

		test('fails when include expression returns non-boolean', () => {
			const form: Form = {
				kind: 'form',
				version: '1.0.0',
				name: 'main-form',
				title: 'Main Form',
				fields: {
					amount: { type: 'number', label: 'Amount' },
				},
			}

			const bundle: Bundle = {
				kind: 'bundle',
				version: '1.0.0',
				name: 'test-bundle',
				title: 'Test Bundle',
				defs: {
					// This returns a number, not boolean
					amountCalc: { type: 'boolean', value: 'forms.main.fields.amount + 100' },
				},
				contents: [
					{ type: 'inline', key: 'main', artifact: form },
					{ type: 'registry', key: 'extra', slug: '@org/extra-form', include: 'amountCalc' },
				],
			}

			const result = validateBundleDefs(bundle)
			expect(result.issues).toBeDefined()

			const issue = result.issues?.find(
				(i) => (i as LogicValidationIssue).path.includes('include')
			) as LogicValidationIssue
			expect(issue).toBeDefined()
			expect(issue.severity).toBe('error')
			expect(issue.actualType).toBe('number')
		})
	})

	describe('Field type to value type mapping', () => {
		test('correctly infers number field type', () => {
			const form: Form = {
				kind: 'form',
				version: '1.0.0',
				name: 'test-form',
				title: 'Test Form',
				fields: {
					count: { type: 'number', label: 'Count' },
					isPositive: {
						type: 'boolean',
						label: 'Is Positive',
						visible: 'fields.count > 0', // number comparison -> boolean
					},
				},
			}

			const result = validateFormDefs(form)
			expect(result.issues).toBeUndefined()
		})

		test('correctly infers string field type', () => {
			const form: Form = {
				kind: 'form',
				version: '1.0.0',
				name: 'test-form',
				title: 'Test Form',
				fields: {
					name: { type: 'text', label: 'Name' },
					nameLength: { type: 'number', label: 'Name Length' },
					hasName: {
						type: 'boolean',
						label: 'Has Name',
						// String comparison returns boolean
						visible: 'fields.name != ""',
					},
				},
			}

			const result = validateFormDefs(form)
			expect(result.issues).toBeUndefined()
		})

		test('correctly infers boolean field type', () => {
			const form: Form = {
				kind: 'form',
				version: '1.0.0',
				name: 'test-form',
				title: 'Test Form',
				fields: {
					accepted: { type: 'boolean', label: 'Accepted' },
					info: {
						type: 'text',
						label: 'Info',
						// Boolean field value is already boolean
						visible: 'fields.accepted',
					},
				},
			}

			const result = validateFormDefs(form)
			expect(result.issues).toBeUndefined()
		})
	})

	describe('collectAllErrors option', () => {
		test('collects all type errors when collectAllErrors is true', () => {
			const form: Form = {
				kind: 'form',
				version: '1.0.0',
				name: 'test-form',
				title: 'Test Form',
				fields: {
					age: { type: 'number', label: 'Age' },
					field1: {
						type: 'text',
						label: 'Field 1',
						visible: 'fields.age + 1', // Error 1
					},
					field2: {
						type: 'text',
						label: 'Field 2',
						visible: 'fields.age * 2', // Error 2
					},
					field3: {
						type: 'text',
						label: 'Field 3',
						required: 'fields.age - 5', // Error 3
					},
				},
			}

			const result = validateFormDefs(form, { collectAllErrors: true })
			expect(result.issues).toBeDefined()
			// Should have collected all 3 type errors
			expect(result.issues?.length).toBeGreaterThanOrEqual(3)
		})

		test('stops at first error when collectAllErrors is false', () => {
			const form: Form = {
				kind: 'form',
				version: '1.0.0',
				name: 'test-form',
				title: 'Test Form',
				fields: {
					age: { type: 'number', label: 'Age' },
					field1: {
						type: 'text',
						label: 'Field 1',
						visible: 'fields.age + 1', // Error 1
					},
					field2: {
						type: 'text',
						label: 'Field 2',
						visible: 'fields.age * 2', // Error 2
					},
				},
			}

			const result = validateFormDefs(form, { collectAllErrors: false })
			expect(result.issues).toBeDefined()
			// Should stop at first error
			expect(result.issues?.length).toBe(1)
		})
	})
})
