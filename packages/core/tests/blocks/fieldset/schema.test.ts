import { describe, test, expect } from 'vitest';
import { fieldset, field } from '@/artifacts';
import type { FormFieldset, NumberField, EnumField } from '@paradoc/types';

describe('Fieldset', () => {
	// ============================================================================
	// Object Pattern Tests
	// ============================================================================

	describe('Object Pattern', () => {
		describe('fieldset() - direct validation', () => {
			describe('success cases', () => {
				test('creates valid fieldset with minimal config', () => {
					const input: FormFieldset = {
						fields: {
							name: { type: 'text' },
						},
					};
					const result = fieldset(input);
					expect(result.fields!.name!.type).toBe('text');
				});

				test('creates fieldset with title', () => {
					const input: FormFieldset = {
						title: 'Contact Information',
						fields: {
							email: { type: 'email' },
						},
					};
					const result = fieldset(input);
					expect(result.title).toBe('Contact Information');
				});

				test('creates fieldset with description', () => {
					const input: FormFieldset = {
						title: 'Address',
						description: 'Enter your mailing address',
						fields: {
							street: { type: 'text' },
							city: { type: 'text' },
						},
					};
					const result = fieldset(input);
					expect(result.description).toBe('Enter your mailing address');
				});

				test('creates fieldset with multiple fields of different types', () => {
					const input: FormFieldset = {
						fields: {
							name: { type: 'text', label: 'Full Name' },
							age: { type: 'number', label: 'Age', min: 0, max: 120 } as NumberField,
							email: { type: 'email', label: 'Email' },
							subscribe: { type: 'boolean', label: 'Subscribe' },
						},
					};
					const result = fieldset(input);
					expect(Object.keys(result.fields)).toHaveLength(4);
					expect(result.fields!.name!.type).toBe('text');
					expect(result.fields!.age!.type).toBe('number');
				});

				test('creates fieldset with required flag', () => {
					const input: FormFieldset = {
						fields: {
							field1: { type: 'text' },
						},
						required: true,
					};
					const result = fieldset(input);
					expect(result.required).toBe(true);
				});

				test('creates fieldset with order', () => {
					const input: FormFieldset = {
						fields: {
							field1: { type: 'text' },
						},
						order: 1,
					};
					const result = fieldset(input);
					expect(result.order).toBe(1);
				});

				test('creates fieldset with all properties', () => {
					const input: FormFieldset = {
						title: 'Complete Information',
						description: 'All required fields',
						fields: {
							name: { type: 'text', label: 'Name', required: true },
							email: { type: 'email', label: 'Email', required: true },
						},
						required: true,
						order: 1,
					};
					const result = fieldset(input);
					expect(result).toEqual(input);
				});

				test('creates fieldset with nested fieldset', () => {
					const input: FormFieldset = {
						fields: {
							personal: {
								type: 'fieldset',
								label: 'Personal Info',
								fields: {
									name: { type: 'text' },
									age: { type: 'number' },
								},
							},
						},
					};
					const result = fieldset(input);
					const fields = result.fields as any;
					expect(fields.personal.type).toBe('fieldset');
					expect(fields.personal.fields.name.type).toBe('text');
				});

				test('creates fieldset with deeply nested fieldsets', () => {
					const input: FormFieldset = {
						fields: {
							level1: {
								type: 'fieldset',
								fields: {
									level2: {
										type: 'fieldset',
										fields: {
											name: { type: 'text' },
										},
									},
								},
							},
						},
					};
					const result = fieldset(input);
					const fields = result.fields as any;
					expect(fields.level1.fields.level2.type).toBe('fieldset');
				});

				test('creates fieldset with various field types', () => {
					const input: FormFieldset = {
						fields: {
							textField: { type: 'text' },
							numberField: { type: 'number' },
							booleanField: { type: 'boolean' },
							emailField: { type: 'email' },
							enumField: { type: 'enum', enum: [{ value: 'a' }, { value: 'b' }, { value: 'c' }] } as EnumField,
							moneyField: { type: 'money' },
							addressField: { type: 'address' },
							phoneField: { type: 'phone' },
							coordinateField: { type: 'coordinate' },
						},
					};
					const result = fieldset(input);
					expect(Object.keys(result.fields)).toHaveLength(9);
				});

				test('creates fieldset with order value 0', () => {
					const input: FormFieldset = {
						fields: { field1: { type: 'text' } },
						order: 0,
					};
					const result = fieldset(input);
					expect(result.order).toBe(0);
				});

				test('creates fieldset with large order value', () => {
					const input: FormFieldset = {
						fields: { field1: { type: 'text' } },
						order: 9999,
					};
					const result = fieldset(input);
					expect(result.order).toBe(9999);
				});
			});

			describe('validation failures', () => {
				test('throws error when fields is invalid', () => {
					const input = { fields: 'not-an-object' } as any;
					expect(() => fieldset(input)).toThrow();
				});

				test('throws error when title is empty string', () => {
					const input = {
						title: '',
						fields: { field1: { type: 'text' } },
					} as any;
					expect(() => fieldset(input)).toThrow();
				});

				test('throws error when title exceeds maxLength', () => {
					const input = {
						title: 'a'.repeat(201),
						fields: { field1: { type: 'text' } },
					} as any;
					expect(() => fieldset(input)).toThrow();
				});

				test('throws error when description is empty string', () => {
					const input = {
						description: '',
						fields: { field1: { type: 'text' } },
					} as any;
					expect(() => fieldset(input)).toThrow();
				});

				test('throws error when description exceeds maxLength', () => {
					const input = {
						description: 'a'.repeat(1001),
						fields: { field1: { type: 'text' } },
					} as any;
					expect(() => fieldset(input)).toThrow();
				});

				test('accepts empty fields object', () => {
					const input = {
						fields: {},
					} as any;
					const result = fieldset(input);
					expect(result.fields).toEqual({});
				});

				test('throws error when order is negative', () => {
					const input = {
						fields: { field1: { type: 'text' } },
						order: -1,
					} as any;
					expect(() => fieldset(input)).toThrow();
				});

				test('throws error when field definition is invalid', () => {
					const input = {
						fields: {
							invalid: { type: 'invalid-type' },
						},
					} as any;
					expect(() => fieldset(input)).toThrow();
				});

				test('rejects additional properties (strict validation)', () => {
					const input = {
						fields: { field1: { type: 'text' } },
						extra: 'should be removed',
					} as any;
					expect(() => fieldset(input)).toThrow();
				});
			});
		});

		describe('fieldset.parse()', () => {
			describe('success cases', () => {
				test('parses valid fieldset', () => {
					const input = {
						fields: { name: { type: 'text' } },
					};
					const result = fieldset.parse(input);
					expect(result).toEqual(input);
				});

				test('parses fieldset with all properties', () => {
					const input = {
						title: 'Complete',
						description: 'A complete fieldset',
						fields: { field1: { type: 'text' } },
						required: true,
						order: 1,
					};
					const result = fieldset.parse(input);
					expect(result).toEqual(input);
				});
			});

			describe('validation failures', () => {
				test('throws error for missing fields', () => {
					expect(() => fieldset.parse({})).toThrow();
				});

				test('throws error when input is null', () => {
					expect(() => fieldset.parse(null)).toThrow();
				});

				test('throws error when input is undefined', () => {
					expect(() => fieldset.parse(undefined)).toThrow();
				});
			});
		});

		describe('fieldset.safeParse()', () => {
			describe('success cases', () => {
				test('returns success for valid fieldset', () => {
					const input = {
						fields: { name: { type: 'text' } },
					};
					const result = fieldset.safeParse(input);
					expect(result.success).toBe(true);
					if (result.success) {
						expect(result.data).toEqual(input);
					}
				});

				test('returns success for fieldset with nested fields', () => {
					const input = {
						fields: {
							child: {
								type: 'fieldset',
								fields: {
									name: { type: 'text' },
								},
							},
						},
					};
					const result = fieldset.safeParse(input);
					expect(result.success).toBe(true);
				});
			});

			describe('failure cases', () => {
				test('returns error for missing fields', () => {
					const input = {};
					const result = fieldset.safeParse(input);
					expect(result.success).toBe(false);
				});

				test('returns error for null input', () => {
					const result = fieldset.safeParse(null);
					expect(result.success).toBe(false);
				});

				test('returns error for undefined input', () => {
					const result = fieldset.safeParse(undefined);
					expect(result.success).toBe(false);
				});

				test('returns error when order is negative', () => {
					const input = {
						fields: { field1: { type: 'text' } },
						order: -1,
					};
					const result = fieldset.safeParse(input);
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
				test('builds valid fieldset with minimal config', () => {
					const result = fieldset().field('name', field.text().build()).build();
					expect(result.fields!.name!.type).toBe('text');
				});

				test('builds fieldset with title', () => {
					const result = fieldset()
						.title('Contact Information')
						.field('email', field.email().build())
						.build();
					expect(result.title).toBe('Contact Information');
				});

				test('builds fieldset with description', () => {
					const result = fieldset()
						.title('Address')
						.description('Enter your mailing address')
						.fields({
							street: field.text().build(),
							city: field.text().build(),
						})
						.build();
					expect(result.description).toBe('Enter your mailing address');
				});

				test('builds fieldset with multiple fields using fields() method', () => {
					const result = fieldset()
						.fields({
							name: field.text().label('Full Name').build(),
							age: field.number().label('Age').min(0).max(120).build(),
							email: field.email().label('Email').build(),
							subscribe: field.boolean().label('Subscribe').build(),
						})
						.build();
					expect(Object.keys(result.fields!)).toHaveLength(4);
					expect(result.fields!.name!.label).toBe('Full Name');
				});

				test('builds fieldset with multiple fields using field() method', () => {
					const result = fieldset()
						.field('name', field.text().label('Full Name').build())
						.field('age', field.number().label('Age').build())
						.field('email', field.email().label('Email').build())
						.build();
					expect(Object.keys(result.fields)).toHaveLength(3);
				});

				test('builds fieldset with required flag', () => {
					const result = fieldset()
						.field('field1', field.text().build())
						.required()
						.build();
					expect(result.required).toBe(true);
				});

				test('builds fieldset with explicit required false', () => {
					const result = fieldset()
						.field('field1', field.text().build())
						.required(false)
						.build();
					expect(result.required).toBe(false);
				});

				test('builds fieldset with order', () => {
					const result = fieldset().field('field1', field.text().build()).order(1).build();
					expect(result.order).toBe(1);
				});

				test('builds fieldset with all properties', () => {
					const result = fieldset()
						.title('Complete Information')
						.description('All required fields')
						.fields({
							name: field.text().label('Name').required().build(),
							email: field.email().label('Email').required().build(),
						})
						.required()
						.order(1)
						.build();
					expect(result.title).toBe('Complete Information');
					expect(result.required).toBe(true);
					expect(result.order).toBe(1);
				});

				test('builds fieldset with nested fieldset', () => {
					const result = fieldset()
						.field(
							'personal',
							field
								.fieldset()
								.label('Personal Info')
								.fields({
									name: field.text().build(),
									age: field.number().build(),
								})
								.build()
						)
						.build();
					expect(result.fields!.personal!.type).toBe('fieldset');
					const fields = result.fields as any;
					expect(fields.personal.fields.name.type).toBe('text');
				});

				test('builds fieldset with deeply nested fieldsets', () => {
					const result = fieldset()
						.field(
							'level1',
							field
								.fieldset()
								.fields({
									level2: field
										.fieldset()
										.fields({
											name: field.text().build(),
										})
										.build(),
								})
								.build()
						)
						.build();
					const fields = result.fields as any;
					expect(fields.level1.fields.level2.type).toBe('fieldset');
				});

				test('builds fieldset with various field types', () => {
					const result = fieldset()
						.fields({
							textField: field.text().build(),
							numberField: field.number().build(),
							booleanField: field.boolean().build(),
							emailField: field.email().build(),
							enumField: field.enum().options([{ value: 'a' }, { value: 'b' }, { value: 'c' }]).build(),
							moneyField: field.money().build(),
							addressField: field.address().build(),
							phoneField: field.phone().build(),
							coordinateField: field.coordinate().build(),
						})
						.build();
					expect(Object.keys(result.fields)).toHaveLength(9);
				});

				test('supports method chaining', () => {
					const result = fieldset()
						.title('Test')
						.description('Description')
						.required()
						.order(1)
						.field('name', field.text().build())
						.build();
					expect(result.title).toBe('Test');
					expect(result.description).toBe('Description');
				});

				test('allows overwriting title', () => {
					const result = fieldset()
						.title('Original')
						.title('Updated')
						.field('name', field.text().build())
						.build();
					expect(result.title).toBe('Updated');
				});

				test('allows overwriting description', () => {
					const result = fieldset()
						.description('Original')
						.description('Updated')
						.field('name', field.text().build())
						.build();
					expect(result.description).toBe('Updated');
				});

				test('allows adding fields incrementally', () => {
					const builder = fieldset()
						.field('field1', field.text().build())
						.field('field2', field.number().build());
					const result = builder.build();
					expect(Object.keys(result.fields)).toHaveLength(2);
				});

				test('allows mixing field() and fields() methods', () => {
					const result = fieldset()
						.field('field1', field.text().build())
						.fields({
							field2: field.number().build(),
							field3: field.boolean().build(),
						})
						.field('field4', field.email().build())
						.build();
					expect(Object.keys(result.fields)).toHaveLength(4);
				});

				test('builds fieldset with order value 0', () => {
					const result = fieldset().field('field1', field.text().build()).order(0).build();
					expect(result.order).toBe(0);
				});

				test('builds fieldset with large order value', () => {
					const result = fieldset().field('field1', field.text().build()).order(9999).build();
					expect(result.order).toBe(9999);
				});

				test('builds fieldset with undefined title', () => {
					const result = fieldset()
						.title(undefined)
						.field('field1', field.text().build())
						.build();
					expect(result.title).toBeUndefined();
				});

				test('builds fieldset with undefined description', () => {
					const result = fieldset()
						.description(undefined)
						.field('field1', field.text().build())
						.build();
					expect(result.description).toBeUndefined();
				});

				test('builds fieldset with undefined order', () => {
					const result = fieldset()
						.order(undefined)
						.field('field1', field.text().build())
						.build();
					expect(result.order).toBeUndefined();
				});
			});

			describe('validation failures on build()', () => {
				test('throws error when title is empty string', () => {
					expect(() =>
						fieldset().title('').field('field1', field.text().build()).build()
					).toThrow();
				});

				test('throws error when title exceeds maxLength', () => {
					expect(() =>
						fieldset()
							.title('a'.repeat(201))
							.field('field1', field.text().build())
							.build()
					).toThrow();
				});

				test('throws error when description is empty string', () => {
					expect(() =>
						fieldset().description('').field('field1', field.text().build()).build()
					).toThrow();
				});

				test('throws error when description exceeds maxLength', () => {
					expect(() =>
						fieldset()
							.description('a'.repeat(1001))
							.field('field1', field.text().build())
							.build()
					).toThrow();
				});

				test('throws error when order is negative', () => {
					expect(() =>
						fieldset().field('field1', field.text().build()).order(-1).build()
					).toThrow();
				});

				test('throws error when field definition is invalid', () => {
					expect(() =>
						fieldset().field('invalid', { type: 'invalid' } as any).build()
					).toThrow();
				});
			});

			describe('builder instance behavior', () => {
				test('returns builder instance when called with no args', () => {
					const builder = fieldset();
					expect(builder).toBeDefined();
					expect(typeof builder.title).toBe('function');
					expect(typeof builder.field).toBe('function');
					expect(typeof builder.fields).toBe('function');
					expect(typeof builder.build).toBe('function');
				});

				test('builder methods return this for chaining', () => {
					const builder = fieldset();
					const afterTitle = builder.title('Test');
					const afterField = afterTitle.field('name', field.text().build());
					expect(afterTitle).toBe(builder);
					expect(afterField).toBe(builder);
				});

				test('multiple builders are independent', () => {
					const builder1 = fieldset().title('Test 1');
					const builder2 = fieldset().title('Test 2');
					builder1.field('field1', field.text().build());
					builder2.field('field2', field.number().build());
					expect(builder1.build().title).toBe('Test 1');
					expect(builder2.build().title).toBe('Test 2');
				});

				test('builder can be reused after build', () => {
					const builder = fieldset().field('name', field.text().build());
					const result1 = builder.build();
					const result2 = builder.build();
					expect(result1).toEqual(result2);
				});

				test('modifying builder after build affects subsequent builds', () => {
					const builder = fieldset().title('Original');
					builder.field('field1', field.text().build());
					const result1 = builder.build();

					builder.title('Modified');
					const result2 = builder.build();

					expect(result1.title).toBe('Original');
					expect(result2.title).toBe('Modified');
				});
			});

			describe('builder pattern vs object pattern comparison', () => {
				test('builder pattern produces same result as object pattern', () => {
					const builderResult = fieldset()
						.title('Test Section')
						.field('name', field.text().label('Name').build())
						.required()
						.build();

					const objectResult = fieldset({
						title: 'Test Section',
						fields: {
							name: { type: 'text', label: 'Name' },
						},
						required: true,
					});

					expect(builderResult).toEqual(objectResult);
				});

				test('builder validates on build(), object validates immediately', () => {
					// Builder - no error until build()
					const builder = fieldset();
					expect(() => builder.title('').build()).toThrow();

					// Object - error immediately
					expect(() =>
						fieldset({
							title: '',
							fields: { field1: { type: 'text' } },
						} as any)
					).toThrow();
				});
			});

			describe('common usage patterns', () => {
				test('creates personal information section', () => {
					const result = fieldset()
						.title('Personal Information')
						.description('Please provide your personal details')
						.fields({
							firstName: field.text().label('First Name').required().build(),
							lastName: field.text().label('Last Name').required().build(),
							email: field.email().label('Email').required().build(),
							phone: field.phone().label('Phone Number').build(),
						})
						.required()
						.order(1)
						.build();

					expect(result.title).toBe('Personal Information');
					expect(Object.keys(result.fields)).toHaveLength(4);
				});

				test('creates address section', () => {
					const result = fieldset()
						.title('Address')
						.fields({
							street: field.text().label('Street Address').required().build(),
							city: field.text().label('City').required().build(),
							state: field.text().label('State').build(),
							zip: field.text().label('ZIP Code').build(),
						})
						.build();

					expect(Object.keys(result.fields)).toHaveLength(4);
				});

				test('creates nested contact information', () => {
					const result = fieldset()
						.title('Contact Information')
						.field(
							'personal',
							field
								.fieldset()
								.label('Personal Contact')
								.fields({
									email: field.email().label('Email').build(),
									phone: field.phone().label('Phone').build(),
								})
								.build()
						)
						.field(
							'business',
							field
								.fieldset()
								.label('Business Contact')
								.fields({
									email: field.email().label('Business Email').build(),
									phone: field.phone().label('Business Phone').build(),
								})
								.build()
						)
						.build();

					expect(result.fields!.personal!.type).toBe('fieldset');
					expect(result.fields!.business!.type).toBe('fieldset');
				});

				test('creates optional preferences section', () => {
					const result = fieldset()
						.title('Preferences')
						.description('Optional settings')
						.fields({
							newsletter: field.boolean().label('Subscribe to newsletter').build(),
							notifications: field.boolean().label('Enable notifications').build(),
							theme: field.enum().label('Theme').options([{ value: 'light' }, { value: 'dark' }]).build(),
						})
						.required(false)
						.order(99)
						.build();

					expect(result.required).toBe(false);
					expect(result.order).toBe(99);
				});
			});
		});
	});
});
