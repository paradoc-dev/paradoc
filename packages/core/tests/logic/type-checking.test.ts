import { describe, test, expect } from 'vitest'
import { validateFormDefs, validateBundleDefs } from '@/logic/design-time/validation'
import { buildFormTypeEnvironment } from '@/logic/design-time/type-checking'
import { evaluateFormDefs } from '@/logic/runtime/evaluation/form-evaluator'
import type { Form, Bundle } from '@paradoc/types'
import type { LogicValidationIssue } from '@/logic/design-time/validation/validate-form-logic'

describe('Expression Type Checking', () => {
	describe('validateFormDefs - type checking', () => {
		test('type-checks indexed access through lists of lists', () => {
			const form: Form = {
				kind: 'form', name: 'matrix', fields: {
					matrix: { type: 'list', item: { type: 'list', item: { type: 'number' } } },
					positive: { type: 'text', visible: 'fields.matrix[0][1] > 0' },
				},
			}
			expect(validateFormDefs(form).issues).toBeUndefined()
		})

		test('rejects dynamic indices whose dependencies cannot be complete', () => {
			const form: Form = {
				kind: 'form', name: 'dynamic-index', fields: {
					matrix: { type: 'list', item: { type: 'number' } },
					index: { type: 'number' },
					positive: { type: 'text', visible: 'fields.matrix[fields.index] > 0' },
				},
			}
			expect(validateFormDefs(form).issues?.[0]?.message).toContain('Dynamic member access')
		})

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

	describe('definition expression coverage', () => {
		test('validates rules, party requirements, and payment expressions', () => {
			const form: Form = {
				kind: 'form',
				name: 'expression-sections',
				fields: {
					age: { type: 'number' },
					currency: { type: 'text' },
				},
				rules: {
					brokenSyntax: { expr: 'fields.age >=', message: 'Invalid syntax' },
					unknownFunction: { expr: 'missingFunction()', message: 'Unknown function' },
					wrongType: { expr: 'fields.age + 1', message: 'Must be a boolean' },
				},
				parties: {
					buyer: {
						label: 'Buyer',
						required: 'missingFunction()',
						payment: {
							amount: {
								type: 'money',
								value: {
									amount: 'fields.currency',
									currency: 'fields.age',
								},
							},
						},
					},
				},
			}

			const result = validateFormDefs(form)
			expect(result.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ path: ['rules', 'brokenSyntax', 'expr'] }),
					expect.objectContaining({ path: ['rules', 'unknownFunction', 'expr'] }),
					expect.objectContaining({ path: ['rules', 'wrongType', 'expr'] }),
					expect.objectContaining({ path: ['parties', 'buyer', 'required'] }),
					expect.objectContaining({
						path: ['parties', 'buyer', 'payment', 'amount', 'value', 'amount'],
					}),
					expect.objectContaining({
						path: ['parties', 'buyer', 'payment', 'amount', 'value', 'currency'],
					}),
				]),
			)
		})

		test('derives enum types and preserves nested object definition paths', () => {
			const form: Form = {
				kind: 'form',
				name: 'enum-types',
				fields: {
					level: { type: 'enum', enum: [{ value: 1 }, { value: 2 }] },
					status: { type: 'enum', enum: [{ value: 'new' }, { value: 'done' }] },
					mixed: { type: 'enum', enum: [{ value: 'new' }, { value: 1 }] },
					amount: { type: 'number' },
					currency: { type: 'text' },
						visibleWhenTotalIsHigh: { type: 'text', visible: 'isTotalHigh' },
					numericEnumGate: { type: 'text', visible: 'fields.level > 1' },
					},
					defs: {
						isTotalHigh: { type: 'boolean', value: 'total.amount > 10' },
						total: {
						type: 'money',
						value: { amount: 'fields.amount', currency: 'fields.currency' },
					},
				},
			}

			const env = buildFormTypeEnvironment(form)
			expect(env.resolve('fields.level')?.kind).toBe('number')
			expect(env.resolve('fields.status')?.kind).toBe('string')
			expect(env.resolve('fields.mixed')?.kind).toBe('unknown')
			expect(env.resolve('total.amount')?.kind).toBe('number')
			expect(validateFormDefs(form).issues).toBeUndefined()

			const evaluated = evaluateFormDefs(form, { fields: { level: 2, amount: 20, currency: 'USD' } })
			expect('value' in evaluated && evaluated.value.fields.get('visibleWhenTotalIsHigh')?.visible).toBe(true)
			expect('value' in evaluated && evaluated.value.defsValues.get('isTotalHigh')).toBe(true)
			expect('value' in evaluated && evaluated.value.fields.get('numericEnumGate')?.visible).toBe(true)
			const belowThreshold = evaluateFormDefs(form, { fields: { level: 1, amount: 20, currency: 'USD' } })
			expect('value' in belowThreshold && belowThreshold.value.fields.get('numericEnumGate')?.visible).toBe(false)
		})

		test('accepts valid rule, party, payment, and nested expressions', () => {
			const form: Form = {
				kind: 'form',
				name: 'valid-expression-sections',
				fields: {
					amount: { type: 'number' },
					address: {
						type: 'fieldset',
						fields: { postalCode: { type: 'text' } },
					},
				},
				rules: {
					amountIsPositive: { expr: 'amount > 0', message: 'Amount must be positive' },
				},
				parties: {
					buyer: {
						label: 'Buyer',
						required: 'partyCount("buyer") > 0',
						payment: {
							amount: {
								type: 'money',
								value: {
									amount: 'fields.amount',
									currency: '"USD"',
								},
							},
						},
					},
				},
			}

		expect(validateFormDefs(form).issues).toBeUndefined()
	})

		test('accepts direct nested field paths in rules', () => {
			const form: Form = {
				kind: 'form',
				name: 'direct-nested-rule-paths',
				fields: {
					amountRangeMin: { type: 'money' },
					amountRangeMax: { type: 'money' },
					address: { type: 'fieldset', fields: { postalCode: { type: 'text' } } },
				},
				rules: {
					rangeOrder: { expr: 'amountRangeMax.amount >= amountRangeMin.amount', message: 'Range is ordered' },
					postalCodePresent: { expr: 'address.postalCode != ""', message: 'Postal code is present' },
				},
			}

			expect(validateFormDefs(form).issues).toBeUndefined()
		})

		test('reports payment syntax and reference failures at their paths', () => {
			const forms: Form[] = [
				{
					kind: 'form',
					name: 'payment-syntax',
					fields: { amount: { type: 'number' } },
					parties: {
						buyer: {
							label: 'Buyer',
							payment: {
								amount: {
									type: 'money',
									value: { amount: 'fields.amount >=', currency: '"USD"' },
								},
							},
						},
					},
				},
				{
					kind: 'form',
					name: 'payment-reference',
					fields: { amount: { type: 'number' } },
					parties: {
						buyer: {
							label: 'Buyer',
							payment: {
								amount: {
									type: 'money',
									value: { amount: 'fields.amount', currency: 'fields.currency' },
								},
							},
						},
					},
				},
			]

			expect(validateFormDefs(forms[0]!).issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						path: ['parties', 'buyer', 'payment', 'amount', 'value', 'amount'],
					}),
				]),
			)
			expect(validateFormDefs(forms[1]!).issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						path: ['parties', 'buyer', 'payment', 'amount', 'value', 'currency'],
						variable: 'fields.currency',
					}),
				]),
			)
		})

		test('rejects a definition value whose result disagrees with its declared type', () => {
			const form: Form = {
				kind: 'form',
				name: 'typed-definition',
				fields: { label: { type: 'text' } },
				defs: { count: { type: 'number', value: 'fields.label' } },
			}

			const result = validateFormDefs(form)
			const issue = result.issues?.find(
				(candidate) => (candidate as LogicValidationIssue).path.join('.') === 'defs.count.value',
			) as LogicValidationIssue | undefined
			expect(issue).toBeDefined()
			expect(issue?.actualType).toBe('string')
			expect(issue?.expectedType).toBe('number')
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
