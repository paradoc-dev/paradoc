import { describe, test, expect } from 'vitest';
import { annex } from '@/artifacts';
import type { FormAnnex } from '@paradoc/types';

describe('Annex', () => {
	// ============================================================================
	// Object Pattern Tests
	// ============================================================================

	describe('Object Pattern', () => {
		describe('annex() - direct validation', () => {
			describe('success cases', () => {
				test('creates valid annex with minimal config (empty object)', () => {
					const input: FormAnnex = {};
					const result = annex(input);
					expect(result).toEqual({});
				});

				test('creates annex with title', () => {
					const input: FormAnnex = {
						title: 'Exhibit A',
					};
					const result = annex(input);
					expect(result.title).toBe('Exhibit A');
				});

				test('creates annex with description', () => {
					const input: FormAnnex = {
						title: 'Appendix B',
						description: 'Technical specifications and requirements',
					};
					const result = annex(input);
					expect(result.description).toBe('Technical specifications and requirements');
				});

				test('creates annex with required flag', () => {
					const input: FormAnnex = {
						title: 'Mandatory Annex',
						required: true,
					};
					const result = annex(input);
					expect(result.required).toBe(true);
				});

				test('creates annex with required false', () => {
					const input: FormAnnex = {
						title: 'Optional Annex',
						required: false,
					};
					const result = annex(input);
					expect(result.required).toBe(false);
				});

				test('creates annex with order', () => {
					const input: FormAnnex = {
						title: 'Ordered Annex',
						order: 5,
					};
					const result = annex(input);
					expect(result.order).toBe(5);
				});

				test('creates annex with all properties', () => {
					const input: FormAnnex = {
						title: 'Complete Annex',
						description: 'A complete annex example',
						required: true,
						visible: true,
						order: 1,
					};
					const result = annex(input);
					expect(result).toEqual(input);
				});

				test('creates annex with long title', () => {
					const input: FormAnnex = {
						title: 'a'.repeat(200),
					};
					const result = annex(input);
					expect(result.title).toHaveLength(200);
				});

				test('creates annex with long description', () => {
					const input: FormAnnex = {
						title: 'Test Title',
						description: 'a'.repeat(1000),
					};
					const result = annex(input);
					expect(result.description).toHaveLength(1000);
				});
			});

			describe('validation failures', () => {
				test('throws error when title exceeds maxLength', () => {
					const input = {
						title: 'a'.repeat(201),
					} as any;
					expect(() => annex(input)).toThrow();
				});

				test('throws error when description is empty string', () => {
					const input = {
						title: 'Test',
						description: '',
					} as any;
					expect(() => annex(input)).toThrow();
				});

				test('throws error when description exceeds maxLength', () => {
					const input = {
						title: 'Test',
						description: 'a'.repeat(1001),
					} as any;
					expect(() => annex(input)).toThrow();
				});

				test('rejects additional properties (strict validation)', () => {
					const input = {
						title: 'Test',
						extra: 'should be removed',
					} as any;
					expect(() => annex(input)).toThrow();
				});
			});
		});

		describe('annex.parse()', () => {
			describe('success cases', () => {
				test('parses valid annex', () => {
					const input = {
						title: 'Test',
					};
					const result = annex.parse(input);
					expect(result).toEqual(input);
				});

				test('parses annex with all properties', () => {
					const input = {
						title: 'Complete',
						description: 'A complete annex',
						required: true,
						order: 2,
					};
					const result = annex.parse(input);
					expect(result).toEqual(input);
				});

				test('parses empty annex', () => {
					const input = {};
					const result = annex.parse(input);
					expect(result).toEqual(input);
				});
			});

			describe('validation failures', () => {
				test('throws error when input is null', () => {
					expect(() => annex.parse(null)).toThrow();
				});

				test('throws error when input is undefined', () => {
					expect(() => annex.parse(undefined)).toThrow();
				});

				test('throws error when title exceeds maxLength', () => {
					expect(() => annex.parse({ title: 'a'.repeat(201) })).toThrow();
				});
			});
		});

		describe('annex.safeParse()', () => {
			describe('success cases', () => {
				test('returns success for valid annex', () => {
					const input = {
						title: 'Test',
					};
					const result = annex.safeParse(input);
					expect(result.success).toBe(true);
					if (result.success) {
						expect(result.data).toEqual(input);
					}
				});

				test('returns success for annex with all properties', () => {
					const input = {
						title: 'Complete',
						description: 'Description',
						required: true,
					};
					const result = annex.safeParse(input);
					expect(result.success).toBe(true);
				});

				test('returns success for empty annex', () => {
					const input = {};
					const result = annex.safeParse(input);
					expect(result.success).toBe(true);
				});
			});

			describe('failure cases', () => {
				test('returns error for null input', () => {
					const result = annex.safeParse(null);
					expect(result.success).toBe(false);
				});

				test('returns error for undefined input', () => {
					const result = annex.safeParse(undefined);
					expect(result.success).toBe(false);
				});

				test('returns error when title exceeds maxLength', () => {
					const input = { title: 'a'.repeat(201) };
					const result = annex.safeParse(input);
					expect(result.success).toBe(false);
				});
			});
		});
	});

	// ============================================================================
	// Builder Pattern Tests
	// ============================================================================

	describe('Builder Pattern', () => {
		describe('fluent builder API', () => {
			describe('success cases', () => {
				test('builds valid annex with minimal config', () => {
					const result = annex().title('Exhibit A').build();
					expect(result.title).toBe('Exhibit A');
				});

				test('builds annex with description', () => {
					const result = annex()
						.title('Appendix B')
						.description('Technical specifications and requirements')
						.build();
					expect(result.description).toBe('Technical specifications and requirements');
				});

				test('builds annex with required flag', () => {
					const result = annex().title('Mandatory Annex').required().build();
					expect(result.required).toBe(true);
				});

				test('builds annex with explicit required false', () => {
					const result = annex()
						.title('Optional Annex')
						.required(false)
						.build();
					expect(result.required).toBe(false);
				});

				test('builds annex with order', () => {
					const result = annex().title('Ordered Annex').order(3).build();
					expect(result.order).toBe(3);
				});

				test('builds annex with all properties', () => {
					const result = annex()
						.title('Complete Annex')
						.description('A complete annex example')
						.required()
						.order(1)
						.build();
					expect(result.title).toBe('Complete Annex');
					expect(result.description).toBe('A complete annex example');
					expect(result.required).toBe(true);
					expect(result.order).toBe(1);
				});

				test('supports method chaining', () => {
					const result = annex()
						.title('Test')
						.description('Description')
						.required()
						.build();
					expect(result.title).toBe('Test');
					expect(result.description).toBe('Description');
					expect(result.required).toBe(true);
				});

				test('allows overwriting description', () => {
					const result = annex()
						.title('Test')
						.description('Original')
						.description('Updated')
						.build();
					expect(result.description).toBe('Updated');
				});

				test('builds empty annex', () => {
					const result = annex().build();
					expect(result).toEqual({});
				});
			});

			describe('validation failures on build()', () => {
				test('throws error when title exceeds maxLength', () => {
					expect(() => annex().title('a'.repeat(201)).build()).toThrow();
				});

				test('throws error when description is empty string', () => {
					expect(() => annex().title('Test').description('').build()).toThrow();
				});

				test('throws error when description exceeds maxLength', () => {
					expect(() =>
						annex().title('Test').description('a'.repeat(1001)).build()
					).toThrow();
				});
			});

			describe('builder instance behavior', () => {
				test('returns builder instance when called with no args', () => {
					const builder = annex();
					expect(builder).toBeDefined();
					expect(typeof builder.title).toBe('function');
					expect(typeof builder.description).toBe('function');
					expect(typeof builder.required).toBe('function');
					expect(typeof builder.order).toBe('function');
					expect(typeof builder.build).toBe('function');
				});

				test('builder methods return this for chaining', () => {
					const builder = annex();
					const afterTitle = builder.title('Test');
					const afterDescription = afterTitle.description('Description');
					const afterRequired = afterDescription.required();
					expect(afterTitle).toBe(builder);
					expect(afterDescription).toBe(builder);
					expect(afterRequired).toBe(builder);
				});

				test('multiple builders are independent', () => {
					const builder1 = annex().title('Test 1');
					const builder2 = annex().title('Test 2');
					expect(builder1.build().title).toBe('Test 1');
					expect(builder2.build().title).toBe('Test 2');
				});

				test('builder can be reused after build', () => {
					const builder = annex().title('Test Title');
					const result1 = builder.build();
					const result2 = builder.build();
					expect(result1).toEqual(result2);
				});

				test('modifying builder after build affects subsequent builds', () => {
					const builder = annex().title('Test').description('Original');
					const result1 = builder.build();

					builder.description('Modified');
					const result2 = builder.build();

					expect(result1.description).toBe('Original');
					expect(result2.description).toBe('Modified');
				});
			});

			describe('builder pattern vs object pattern comparison', () => {
				test('builder pattern produces same result as object pattern', () => {
					const builderResult = annex()
						.title('Test Annex')
						.description('Test description')
						.required()
						.build();

					const objectResult = annex({
						title: 'Test Annex',
						description: 'Test description',
						required: true,
					});

					expect(builderResult).toEqual(objectResult);
				});

				test('builder validates on build(), object validates immediately', () => {
					// Builder - no error until build()
					const builder = annex().title('Test');
					expect(() => builder.description('').build()).toThrow();

					// Object - error immediately
					expect(() =>
						annex({
							title: 'Test',
							description: '',
						} as any)
					).toThrow();
				});
			});

			describe('common usage patterns', () => {
				test('creates required exhibit annex', () => {
					const result = annex()
						.title('Exhibit A - Financial Statements')
						.description('Annual financial statements for 2023')
						.required()
						.build();

					expect(result.title).toBe('Exhibit A - Financial Statements');
					expect(result.required).toBe(true);
				});

				test('creates schedule annex', () => {
					const result = annex()
						.title('Schedule 1: Payment Terms')
						.description('Detailed payment schedule and terms')
						.build();

					expect(result.title).toBe('Schedule 1: Payment Terms');
				});

				test('creates appendix annex', () => {
					const result = annex()
						.title('Appendix B: Technical Specifications')
						.description('Technical requirements document')
						.build();

					expect(result.title).toBe('Appendix B: Technical Specifications');
				});

				test('creates optional annex', () => {
					const result = annex()
						.title('Optional Supporting Documentation')
						.description('May be provided at a later date')
						.required(false)
						.build();

					expect(result.required).toBe(false);
				});

				test('creates mandatory annex', () => {
					const result = annex().title('Required Documentation').required().build();

					expect(result.required).toBe(true);
				});
			});
		});
	});
});
