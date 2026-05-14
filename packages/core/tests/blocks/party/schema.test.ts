import { describe, test, expect } from 'vitest';
import { person, organization, partyData, inferPartyType } from '@/primitives';
import type { Party } from '@paradoc/types';

describe('Party Builders', () => {
	// ============================================================================
	// Person Tests
	// ============================================================================

	describe('person()', () => {
		describe('Object Pattern', () => {
			describe('person() - direct validation', () => {
				test('creates valid person party with minimal config', () => {
					const input = { name: 'John Doe' };
					const result = person(input as any);
					expect(inferPartyType(result)).toBe('person');
					expect(result.name).toBe('John Doe');
				});

				test('creates person party with all name components', () => {
					const input = {
						name: 'Dr. Jane Mary Smith Jr.',
						title: 'Dr.',
						firstName: 'Jane',
						middleName: 'Mary',
						lastName: 'Smith',
						suffix: 'Jr.',
					};
					const result = person(input as any);
					expect(inferPartyType(result)).toBe('person');
					expect(result.name).toBe('Dr. Jane Mary Smith Jr.');
					expect(result.title).toBe('Dr.');
					expect(result.firstName).toBe('Jane');
					expect(result.middleName).toBe('Mary');
					expect(result.lastName).toBe('Smith');
					expect(result.suffix).toBe('Jr.');
				});

				test('creates person party with first and last name only', () => {
					const input = {
						name: 'Jane Smith',
						firstName: 'Jane',
						lastName: 'Smith',
					};
					const result = person(input as any);
					expect(result.firstName).toBe('Jane');
					expect(result.lastName).toBe('Smith');
				});

				test('creates person party with title prefix', () => {
					const input = {
						name: 'Mr. John Doe',
						title: 'Mr.',
						firstName: 'John',
						lastName: 'Doe',
					};
					const result = person(input as any);
					expect(result.title).toBe('Mr.');
				});

				test('creates person party with name suffix', () => {
					const input = {
						name: 'John Doe III',
						firstName: 'John',
						lastName: 'Doe',
						suffix: 'III',
					};
					const result = person(input as any);
					expect(result.suffix).toBe('III');
				});

				test('creates person party with middle name', () => {
					const input = {
						name: 'John Michael Doe',
						firstName: 'John',
						middleName: 'Michael',
						lastName: 'Doe',
					};
					const result = person(input as any);
					expect(result.middleName).toBe('Michael');
				});
			});

			describe('validation failures', () => {
				test('throws error when name is missing', () => {
					const input = { firstName: 'John' } as any;
					expect(() => person(input)).toThrow();
				});
			});
		});

		describe('person.parse()', () => {
			test('parses valid person party', () => {
				const input = { name: 'John Doe' };
				const result = person.parse(input);
				expect(inferPartyType(result)).toBe('person');
				expect(result.name).toBe('John Doe');
			});

			test('parses person party with all properties', () => {
				const input = {
					name: 'Dr. Jane Smith',
					title: 'Dr.',
					firstName: 'Jane',
					lastName: 'Smith',
				};
				const result = person.parse(input);
				expect(inferPartyType(result)).toBe('person');
				expect(result.title).toBe('Dr.');
			});

			test('throws error for invalid input', () => {
				expect(() => person.parse({})).toThrow();
			});

			test('throws error when input is null', () => {
				expect(() => person.parse(null)).toThrow();
			});

			test('throws error when input is undefined', () => {
				expect(() => person.parse(undefined)).toThrow();
			});
		});

		describe('person.safeParse()', () => {
			test('returns success for valid person party', () => {
				const input = { name: 'John Doe' };
				const result = person.safeParse(input);
				expect(result.success).toBe(true);
				if (result.success) {
					expect(inferPartyType(result.data)).toBe('person');
					expect(result.data.name).toBe('John Doe');
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

			test('returns error for null input', () => {
				const result = person.safeParse(null);
				expect(result.success).toBe(false);
			});

			test('returns error for undefined input', () => {
				const result = person.safeParse(undefined);
				expect(result.success).toBe(false);
			});
		});

		describe('Builder Pattern', () => {
			test('builds valid person party with minimal config', () => {
				const result = person().name('John Doe').build();
				expect(inferPartyType(result)).toBe('person');
				expect(result.name).toBe('John Doe');
			});

			test('builds person party with all name components', () => {
				const result = person()
					.name('Dr. Jane Mary Smith Jr.')
					.title('Dr.')
					.firstName('Jane')
					.middleName('Mary')
					.lastName('Smith')
					.suffix('Jr.')
					.build();
				expect(result.name).toBe('Dr. Jane Mary Smith Jr.');
				expect(result.title).toBe('Dr.');
				expect(result.firstName).toBe('Jane');
				expect(result.middleName).toBe('Mary');
				expect(result.lastName).toBe('Smith');
				expect(result.suffix).toBe('Jr.');
			});

			test('builds person party with first and last name only', () => {
				const result = person()
					.name('Jane Smith')
					.firstName('Jane')
					.lastName('Smith')
					.build();
				expect(result.firstName).toBe('Jane');
				expect(result.lastName).toBe('Smith');
			});

			test('builds person party with title prefix', () => {
				const result = person()
					.name('Mr. John Doe')
					.title('Mr.')
					.firstName('John')
					.lastName('Doe')
					.build();
				expect(result.title).toBe('Mr.');
			});

			test('builds person party with name suffix', () => {
				const result = person()
					.name('John Doe III')
					.firstName('John')
					.lastName('Doe')
					.suffix('III')
					.build();
				expect(result.suffix).toBe('III');
			});

			test('builds person party with middle name', () => {
				const result = person()
					.name('John Michael Doe')
					.firstName('John')
					.middleName('Michael')
					.lastName('Doe')
					.build();
				expect(result.middleName).toBe('Michael');
			});

			test('supports method chaining', () => {
				const result = person()
					.name('Jane Doe')
					.firstName('Jane')
					.lastName('Doe')
					.build();
				expect(result.name).toBe('Jane Doe');
				expect(result.firstName).toBe('Jane');
				expect(result.lastName).toBe('Doe');
			});

			test('allows overwriting name', () => {
				const result = person()
					.name('Original Name')
					.name('Updated Name')
					.build();
				expect(result.name).toBe('Updated Name');
			});

			test('allows undefined values for optional fields', () => {
				const result = person()
					.name('John Doe')
					.title(undefined)
					.firstName(undefined)
					.build();
				expect(result.name).toBe('John Doe');
				expect(result.title).toBeUndefined();
				expect(result.firstName).toBeUndefined();
			});

			test('throws error when name is not set', () => {
				expect(() => person().build()).toThrow();
			});

			test('returns builder instance', () => {
				const builder = person();
				expect(builder).toBeDefined();
				expect(typeof builder.name).toBe('function');
				expect(typeof builder.build).toBe('function');
			});

			test('builder methods return this for chaining', () => {
				const builder = person();
				const afterFullName = builder.name('John Doe');
				const afterFirstName = afterFullName.firstName('John');
				expect(afterFullName).toBe(builder);
				expect(afterFirstName).toBe(builder);
			});

			test('multiple builders are independent', () => {
				const builder1 = person().name('Person 1');
				const builder2 = person().name('Person 2');
				expect(builder1.build().name).toBe('Person 1');
				expect(builder2.build().name).toBe('Person 2');
			});

			test('builder can be reused after build', () => {
				const builder = person().name('John Doe');
				const result1 = builder.build();
				const result2 = builder.build();
				expect(result1).toEqual(result2);
			});

			test('modifying builder after build affects subsequent builds', () => {
				const builder = person().name('Original');
				const result1 = builder.build();

				builder.name('Modified');
				const result2 = builder.build();

				expect(result1.name).toBe('Original');
				expect(result2.name).toBe('Modified');
			});
		});

		describe('builder pattern vs object pattern comparison', () => {
			test('person builder produces same result as object pattern', () => {
				const builderResult = person()
					.name('John Doe')
					.firstName('John')
					.lastName('Doe')
					.build();

				const objectResult = person({
					name: 'John Doe',
					firstName: 'John',
					lastName: 'Doe',
				} as any);

				expect(builderResult).toEqual(objectResult);
			});

			test('builder validates on build(), object validates immediately', () => {
				// Builder - no error until build()
				const builder = person();
				expect(() => builder.build()).toThrow();

				// Object - error immediately
				expect(() => person({} as any)).toThrow();
			});
		});

		describe('common usage patterns', () => {
			test('creates individual party', () => {
				const result = person()
					.name('Jane Smith')
					.firstName('Jane')
					.lastName('Smith')
					.build();

				expect(inferPartyType(result)).toBe('person');
				expect(result.name).toBe('Jane Smith');
			});

			test('creates person with professional title', () => {
				const result = person()
					.name('Dr. Robert Johnson')
					.title('Dr.')
					.firstName('Robert')
					.lastName('Johnson')
					.build();

				expect(result.title).toBe('Dr.');
			});

			test('creates person with name suffix', () => {
				const result = person()
					.name('William Brown Jr.')
					.firstName('William')
					.lastName('Brown')
					.suffix('Jr.')
					.build();

				expect(result.suffix).toBe('Jr.');
			});
		});
	});

	// ============================================================================
	// Organization Tests
	// ============================================================================

	describe('organization()', () => {
		describe('Object Pattern', () => {
			describe('organization() - direct validation', () => {
				test('creates valid organization party with minimal config', () => {
					const input = { name: 'Acme Corporation', entityType: 'corporation' };
					const result = organization(input as any);
					expect(inferPartyType(result)).toBe('organization');
					expect(result.name).toBe('Acme Corporation');
				});

				test('creates organization party with all properties', () => {
					const input = {
						name: 'Acme Corporation',
						legalName: 'Acme Corporation, Inc.',
						domicile: 'Delaware',
						entityType: 'corporation',
						entityId: 'DE-123456',
						taxId: '12-3456789',
					};
					const result = organization(input as any);
					expect(inferPartyType(result)).toBe('organization');
					expect(result.name).toBe('Acme Corporation');
					expect(result.legalName).toBe('Acme Corporation, Inc.');
					expect(result.domicile).toBe('Delaware');
					expect(result.entityType).toBe('corporation');
					expect(result.entityId).toBe('DE-123456');
					expect(result.taxId).toBe('12-3456789');
				});

				test('creates organization party with legal name', () => {
					const input = {
						name: 'TechStart',
						legalName: 'TechStart, LLC',
					};
					const result = organization(input as any);
					expect(result.legalName).toBe('TechStart, LLC');
				});

				test('creates organization party with domicile', () => {
					const input = {
						name: 'Global Inc',
						domicile: 'New York',
					};
					const result = organization(input as any);
					expect(result.domicile).toBe('New York');
				});

				test('creates organization party with entity type', () => {
					const input = {
						name: 'MyCompany',
						entityType: 'LLC',
					};
					const result = organization(input as any);
					expect(result.entityType).toBe('LLC');
				});

				test('creates organization party with tax ID', () => {
					const input = {
						name: 'Corp Inc',
						taxId: '98-7654321',
					};
					const result = organization(input as any);
					expect(result.taxId).toBe('98-7654321');
				});
			});

			describe('validation failures', () => {
				test('throws error when name is missing', () => {
					const input = { legalName: 'Acme Corp, Inc.' } as any;
					expect(() => organization(input)).toThrow();
				});
			});
		});

		describe('organization.parse()', () => {
			test('parses valid organization party', () => {
				const input = { name: 'Acme Corp', entityType: 'corporation' };
				const result = organization.parse(input);
				expect(inferPartyType(result)).toBe('organization');
				expect(result.name).toBe('Acme Corp');
			});

			test('parses organization with all properties', () => {
				const input = {
					name: 'Corp Inc',
					legalName: 'Corp Inc, LLC',
					domicile: 'CA',
					entityType: 'LLC',
					taxId: '12-3456789',
				};
				const result = organization.parse(input);
				expect(inferPartyType(result)).toBe('organization');
				expect(result.legalName).toBe('Corp Inc, LLC');
			});

			test('throws error for invalid input', () => {
				expect(() => organization.parse({})).toThrow();
			});

			test('throws error when input is null', () => {
				expect(() => organization.parse(null)).toThrow();
			});

			test('throws error when input is undefined', () => {
				expect(() => organization.parse(undefined)).toThrow();
			});
		});

		describe('organization.safeParse()', () => {
			test('returns success for valid organization party', () => {
				const input = { name: 'Acme Corp', entityType: 'corporation' };
				const result = organization.safeParse(input);
				expect(result.success).toBe(true);
				if (result.success) {
					expect(inferPartyType(result.data)).toBe('organization');
					expect(result.data.name).toBe('Acme Corp');
				}
			});

			test('returns success for organization with all properties', () => {
				const input = {
					name: 'Corp Inc',
					legalName: 'Corp Inc, LLC',
					domicile: 'CA',
					entityType: 'LLC',
					taxId: '12-3456789',
				};
				const result = organization.safeParse(input);
				expect(result.success).toBe(true);
			});

			test('returns error when name is missing', () => {
				const input = { legalName: 'Corp' };
				const result = organization.safeParse(input);
				expect(result.success).toBe(false);
			});

			test('returns error for null input', () => {
				const result = organization.safeParse(null);
				expect(result.success).toBe(false);
			});

			test('returns error for undefined input', () => {
				const result = organization.safeParse(undefined);
				expect(result.success).toBe(false);
			});
		});

		describe('Builder Pattern', () => {
			test('builds valid organization party with minimal config', () => {
				const result = organization().name('Acme Corporation').entityType('corporation').build();
				expect(inferPartyType(result)).toBe('organization');
				expect(result.name).toBe('Acme Corporation');
			});

			test('builds organization party with all properties', () => {
				const result = organization()
					.name('Acme Corporation')
					.legalName('Acme Corporation, Inc.')
					.domicile('Delaware')
					.entityType('corporation')
					.entityId('DE-123456')
					.taxId('12-3456789')
					.build();
				expect(result.name).toBe('Acme Corporation');
				expect(result.legalName).toBe('Acme Corporation, Inc.');
				expect(result.domicile).toBe('Delaware');
				expect(result.entityType).toBe('corporation');
				expect(result.entityId).toBe('DE-123456');
				expect(result.taxId).toBe('12-3456789');
			});

			test('builds organization party with legal name', () => {
				const result = organization()
					.name('TechStart')
					.legalName('TechStart, LLC')
					.build();
				expect(result.legalName).toBe('TechStart, LLC');
			});

			test('builds organization party with domicile', () => {
				const result = organization().name('Global Inc').domicile('New York').build();
				expect(result.domicile).toBe('New York');
			});

			test('builds organization party with entity type', () => {
				const result = organization().name('MyCompany').entityType('LLC').build();
				expect(result.entityType).toBe('LLC');
			});

			test('builds organization party with tax ID', () => {
				const result = organization().name('Corp Inc').taxId('98-7654321').build();
				expect(result.taxId).toBe('98-7654321');
			});

			test('supports method chaining', () => {
				const result = organization()
					.name('Corp Inc')
					.legalName('Corp Inc, LLC')
					.taxId('12-3456789')
					.build();
				expect(result.name).toBe('Corp Inc');
				expect(result.taxId).toBe('12-3456789');
			});

			test('allows overwriting name', () => {
				const result = organization()
					.name('Original Corp')
					.name('Updated Corp')
					.build();
				expect(result.name).toBe('Updated Corp');
			});

			test('allows undefined values for optional fields', () => {
				const result = organization()
					.name('Acme Corp')
					.legalName(undefined)
					.domicile(undefined)
					.build();
				expect(result.name).toBe('Acme Corp');
				expect(result.legalName).toBeUndefined();
				expect(result.domicile).toBeUndefined();
			});

			test('throws error when name is not set', () => {
				expect(() => organization().build()).toThrow();
			});

			test('returns builder instance', () => {
				const builder = organization();
				expect(builder).toBeDefined();
				expect(typeof builder.name).toBe('function');
				expect(typeof builder.legalName).toBe('function');
				expect(typeof builder.build).toBe('function');
			});

			test('builder methods return this for chaining', () => {
				const builder = organization();
				const afterName = builder.name('Corp');
				const afterLegalName = afterName.legalName('Corp Inc');
				expect(afterName).toBe(builder);
				expect(afterLegalName).toBe(builder);
			});

			test('multiple builders are independent', () => {
				const builder1 = organization().name('Org 1');
				const builder2 = organization().name('Org 2');
				expect(builder1.build().name).toBe('Org 1');
				expect(builder2.build().name).toBe('Org 2');
			});

			test('builder can be reused after build', () => {
				const builder = organization().name('Acme Corp');
				const result1 = builder.build();
				const result2 = builder.build();
				expect(result1).toEqual(result2);
			});

			test('modifying builder after build affects subsequent builds', () => {
				const builder = organization().name('Original');
				const result1 = builder.build();

				builder.name('Modified');
				const result2 = builder.build();

				expect(result1.name).toBe('Original');
				expect(result2.name).toBe('Modified');
			});
		});

		describe('builder pattern vs object pattern comparison', () => {
			test('organization builder produces same result as object pattern', () => {
				const builderResult = organization()
					.name('Acme Corp')
					.legalName('Acme Corp, Inc.')
					.build();

				const objectResult = organization({
					name: 'Acme Corp',
					legalName: 'Acme Corp, Inc.',
				} as any);

				expect(builderResult).toEqual(objectResult);
			});

			test('builder validates on build(), object validates immediately', () => {
				// Builder - no error until build()
				const builder = organization();
				expect(() => builder.build()).toThrow();

				// Object - error immediately
				expect(() => organization({} as any)).toThrow();
			});
		});

		describe('common usage patterns', () => {
			test('creates corporate party', () => {
				const result = organization()
					.name('Acme Corporation')
					.legalName('Acme Corporation, Inc.')
					.entityType('corporation')
					.taxId('12-3456789')
					.build();

				expect(inferPartyType(result)).toBe('organization');
				expect(result.name).toBe('Acme Corporation');
			});

			test('creates LLC entity', () => {
				const result = organization()
					.name('TechStart')
					.legalName('TechStart, LLC')
					.domicile('Delaware')
					.entityType('LLC')
					.build();

				expect(result.entityType).toBe('LLC');
				expect(result.domicile).toBe('Delaware');
			});
		});
	});

	// ============================================================================
	// partyData Tests (Shape-based parsing)
	// ============================================================================

	describe('partyData', () => {
		describe('partyData.parse()', () => {
			test('parses person from shape', () => {
				const input = { name: 'John Doe' };
				const result = partyData.parse(input);
				expect(partyData.inferType(result)).toBe('person');
			});

			test('parses organization from shape', () => {
				const input = { name: 'Acme Corp', entityType: 'corporation' };
				const result = partyData.parse(input);
				expect(partyData.inferType(result)).toBe('organization');
			});

			test('throws error for invalid shape', () => {
				expect(() => partyData.parse({ foo: 'bar' })).toThrow();
			});

			test('throws error for non-object', () => {
				expect(() => partyData.parse('string')).toThrow();
				expect(() => partyData.parse(null)).toThrow();
			});
		});

		describe('partyData.safeParse()', () => {
			test('returns success for valid person', () => {
				const result = partyData.safeParse({ name: 'John' });
				expect(result.success).toBe(true);
			});

			test('returns success for valid organization', () => {
				const result = partyData.safeParse({ name: 'Acme' });
				expect(result.success).toBe(true);
			});

			test('returns error for invalid input', () => {
				const result = partyData.safeParse({ invalid: 'data' });
				expect(result.success).toBe(false);
			});
		});

		describe('partyData.inferType()', () => {
			test('infers person from name', () => {
				const p = person().name('John').build();
				expect(partyData.inferType(p)).toBe('person');
			});

			test('infers organization from name', () => {
				const o = organization().name('Corp').entityType('corporation').build();
				expect(partyData.inferType(o)).toBe('organization');
			});
		});
	});
});
