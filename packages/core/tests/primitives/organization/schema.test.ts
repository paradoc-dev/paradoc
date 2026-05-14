import { describe, test, expect } from 'vitest';
import { organization } from '@/primitives/organization';
import type { Organization } from '@paradoc/types';

describe('Organization', () => {
	// ============================================================================
	// Object Pattern Tests
	// ============================================================================

	describe('Object Pattern', () => {
		describe('organization() - direct validation', () => {
			test('creates valid organization with name only', () => {
				const input = { name: 'Acme Corp' };
				const result = organization(input as any);
				expect(result).toEqual({ name: 'Acme Corp' });
			});

			test('creates valid organization with all fields', () => {
				const input = {
					name: 'Acme Corp',
					legalName: 'Acme Corporation',
					domicile: 'Delaware',
					entityType: 'corporation',
					entityId: 'BIN-123456',
					taxId: '12-3456789',
				};
				const result = organization(input as any);
				expect(result).toEqual(input);
			});

			test('throws error when name is missing', () => {
				const input = { legalName: 'Acme Corporation' } as any;
				expect(() => organization(input)).toThrow();
			});

			test('throws error when name is empty', () => {
				const input = { name: '' } as any;
				expect(() => organization(input)).toThrow();
			});
		});

		describe('organization.parse()', () => {
			test('parses valid organization', () => {
				const input = { name: 'Acme Corp' };
				const result = organization.parse(input);
				expect(result).toEqual({ name: 'Acme Corp' });
			});
		});

		describe('organization.safeParse()', () => {
			test('returns success for valid organization', () => {
				const input = { name: 'Acme Corp', taxId: '12-3456789' };
				const result = organization.safeParse(input);
				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.data.name).toBe('Acme Corp');
				}
			});

			test('returns error when name is missing', () => {
				const input = { taxId: '12-3456789' };
				const result = organization.safeParse(input);
				expect(result.success).toBe(false);
			});
		});
	});

	// ============================================================================
	// Builder Pattern Tests
	// ============================================================================

	describe('Builder Pattern', () => {
		describe('fluent builder API', () => {
			test('builds valid organization with name only', () => {
				const result = organization().name('Acme Corp').build();
				expect(result).toEqual({ name: 'Acme Corp' });
			});

			test('builds valid organization with all fields', () => {
				const result = organization()
					.name('Acme Corp')
					.legalName('Acme Corporation')
					.domicile('Delaware')
					.entityType('corporation')
					.entityId('BIN-123456')
					.taxId('12-3456789')
					.build();
				expect(result).toEqual({
					name: 'Acme Corp',
					legalName: 'Acme Corporation',
					domicile: 'Delaware',
					entityType: 'corporation',
					entityId: 'BIN-123456',
					taxId: '12-3456789',
				});
			});

			test('throws error when name is not set', () => {
				expect(() => organization().taxId('12-3456789').build()).toThrow();
			});

			test('throws error when name is empty', () => {
				expect(() => organization().name('').build()).toThrow();
			});
		});
	});
});
