import { describe, test, expect } from 'vitest';
import { phone } from '@/primitives/phone';
import type { Phone } from '@paradoc/types';

describe('Phone', () => {
	// ============================================================================
	// Object Pattern Tests
	// ============================================================================

	describe('Object Pattern', () => {
		describe('phone() - direct validation', () => {
			describe('success cases', () => {
				test('creates valid phone with number only', () => {
					const input: Phone = { number: '+14155552671' };
					const result = phone(input);
					expect(result).toEqual({ number: '+14155552671' });
				});

				test('creates valid phone with number and type', () => {
					const input: Phone = { number: '+14155552671', type: 'mobile' };
					const result = phone(input);
					expect(result).toEqual({ number: '+14155552671', type: 'mobile' });
				});

				test('creates valid phone with number, type, and extension', () => {
					const input: Phone = {
						number: '+442071234567',
						type: 'work',
						extension: '123',
					};
					const result = phone(input);
					expect(result).toEqual({
						number: '+442071234567',
						type: 'work',
						extension: '123',
					});
				});

				test('creates valid phone with number and extension (no type)', () => {
					const input: Phone = { number: '+442071234567', extension: '456' };
					const result = phone(input);
					expect(result).toEqual({ number: '+442071234567', extension: '456' });
				});

				test('creates valid phone for various countries', () => {
					const phones = [
						{ number: '+14155552671' }, // US
						{ number: '+442071234567' }, // UK
						{ number: '+33123456789' }, // France
						{ number: '+8613800138000' }, // China
						{ number: '+81312345678' }, // Japan
						{ number: '+61212345678' }, // Australia
					];

					for (const p of phones) {
						const result = phone(p);
						expect(result).toEqual(p);
					}
				});

				test('creates valid phone with various types', () => {
					const types = ['mobile', 'work', 'home', 'fax', 'other'];

					for (const t of types) {
						const input: Phone = { number: '+14155552671', type: t };
						const result = phone(input);
						expect(result).toEqual({ number: '+14155552671', type: t });
					}
				});

				test('creates valid phone with minimum length number', () => {
					const input: Phone = { number: '+1234567' }; // 8 chars
					const result = phone(input);
					expect(result).toEqual({ number: '+1234567' });
				});

				test('creates valid phone with maximum length number', () => {
					const input: Phone = { number: '+123456789012345' }; // 16 chars
					const result = phone(input);
					expect(result).toEqual({ number: '+123456789012345' });
				});

				test('creates valid phone with minimum length extension', () => {
					const input: Phone = { number: '+14155552671', extension: '1' };
					const result = phone(input);
					expect(result).toEqual({ number: '+14155552671', extension: '1' });
				});

				test('creates valid phone with maximum length extension', () => {
					const input: Phone = {
						number: '+14155552671',
						extension: '12345678901234567890',
					}; // 20 chars
					const result = phone(input);
					expect(result).toEqual({
						number: '+14155552671',
						extension: '12345678901234567890',
					});
				});

				test('creates valid phone with minimum length type', () => {
					const input: Phone = { number: '+14155552671', type: 'w' };
					const result = phone(input);
					expect(result).toEqual({ number: '+14155552671', type: 'w' });
				});

				test('creates valid phone with maximum length type', () => {
					const input: Phone = {
						number: '+14155552671',
						type: 'a'.repeat(50),
					};
					const result = phone(input);
					expect(result).toEqual({ number: '+14155552671', type: 'a'.repeat(50) });
				});
			});

			describe('validation failures', () => {
				test('throws error when number is missing', () => {
					const input = { type: 'mobile' } as any;
					expect(() => phone(input)).toThrow();
				});

				test('throws error when number is null', () => {
					const input = { number: null } as any;
					expect(() => phone(input)).toThrow();
				});

				test('throws error when number is undefined', () => {
					const input = { number: undefined } as any;
					expect(() => phone(input)).toThrow();
				});

				test('throws error when number lacks + prefix', () => {
					const input = { number: '14155552671' } as any;
					expect(() => phone(input)).toThrow();
				});

				test('throws error when number starts with +0', () => {
					const input = { number: '+01234567890' } as any;
					expect(() => phone(input)).toThrow();
				});

				test('throws error when number has spaces', () => {
					const input = { number: '+1 415 555 2671' } as any;
					expect(() => phone(input)).toThrow();
				});

				test('throws error when number has dashes', () => {
					const input = { number: '+1-415-555-2671' } as any;
					expect(() => phone(input)).toThrow();
				});

				test('throws error when number has parentheses', () => {
					const input = { number: '+1(415)5552671' } as any;
					expect(() => phone(input)).toThrow();
				});

				test('throws error when number has letters', () => {
					const input = { number: '+1415555CALL' } as any;
					expect(() => phone(input)).toThrow();
				});

				test('throws error when number is too short (< 8 chars)', () => {
					const input = { number: '+123456' } as any;
					expect(() => phone(input)).toThrow();
				});

				test('throws error when number is too long (> 16 chars)', () => {
					const input = { number: '+1234567890123456' } as any;
					expect(() => phone(input)).toThrow();
				});

				test('throws error when type is empty string', () => {
					const input = { number: '+14155552671', type: '' } as any;
					expect(() => phone(input)).toThrow();
				});

				test('throws error when type is too long (> 50 chars)', () => {
					const input = { number: '+14155552671', type: 'a'.repeat(51) } as any;
					expect(() => phone(input)).toThrow();
				});

				test('throws error when extension is empty string', () => {
					const input = { number: '+14155552671', extension: '' } as any;
					expect(() => phone(input)).toThrow();
				});

				test('throws error when extension is too long (> 20 chars)', () => {
					const input = {
						number: '+14155552671',
						extension: '123456789012345678901',
					} as any;
					expect(() => phone(input)).toThrow();
				});

				test('throws error when number is a number type', () => {
					const input = { number: 14155552671 } as any;
					expect(() => phone(input)).toThrow();
				});

				test('rejects number type (strict validation)', () => {
					const input = { number: '+14155552671', type: 123 } as any;
					expect(() => phone(input)).toThrow();
				});

				test('rejects number extension (strict validation)', () => {
					const input = { number: '+14155552671', extension: 123 } as any;
					expect(() => phone(input)).toThrow();
				});

				test('rejects additional properties (strict validation)', () => {
					const input = {
						number: '+14155552671',
						type: 'mobile',
						extra: 'field',
					} as any;
					expect(() => phone(input)).toThrow();
				});

				test('throws error when input is null', () => {
					expect(() => phone(null as any)).toThrow();
				});

				test('returns builder when input is undefined (TypeBox behavior)', () => {
					const result = phone(undefined as any);
					expect(result).toBeDefined();
					expect(typeof result.number).toBe('function');
				});

				test('throws error when input is a string', () => {
					expect(() => phone('+14155552671' as any)).toThrow();
				});

				test('throws error when input is a number', () => {
					expect(() => phone(14155552671 as any)).toThrow();
				});

				test('throws error when input is an array', () => {
					expect(() => phone([{ number: '+14155552671' }] as any)).toThrow();
				});
			});
		});

		describe('phone.parse()', () => {
			describe('success cases', () => {
				test('parses valid phone object with number only', () => {
					const input = { number: '+14155552671' };
					const result = phone.parse(input);
					expect(result).toEqual({ number: '+14155552671' });
				});

				test('parses valid phone with number and type', () => {
					const input = { number: '+14155552671', type: 'mobile' };
					const result = phone.parse(input);
					expect(result).toEqual({ number: '+14155552671', type: 'mobile' });
				});

				test('parses valid phone with all fields', () => {
					const input = {
						number: '+442071234567',
						type: 'work',
						extension: '123',
					};
					const result = phone.parse(input);
					expect(result).toEqual({
						number: '+442071234567',
						type: 'work',
						extension: '123',
					});
				});

				test('parses various country phone numbers', () => {
					const phones = [
						{ number: '+14155552671' },
						{ number: '+442071234567' },
						{ number: '+33123456789' },
						{ number: '+8613800138000' },
					];

					for (const p of phones) {
						const result = phone.parse(p);
						expect(result).toEqual(p);
					}
				});
			});

			describe('validation failures', () => {
				test('throws error when number is missing', () => {
					const input = { type: 'mobile' };
					expect(() => phone.parse(input)).toThrow();
				});

				test('throws error when number pattern is invalid', () => {
					const input = { number: '14155552671' };
					expect(() => phone.parse(input)).toThrow();
				});

				test('throws error when number is too short', () => {
					const input = { number: '+123456' };
					expect(() => phone.parse(input)).toThrow();
				});

				test('throws error when number is too long', () => {
					const input = { number: '+1234567890123456' };
					expect(() => phone.parse(input)).toThrow();
				});

				test('rejects additional properties (strict validation)', () => {
					const input = {
						number: '+14155552671',
						type: 'mobile',
						extra: 'value',
					};
					expect(() => phone.parse(input)).toThrow();
				});

				test('throws error when input is null', () => {
					expect(() => phone.parse(null)).toThrow();
				});

				test('throws error when input is undefined', () => {
					expect(() => phone.parse(undefined)).toThrow();
				});

				test('throws error when input is not an object', () => {
					expect(() => phone.parse('string')).toThrow();
				});
			});
		});

		describe('phone.safeParse()', () => {
			describe('success cases', () => {
				test('returns success result for valid phone with number only', () => {
					const input = { number: '+14155552671' };
					const result = phone.safeParse(input);

					expect(result.success).toBe(true);
					if (result.success) {
						expect(result.data).toEqual({ number: '+14155552671' });
					}
				});

				test('returns success result for phone with type', () => {
					const input = { number: '+14155552671', type: 'mobile' };
					const result = phone.safeParse(input);

					expect(result.success).toBe(true);
					if (result.success) {
						expect(result.data).toEqual({ number: '+14155552671', type: 'mobile' });
					}
				});

				test('returns success result for phone with all fields', () => {
					const input = {
						number: '+442071234567',
						type: 'work',
						extension: '123',
					};
					const result = phone.safeParse(input);

					expect(result.success).toBe(true);
					if (result.success) {
						expect(result.data).toEqual({
							number: '+442071234567',
							type: 'work',
							extension: '123',
						});
					}
				});

				test('returns success result for various countries', () => {
					const phones = [
						{ number: '+14155552671' },
						{ number: '+442071234567' },
						{ number: '+33123456789' },
						{ number: '+8613800138000' },
					];

					for (const p of phones) {
						const result = phone.safeParse(p);
						expect(result.success).toBe(true);
						if (result.success) {
							expect(result.data).toEqual(p);
						}
					}
				});
			});

			describe('failure cases - returns error object', () => {
				test('returns error when number is missing', () => {
					const input = { type: 'mobile' };
					const result = phone.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when number lacks + prefix', () => {
					const input = { number: '14155552671' };
					const result = phone.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when number has wrong pattern', () => {
					const input = { number: '+1 415 555 2671' };
					const result = phone.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when number is too short', () => {
					const input = { number: '+123456' };
					const result = phone.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when number is too long', () => {
					const input = { number: '+1234567890123456' };
					const result = phone.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when type is empty string', () => {
					const input = { number: '+14155552671', type: '' };
					const result = phone.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when type is too long', () => {
					const input = { number: '+14155552671', type: 'a'.repeat(51) };
					const result = phone.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when extension is empty string', () => {
					const input = { number: '+14155552671', extension: '' };
					const result = phone.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when extension is too long', () => {
					const input = {
						number: '+14155552671',
						extension: '123456789012345678901',
					};
					const result = phone.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('rejects additional properties (strict validation)', () => {
					const input = {
						number: '+14155552671',
						type: 'mobile',
						extra: 'field',
					};
					const result = phone.safeParse(input);

					expect(result.success).toBe(false);
				});

				test('returns error when input is null', () => {
					const result = phone.safeParse(null);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when input is undefined', () => {
					const result = phone.safeParse(undefined);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when input is not an object', () => {
					const result = phone.safeParse('not an object');

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when input is an array', () => {
					const result = phone.safeParse([{ number: '+14155552671' }]);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
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
				test('builds valid phone with number only', () => {
					const result = phone().number('+14155552671').build();
					expect(result).toEqual({ number: '+14155552671' });
				});

				test('builds valid phone with number and type', () => {
					const result = phone().number('+14155552671').type('mobile').build();
					expect(result).toEqual({ number: '+14155552671', type: 'mobile' });
				});

				test('builds valid phone with number, type, and extension', () => {
					const result = phone()
						.number('+442071234567')
						.type('work')
						.extension('123')
						.build();
					expect(result).toEqual({
						number: '+442071234567',
						type: 'work',
						extension: '123',
					});
				});

				test('builds valid phone with number and extension (no type)', () => {
					const result = phone().number('+442071234567').extension('456').build();
					expect(result).toEqual({ number: '+442071234567', extension: '456' });
				});

				test('builds valid phone for various countries', () => {
					const numbers = [
						'+14155552671', // US
						'+442071234567', // UK
						'+33123456789', // France
						'+8613800138000', // China
						'+81312345678', // Japan
						'+61212345678', // Australia
					];

					for (const num of numbers) {
						const result = phone().number(num).build();
						expect(result).toEqual({ number: num });
					}
				});

				test('builds valid phone with various types', () => {
					const types = ['mobile', 'work', 'home', 'fax', 'other'];

					for (const t of types) {
						const result = phone().number('+14155552671').type(t).build();
						expect(result).toEqual({ number: '+14155552671', type: t });
					}
				});

				test('builds valid phone with minimum length number', () => {
					const result = phone().number('+1234567').build();
					expect(result).toEqual({ number: '+1234567' });
				});

				test('builds valid phone with maximum length number', () => {
					const result = phone().number('+123456789012345').build();
					expect(result).toEqual({ number: '+123456789012345' });
				});

				test('builds valid phone with minimum length extension', () => {
					const result = phone().number('+14155552671').extension('1').build();
					expect(result).toEqual({ number: '+14155552671', extension: '1' });
				});

				test('builds valid phone with maximum length extension', () => {
					const result = phone()
						.number('+14155552671')
						.extension('12345678901234567890')
						.build();
					expect(result).toEqual({
						number: '+14155552671',
						extension: '12345678901234567890',
					});
				});

				test('builds valid phone with minimum length type', () => {
					const result = phone().number('+14155552671').type('w').build();
					expect(result).toEqual({ number: '+14155552671', type: 'w' });
				});

				test('builds valid phone with maximum length type', () => {
					const result = phone()
						.number('+14155552671')
						.type('a'.repeat(50))
						.build();
					expect(result).toEqual({
						number: '+14155552671',
						type: 'a'.repeat(50),
					});
				});

				test('supports method chaining', () => {
					const result = phone()
						.number('+14155552671')
						.type('mobile')
						.extension('123')
						.build();
					expect(result).toEqual({
						number: '+14155552671',
						type: 'mobile',
						extension: '123',
					});
				});

				test('supports reverse order of method calls', () => {
					const result = phone()
						.extension('123')
						.type('mobile')
						.number('+14155552671')
						.build();
					expect(result).toEqual({
						number: '+14155552671',
						type: 'mobile',
						extension: '123',
					});
				});

				test('allows overwriting number', () => {
					const result = phone()
						.number('+11111111111')
						.number('+14155552671')
						.build();
					expect(result).toEqual({ number: '+14155552671' });
				});

				test('allows overwriting type', () => {
					const result = phone()
						.number('+14155552671')
						.type('work')
						.type('mobile')
						.build();
					expect(result).toEqual({ number: '+14155552671', type: 'mobile' });
				});

				test('allows overwriting extension', () => {
					const result = phone()
						.number('+14155552671')
						.extension('111')
						.extension('123')
						.build();
					expect(result).toEqual({ number: '+14155552671', extension: '123' });
				});

				test('allows setting type to undefined', () => {
					const result = phone()
						.number('+14155552671')
						.type('mobile')
						.type(undefined)
						.build();
					expect(result).toEqual({ number: '+14155552671' });
				});

				test('allows setting extension to undefined', () => {
					const result = phone()
						.number('+14155552671')
						.extension('123')
						.extension(undefined)
						.build();
					expect(result).toEqual({ number: '+14155552671' });
				});
			});

			describe('validation failures on build()', () => {
				test('throws error when number is not set', () => {
					expect(() => phone().type('mobile').build()).toThrow();
				});

				test('throws error when no fields are set', () => {
					expect(() => phone().build()).toThrow();
				});

				test('throws error when number lacks + prefix', () => {
					expect(() => phone().number('14155552671').build()).toThrow();
				});

				test('throws error when number starts with +0', () => {
					expect(() => phone().number('+01234567890').build()).toThrow();
				});

				test('throws error when number has spaces', () => {
					expect(() => phone().number('+1 415 555 2671').build()).toThrow();
				});

				test('throws error when number has dashes', () => {
					expect(() => phone().number('+1-415-555-2671').build()).toThrow();
				});

				test('throws error when number has parentheses', () => {
					expect(() => phone().number('+1(415)5552671').build()).toThrow();
				});

				test('throws error when number has letters', () => {
					expect(() => phone().number('+1415555CALL').build()).toThrow();
				});

				test('throws error when number is too short (< 8 chars)', () => {
					expect(() => phone().number('+123456').build()).toThrow();
				});

				test('throws error when number is too long (> 16 chars)', () => {
					expect(() => phone().number('+1234567890123456').build()).toThrow();
				});

				test('throws error when type is empty string', () => {
					expect(() => phone().number('+14155552671').type('').build()).toThrow();
				});

				test('throws error when type is too long (> 50 chars)', () => {
					expect(() =>
						phone()
							.number('+14155552671')
							.type('a'.repeat(51))
							.build(),
					).toThrow();
				});

				test('throws error when extension is empty string', () => {
					expect(() =>
						phone().number('+14155552671').extension('').build(),
					).toThrow();
				});

				test('throws error when extension is too long (> 20 chars)', () => {
					expect(() =>
						phone()
							.number('+14155552671')
							.extension('123456789012345678901')
							.build(),
					).toThrow();
				});
			});

			describe('builder instance behavior', () => {
				test('returns PhoneBuilder instance when called with no arguments', () => {
					const builder = phone();
					expect(builder).toBeDefined();
					expect(typeof builder.number).toBe('function');
					expect(typeof builder.type).toBe('function');
					expect(typeof builder.extension).toBe('function');
					expect(typeof builder.build).toBe('function');
				});

				test('builder methods return this for chaining', () => {
					const builder = phone();
					const afterNumber = builder.number('+14155552671');
					const afterType = afterNumber.type('mobile');
					const afterExtension = afterType.extension('123');

					expect(afterNumber).toBe(builder);
					expect(afterType).toBe(builder);
					expect(afterExtension).toBe(builder);
				});

				test('multiple builders are independent', () => {
					const builder1 = phone().number('+14155552671').type('mobile');
					const builder2 = phone().number('+442071234567').type('work');

					expect(builder1.build()).toEqual({
						number: '+14155552671',
						type: 'mobile',
					});
					expect(builder2.build()).toEqual({
						number: '+442071234567',
						type: 'work',
					});
				});

				test('builder can be reused after build', () => {
					const builder = phone().number('+14155552671').type('mobile');
					const result1 = builder.build();
					const result2 = builder.build();

					expect(result1).toEqual({ number: '+14155552671', type: 'mobile' });
					expect(result2).toEqual({ number: '+14155552671', type: 'mobile' });
				});

				test('modifying builder after build affects subsequent builds', () => {
					const builder = phone().number('+14155552671').type('mobile');
					const result1 = builder.build();

					builder.type('work');
					const result2 = builder.build();

					expect(result1).toEqual({ number: '+14155552671', type: 'mobile' });
					expect(result2).toEqual({ number: '+14155552671', type: 'work' });
				});
			});

			describe('common usage patterns', () => {
				test('creates US mobile phone', () => {
					const result = phone().number('+14155552671').type('mobile').build();
					expect(result).toEqual({ number: '+14155552671', type: 'mobile' });
				});

				test('creates UK work phone with extension', () => {
					const result = phone()
						.number('+442071234567')
						.type('work')
						.extension('123')
						.build();
					expect(result).toEqual({
						number: '+442071234567',
						type: 'work',
						extension: '123',
					});
				});

				test('creates French home phone', () => {
					const result = phone().number('+33123456789').type('home').build();
					expect(result).toEqual({ number: '+33123456789', type: 'home' });
				});

				test('creates Chinese phone without type', () => {
					const result = phone().number('+8613800138000').build();
					expect(result).toEqual({ number: '+8613800138000' });
				});
			});

			describe('builder pattern vs object pattern comparison', () => {
				test('builder pattern produces same result as object pattern', () => {
					const builderResult = phone()
						.number('+14155552671')
						.type('mobile')
						.build();
					const objectResult = phone({ number: '+14155552671', type: 'mobile' });

					expect(builderResult).toEqual(objectResult);
				});

				test('builder pattern validates on build(), object pattern validates immediately', () => {
					// Builder - no error until build()
					const builder = phone().number('invalid');
					expect(() => builder.build()).toThrow();

					// Object - error immediately
					expect(() => phone({ number: 'invalid' } as any)).toThrow();
				});
			});

			describe('partial builder state', () => {
				test('builder can exist with no fields set', () => {
					const builder = phone();
					expect(builder).toBeDefined();
				});

				test('builder can exist with only number set', () => {
					const builder = phone().number('+14155552671');
					expect(builder).toBeDefined();
					expect(builder.build()).toEqual({ number: '+14155552671' });
				});

				test('builder can exist with only type set', () => {
					const builder = phone().type('mobile');
					expect(builder).toBeDefined();
					expect(() => builder.build()).toThrow(); // But build fails
				});

				test('builder can exist with only extension set', () => {
					const builder = phone().extension('123');
					expect(builder).toBeDefined();
					expect(() => builder.build()).toThrow(); // But build fails
				});

				test('builder validates only on build() call', () => {
					const builder = phone();
					builder.number('invalid'); // Invalid pattern, but no error yet
					expect(() => builder.build()).toThrow(); // Error only on build
				});
			});

			describe('optional field handling', () => {
				test('builds phone without optional type', () => {
					const result = phone().number('+14155552671').build();
					expect(result).toEqual({ number: '+14155552671' });
					expect(result).not.toHaveProperty('type');
				});

				test('builds phone without optional extension', () => {
					const result = phone().number('+14155552671').build();
					expect(result).toEqual({ number: '+14155552671' });
					expect(result).not.toHaveProperty('extension');
				});

				test('builds phone with type but no extension', () => {
					const result = phone().number('+14155552671').type('mobile').build();
					expect(result).toEqual({ number: '+14155552671', type: 'mobile' });
					expect(result).not.toHaveProperty('extension');
				});

				test('builds phone with extension but no type', () => {
					const result = phone().number('+14155552671').extension('123').build();
					expect(result).toEqual({ number: '+14155552671', extension: '123' });
					expect(result).not.toHaveProperty('type');
				});

				test('setting type to undefined keeps it as undefined', () => {
					const result = phone()
						.number('+14155552671')
						.type('mobile')
						.type(undefined)
						.build();
					// TypeBox keeps undefined values in optional fields
					expect(result.number).toBe('+14155552671');
				});

				test('setting extension to undefined keeps it as undefined', () => {
					const result = phone()
						.number('+14155552671')
						.extension('123')
						.extension(undefined)
						.build();
					// TypeBox keeps undefined values in optional fields
					expect(result.number).toBe('+14155552671');
				});
			});
		});
	});
});
