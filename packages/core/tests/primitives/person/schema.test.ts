import { describe, test, expect } from 'vitest';
import { person } from '@/primitives/person';
import type { Person } from '@paradoc/types';

describe('Person', () => {
	// ============================================================================
	// Object Pattern Tests
	// ============================================================================

	describe('Object Pattern', () => {
		describe('person() - direct validation', () => {
			describe('success cases', () => {
				test('creates valid person with name only', () => {
					const input = { name: 'John Doe' };
					const result = person(input as any);
					expect(result).toEqual({ name: 'John Doe' });
				});

				test('creates valid person with all fields', () => {
					const input = {
						name: 'Dr. Jane Marie Smith Jr.',
						title: 'Dr.',
						firstName: 'Jane',
						middleName: 'Marie',
						lastName: 'Smith',
						suffix: 'Jr.',
					};
					const result = person(input as any);
					expect(result).toEqual(input);
				});

				test('creates valid person with some optional fields', () => {
					const input = {
						name: 'Robert Johnson III',
						firstName: 'Robert',
						lastName: 'Johnson',
						suffix: 'III',
					};
					const result = person(input as any);
					expect(result).toEqual(input);
				});

				test('creates valid person with minimum length name', () => {
					const input = { name: 'A' };
					const result = person(input as any);
					expect(result).toEqual({ name: 'A' });
				});

				test('creates valid person with maximum length name', () => {
					const input = { name: 'a'.repeat(200) };
					const result = person(input as any);
					expect(result).toEqual({ name: 'a'.repeat(200) });
				});
			});

			describe('validation failures', () => {
				test('throws error when name is missing', () => {
					const input = { firstName: 'John' } as any;
					expect(() => person(input)).toThrow();
				});

				test('throws error when name is empty string', () => {
					const input = { name: '' } as any;
					expect(() => person(input)).toThrow();
				});

				test('throws error when name exceeds max length', () => {
					const input = { name: 'a'.repeat(201) } as any;
					expect(() => person(input)).toThrow();
				});

				test('throws error when name is null', () => {
					const input = { name: null } as any;
					expect(() => person(input)).toThrow();
				});

				test('strips additional properties', () => {
					const input = {
						name: 'John Doe',
						extra: 'field',
					} as any;
					const result = person(input);
					expect(result).toEqual({ name: 'John Doe' });
					expect(result).not.toHaveProperty('extra');
				});

				test('throws error when input is null', () => {
					expect(() => person(null as any)).toThrow();
				});

				test('returns builder when input is undefined', () => {
					const result = person(undefined as any);
					expect(result).toBeDefined();
					expect(typeof result.name).toBe('function');
				});
			});
		});

		describe('person.parse()', () => {
			test('parses valid person object', () => {
				const input = { name: 'John Doe' };
				const result = person.parse(input);
				expect(result).toEqual({ name: 'John Doe' });
			});

			test('throws error when name is missing', () => {
				const input = { firstName: 'John' };
				expect(() => person.parse(input)).toThrow();
			});

			test('strips additional properties', () => {
				const input = { name: 'John Doe', extra: 'value' };
				const result = person.parse(input);
				expect(result).toEqual({ name: 'John Doe' });
			});
		});

		describe('person.safeParse()', () => {
			test('returns success for valid person', () => {
				const input = { name: 'John Doe', firstName: 'John' };
				const result = person.safeParse(input);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.data).toEqual({ name: 'John Doe', firstName: 'John' });
				}
			});

			test('returns error when name is missing', () => {
				const input = { firstName: 'John' };
				const result = person.safeParse(input);

				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error).toBeInstanceOf(Error);
				}
			});

			test('returns error when name is empty', () => {
				const input = { name: '' };
				const result = person.safeParse(input);

				expect(result.success).toBe(false);
			});
		});
	});

	// ============================================================================
	// Builder Pattern Tests
	// ============================================================================

	describe('Builder Pattern', () => {
		describe('fluent builder API', () => {
			describe('success cases', () => {
				test('builds valid person with name only', () => {
					const result = person().name('John Doe').build();
					expect(result).toEqual({ name: 'John Doe' });
				});

				test('builds valid person with all fields', () => {
					const result = person()
						.name('Dr. Jane Marie Smith Jr.')
						.title('Dr.')
						.firstName('Jane')
						.middleName('Marie')
						.lastName('Smith')
						.suffix('Jr.')
						.build();
					expect(result).toEqual({
						name: 'Dr. Jane Marie Smith Jr.',
						title: 'Dr.',
						firstName: 'Jane',
						middleName: 'Marie',
						lastName: 'Smith',
						suffix: 'Jr.',
					});
				});

				test('builds valid person with some optional fields', () => {
					const result = person()
						.name('Robert Johnson III')
						.firstName('Robert')
						.lastName('Johnson')
						.suffix('III')
						.build();
					expect(result).toEqual({
						name: 'Robert Johnson III',
						firstName: 'Robert',
						lastName: 'Johnson',
						suffix: 'III',
					});
				});

				test('supports method chaining', () => {
					const result = person()
						.name('John Doe')
						.firstName('John')
						.lastName('Doe')
						.build();
					expect(result).toEqual({
						name: 'John Doe',
						firstName: 'John',
						lastName: 'Doe',
					});
				});

				test('allows overwriting name', () => {
					const result = person().name('Jane').name('John Doe').build();
					expect(result).toEqual({ name: 'John Doe' });
				});
			});

			describe('validation failures on build()', () => {
				test('throws error when name is not set', () => {
					expect(() => person().firstName('John').build()).toThrow();
				});

				test('throws error when name is empty string', () => {
					expect(() => person().name('').build()).toThrow();
				});

				test('throws error when name exceeds max length', () => {
					expect(() => person().name('a'.repeat(201)).build()).toThrow();
				});
			});

			describe('builder instance behavior', () => {
				test('returns PersonBuilder instance', () => {
					const builder = person();
					expect(builder).toBeDefined();
					expect(typeof builder.name).toBe('function');
					expect(typeof builder.title).toBe('function');
					expect(typeof builder.firstName).toBe('function');
					expect(typeof builder.middleName).toBe('function');
					expect(typeof builder.lastName).toBe('function');
					expect(typeof builder.suffix).toBe('function');
					expect(typeof builder.build).toBe('function');
				});

				test('builder methods return this for chaining', () => {
					const builder = person();
					const afterFullName = builder.name('John Doe');
					expect(afterFullName).toBe(builder);
				});

				test('multiple builders are independent', () => {
					const builder1 = person().name('John Doe');
					const builder2 = person().name('Jane Smith');

					expect(builder1.build()).toEqual({ name: 'John Doe' });
					expect(builder2.build()).toEqual({ name: 'Jane Smith' });
				});
			});

			describe('builder pattern vs object pattern comparison', () => {
				test('builder pattern produces same result as object pattern', () => {
					const builderResult = person().name('John Doe').build();
					const objectResult = person({ name: 'John Doe' } as any);

					expect(builderResult).toEqual(objectResult);
				});
			});
		});
	});
});
