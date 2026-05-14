import { describe, test, expect } from 'vitest'
import { jsonToLiteralType, jsonToDts, jsonToTsModule } from '@/codegen'

/**
 * Tests for codegen utilities that generate TypeScript from JSON artifacts
 */
describe('codegen', () => {
	// ============================================================================
	// jsonToLiteralType()
	// ============================================================================

	describe('jsonToLiteralType()', () => {
		describe('primitives', () => {
			test('converts null to "null"', () => {
				expect(jsonToLiteralType(null)).toBe('null')
			})

			test('converts undefined to "undefined"', () => {
				expect(jsonToLiteralType(undefined)).toBe('undefined')
			})

			test('converts strings to quoted literals', () => {
				expect(jsonToLiteralType('hello')).toBe('"hello"')
				expect(jsonToLiteralType('')).toBe('""')
				expect(jsonToLiteralType('with "quotes"')).toBe('"with \\"quotes\\""')
			})

			test('converts numbers to string representations', () => {
				expect(jsonToLiteralType(42)).toBe('42')
				expect(jsonToLiteralType(3.14)).toBe('3.14')
				expect(jsonToLiteralType(0)).toBe('0')
				expect(jsonToLiteralType(-1)).toBe('-1')
			})

			test('converts booleans to string representations', () => {
				expect(jsonToLiteralType(true)).toBe('true')
				expect(jsonToLiteralType(false)).toBe('false')
			})
		})

		describe('arrays', () => {
			test('converts empty array to readonly tuple', () => {
				expect(jsonToLiteralType([])).toBe('readonly []')
			})

			test('converts array of primitives to readonly tuple', () => {
				const result = jsonToLiteralType(['a', 'b', 'c'])
				expect(result).toContain('readonly [')
				expect(result).toContain('"a"')
				expect(result).toContain('"b"')
				expect(result).toContain('"c"')
			})

			test('converts array of mixed types', () => {
				const result = jsonToLiteralType(['text', 42, true, null])
				expect(result).toContain('"text"')
				expect(result).toContain('42')
				expect(result).toContain('true')
				expect(result).toContain('null')
			})

			test('converts nested arrays', () => {
				const result = jsonToLiteralType([[1, 2], [3, 4]])
				expect(result).toContain('readonly [')
				expect(result).toContain('1')
				expect(result).toContain('2')
				expect(result).toContain('3')
				expect(result).toContain('4')
			})
		})

		describe('objects', () => {
			test('converts empty object to {}', () => {
				expect(jsonToLiteralType({})).toBe('{}')
			})

			test('converts object with simple properties', () => {
				const result = jsonToLiteralType({ name: 'test', version: '1.0.0' })
				expect(result).toContain('readonly name: "test"')
				expect(result).toContain('readonly version: "1.0.0"')
			})

			test('converts object with mixed property types', () => {
				const result = jsonToLiteralType({
					name: 'test',
					count: 5,
					active: true,
					data: null,
				})
				expect(result).toContain('readonly name: "test"')
				expect(result).toContain('readonly count: 5')
				expect(result).toContain('readonly active: true')
				expect(result).toContain('readonly data: null')
			})

			test('quotes keys with special characters', () => {
				const result = jsonToLiteralType({ 'special-key': 'value', 'with space': 'x' })
				expect(result).toContain('readonly "special-key": "value"')
				expect(result).toContain('readonly "with space": "x"')
			})

			test('does not quote simple identifier keys', () => {
				const result = jsonToLiteralType({ name: 'test', _private: 'value', $var: 'x' })
				expect(result).toContain('readonly name: "test"')
				expect(result).toContain('readonly _private: "value"')
				expect(result).toContain('readonly $var: "x"')
			})
		})

		describe('nested structures', () => {
			test('converts deeply nested object', () => {
				const result = jsonToLiteralType({
					level1: {
						level2: {
							level3: 'deep',
						},
					},
				})
				expect(result).toContain('readonly level1:')
				expect(result).toContain('readonly level2:')
				expect(result).toContain('readonly level3: "deep"')
			})

			test('converts object with array property', () => {
				const result = jsonToLiteralType({
					items: ['a', 'b'],
				})
				expect(result).toContain('readonly items: readonly [')
			})

			test('converts array with object elements', () => {
				const result = jsonToLiteralType([
					{ id: 1 },
					{ id: 2 },
				])
				expect(result).toContain('readonly id: 1')
				expect(result).toContain('readonly id: 2')
			})
		})

		describe('real-world artifact schema', () => {
			test('converts a minimal form schema', () => {
				const schema = {
					kind: 'form',
					name: 'test-form',
					version: '1.0.0',
					title: 'Test Form',
					fields: {
						name: {
							type: 'text',
							label: 'Name',
						},
					},
				}

				const result = jsonToLiteralType(schema)
				expect(result).toContain('readonly kind: "form"')
				expect(result).toContain('readonly name: "test-form"')
				expect(result).toContain('readonly version: "1.0.0"')
				expect(result).toContain('readonly title: "Test Form"')
				expect(result).toContain('readonly fields:')
				expect(result).toContain('readonly type: "text"')
				expect(result).toContain('readonly label: "Name"')
			})
		})
	})

	// ============================================================================
	// jsonToDts()
	// ============================================================================

	describe('jsonToDts()', () => {
		test('generates declaration with header comment', () => {
			const result = jsonToDts({ test: 'value' })
			expect(result).toContain('/**')
			expect(result).toContain('* Auto-generated TypeScript declarations for JSON artifact')
			expect(result).toContain('* DO NOT EDIT')
		})

		test('includes module name in header when provided', () => {
			const result = jsonToDts({ test: 'value' }, 'w9.json')
			expect(result).toContain('* Source: w9.json')
		})

		test('declares schema constant with literal types', () => {
			const result = jsonToDts({ name: 'test', version: '1.0.0' })
			expect(result).toContain('declare const schema:')
			expect(result).toContain('readonly name: "test"')
			expect(result).toContain('readonly version: "1.0.0"')
		})

		test('exports schema as default', () => {
			const result = jsonToDts({ test: 'value' })
			expect(result).toContain('export default schema;')
		})

		test('generates valid TypeScript declaration syntax', () => {
			const schema = {
				kind: 'form',
				name: 'w9',
				version: '1.0.0',
				title: 'W-9 Form',
				fields: {
					taxpayerName: { type: 'text', label: 'Taxpayer Name' },
					tin: { type: 'text', label: 'TIN' },
				},
			}

			const result = jsonToDts(schema, 'w9.json')

			// Should have proper structure
			expect(result).toMatch(/declare const schema: \{/)
			expect(result).toMatch(/export default schema;/)

			// Should end with newline
			expect(result.endsWith('\n')).toBe(true)
		})
	})

	// ============================================================================
	// jsonToTsModule()
	// ============================================================================

	describe('jsonToTsModule()', () => {
		describe('header and imports', () => {
			test('generates header comment with artifact info', () => {
				const result = jsonToTsModule(
					{ kind: 'form', name: 'test' },
					{ artifactKind: 'form', exportName: 'test' }
				)
				expect(result).toContain('* Auto-generated TypeScript module for form artifact: test')
				expect(result).toContain('* DO NOT EDIT')
			})

			test('imports schema from JSON path when provided', () => {
				const result = jsonToTsModule(
					{ kind: 'form', name: 'w9' },
					{ artifactKind: 'form', exportName: 'w9', jsonImportPath: './w9.json' }
				)
				expect(result).toContain("import schema from './w9.json';")
			})

			test('embeds schema inline when no JSON path provided', () => {
				const schema = { kind: 'form', name: 'test' }
				const result = jsonToTsModule(
					schema,
					{ artifactKind: 'form', exportName: 'test' }
				)
				expect(result).toContain('const schema = {')
				expect(result).toContain('"kind": "form"')
				expect(result).toContain('} as const;')
			})

			test('imports open from @paradoc/sdk', () => {
				const result = jsonToTsModule(
					{ kind: 'form', name: 'test' },
					{ artifactKind: 'form', exportName: 'test' }
				)
				expect(result).toContain("import { para } from '@paradoc/sdk';")
			})
		})

		describe('artifact export', () => {
			test('exports form artifact with correct builder', () => {
				const result = jsonToTsModule(
					{ kind: 'form', name: 'w9' },
					{ artifactKind: 'form', exportName: 'w9' }
				)
				expect(result).toContain('export const w9 = para.form(schema);')
			})

			test('exports document artifact with correct builder', () => {
				const result = jsonToTsModule(
					{ kind: 'document', name: 'test-doc' },
					{ artifactKind: 'document', exportName: 'testDoc' }
				)
				expect(result).toContain('export const testDoc = para.document(schema);')
			})

			test('exports bundle artifact with correct builder', () => {
				const result = jsonToTsModule(
					{ kind: 'bundle', name: 'test-bundle' },
					{ artifactKind: 'bundle', exportName: 'testBundle' }
				)
				expect(result).toContain('export const testBundle = para.bundle(schema);')
			})

			test('exports checklist artifact with correct builder', () => {
				const result = jsonToTsModule(
					{ kind: 'checklist', name: 'test-checklist' },
					{ artifactKind: 'checklist', exportName: 'testChecklist' }
				)
				expect(result).toContain('export const testChecklist = para.checklist(schema);')
			})
		})

		describe('type exports', () => {
			test('exports artifact type with capitalized name', () => {
				const result = jsonToTsModule(
					{ kind: 'form', name: 'w9' },
					{ artifactKind: 'form', exportName: 'w9' }
				)
				expect(result).toContain('export type W9Form = typeof w9;')
			})

			test('exports payload type for forms', () => {
				const result = jsonToTsModule(
					{ kind: 'form', name: 'w9' },
					{ artifactKind: 'form', exportName: 'w9' }
				)
				expect(result).toContain('export type W9Payload = Parameters<typeof w9.fill>[0];')
			})

			test('exports payload type for checklists', () => {
				const result = jsonToTsModule(
					{ kind: 'checklist', name: 'test' },
					{ artifactKind: 'checklist', exportName: 'testChecklist' }
				)
				expect(result).toContain('export type TestChecklistChecklist = typeof testChecklist;')
				expect(result).toContain('export type TestChecklistPayload = Parameters<typeof testChecklist.fill>[0];')
			})

			test('does not export payload type for documents', () => {
				const result = jsonToTsModule(
					{ kind: 'document', name: 'test' },
					{ artifactKind: 'document', exportName: 'testDoc' }
				)
				expect(result).toContain('export type TestDocDocument = typeof testDoc;')
				expect(result).not.toContain('Payload')
			})

			test('does not export payload type for bundles', () => {
				const result = jsonToTsModule(
					{ kind: 'bundle', name: 'test' },
					{ artifactKind: 'bundle', exportName: 'testBundle' }
				)
				expect(result).toContain('export type TestBundleBundle = typeof testBundle;')
				expect(result).not.toContain('Payload')
			})
		})

		describe('JSDoc comments', () => {
			test('includes JSDoc for artifact export', () => {
				const result = jsonToTsModule(
					{ kind: 'form', name: 'w9' },
					{ artifactKind: 'form', exportName: 'w9' }
				)
				expect(result).toContain('/**')
				expect(result).toContain('* W9 form artifact - ready to use')
			})

			test('includes JSDoc for type export', () => {
				const result = jsonToTsModule(
					{ kind: 'form', name: 'w9' },
					{ artifactKind: 'form', exportName: 'w9' }
				)
				expect(result).toContain('* Type of the w9 form instance')
			})

			test('includes JSDoc for payload type', () => {
				const result = jsonToTsModule(
					{ kind: 'form', name: 'w9' },
					{ artifactKind: 'form', exportName: 'w9' }
				)
				expect(result).toContain('* Payload type for filling the w9 form')
			})
		})

		describe('complete output', () => {
			test('generates complete TypeScript module for form with JSON import', () => {
				const result = jsonToTsModule(
					{
						kind: 'form',
						name: 'w9',
						version: '1.0.0',
						title: 'W-9 Form',
						fields: {
							taxpayerName: { type: 'text', label: 'Taxpayer Name' },
						},
					},
					{
						artifactKind: 'form',
						exportName: 'w9',
						jsonImportPath: './w9.json',
					}
				)

				// Should have all expected parts
				expect(result).toContain('Auto-generated TypeScript module')
				expect(result).toContain("import schema from './w9.json';")
				expect(result).toContain("import { para } from '@paradoc/sdk';")
				expect(result).toContain('export const w9 = para.form(schema);')
				expect(result).toContain('export type W9Form = typeof w9;')
				expect(result).toContain('export type W9Payload = Parameters<typeof w9.fill>[0];')
			})

			test('generates complete TypeScript module for form with embedded schema', () => {
				const schema = {
					kind: 'form',
					name: 'simple',
					version: '1.0.0',
					title: 'Simple Form',
				}

				const result = jsonToTsModule(schema, {
					artifactKind: 'form',
					exportName: 'simpleForm',
				})

				// Should have embedded schema
				expect(result).toContain('const schema = {')
				expect(result).toContain('"kind": "form"')
				expect(result).toContain('"name": "simple"')
				expect(result).toContain('} as const;')

				// Should have exports
				expect(result).toContain('export const simpleForm = para.form(schema);')
				expect(result).toContain('export type SimpleFormForm = typeof simpleForm;')
			})
		})
	})
})
