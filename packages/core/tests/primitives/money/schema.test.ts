import { describe, test, expect } from 'vitest';
import { money } from '@/primitives/money';
import type { Money } from '@paradoc/types';

describe('Money', () => {
	// ============================================================================
	// Object Pattern Tests
	// ============================================================================

	describe('Object Pattern', () => {
		describe('money() - direct validation', () => {
			describe('success cases', () => {
				test('creates valid money with positive amount', () => {
					const input: Money = { amount: 99.99, currency: 'USD' };
					const result = money(input);
					expect(result).toEqual({ amount: 99.99, currency: 'USD' });
				});

				test('creates valid money with negative amount (debt/credit)', () => {
					const input: Money = { amount: -50.25, currency: 'GBP' };
					const result = money(input);
					expect(result).toEqual({ amount: -50.25, currency: 'GBP' });
				});

				test('creates valid money with zero amount', () => {
					const input: Money = { amount: 0, currency: 'EUR' };
					const result = money(input);
					expect(result).toEqual({ amount: 0, currency: 'EUR' });
				});

				test('creates valid money with decimal amount', () => {
					const input: Money = { amount: 250.75, currency: 'CAD' };
					const result = money(input);
					expect(result).toEqual({ amount: 250.75, currency: 'CAD' });
				});

				test('creates valid money with integer amount', () => {
					const input: Money = { amount: 1500, currency: 'JPY' };
					const result = money(input);
					expect(result).toEqual({ amount: 1500, currency: 'JPY' });
				});

				test('creates valid money with various ISO 4217 currencies', () => {
					const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY'];

					for (const curr of currencies) {
						const input: Money = { amount: 100, currency: curr };
						const result = money(input);
						expect(result).toEqual({ amount: 100, currency: curr });
					}
				});

				test('creates valid money with very large positive amount', () => {
					const input: Money = { amount: 9007199254740991, currency: 'USD' }; // MAX_SAFE_INTEGER
					const result = money(input);
					expect(result).toEqual({ amount: 9007199254740991, currency: 'USD' });
				});

				test('creates valid money with very large negative amount', () => {
					const input: Money = { amount: -9007199254740991, currency: 'USD' }; // MIN_SAFE_INTEGER
					const result = money(input);
					expect(result).toEqual({ amount: -9007199254740991, currency: 'USD' });
				});

				test('creates valid money with very small decimal amount', () => {
					const input: Money = { amount: 0.01, currency: 'USD' };
					const result = money(input);
					expect(result).toEqual({ amount: 0.01, currency: 'USD' });
				});

				test('creates valid money with many decimal places', () => {
					const input: Money = { amount: 99.999999, currency: 'USD' };
					const result = money(input);
					expect(result).toEqual({ amount: 99.999999, currency: 'USD' });
				});
			});

			describe('validation failures', () => {
				test('throws error when amount is missing', () => {
					const input = { currency: 'USD' } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when currency is missing', () => {
					const input = { amount: 100 } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when both fields are missing', () => {
					const input = {} as any;
					expect(() => money(input)).toThrow();
				});

				test('rejects string amount (strict validation)', () => {
					const input = { amount: '100', currency: 'USD' } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when amount is null', () => {
					const input = { amount: null, currency: 'USD' } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when amount is undefined', () => {
					const input = { amount: undefined, currency: 'USD' } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when amount is an object', () => {
					const input = { amount: { value: 100 }, currency: 'USD' } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when amount is an array', () => {
					const input = { amount: [100], currency: 'USD' } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when currency is a number', () => {
					const input = { amount: 100, currency: 123 } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when currency is null', () => {
					const input = { amount: 100, currency: null } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when currency is undefined', () => {
					const input = { amount: 100, currency: undefined } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when currency is an object', () => {
					const input = { amount: 100, currency: { code: 'USD' } } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when currency is an array', () => {
					const input = { amount: 100, currency: ['USD'] } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when currency is too short (1 char)', () => {
					const input = { amount: 100, currency: 'U' } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when currency is too short (2 chars)', () => {
					const input = { amount: 100, currency: 'US' } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when currency is too long (4 chars)', () => {
					const input = { amount: 100, currency: 'USDD' } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when currency is too long (5+ chars)', () => {
					const input = { amount: 100, currency: 'DOLLAR' } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when currency has lowercase letters', () => {
					const input = { amount: 100, currency: 'usd' } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when currency has mixed case', () => {
					const input = { amount: 100, currency: 'Usd' } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when currency has numbers', () => {
					const input = { amount: 100, currency: 'US1' } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when currency has special characters', () => {
					const input = { amount: 100, currency: 'US$' } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when currency has spaces', () => {
					const input = { amount: 100, currency: 'U S' } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when currency has trailing space', () => {
					const input = { amount: 100, currency: 'USD ' } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when currency has leading space', () => {
					const input = { amount: 100, currency: ' USD' } as any;
					expect(() => money(input)).toThrow();
				});

				test('rejects additional properties (strict validation)', () => {
					const input = { amount: 100, currency: 'USD', extra: 'field' } as any;
					expect(() => money(input)).toThrow();
				});

				test('throws error when input is null', () => {
					expect(() => money(null as any)).toThrow();
				});

				test('returns builder when input is undefined (TypeBox behavior)', () => {
					const result = money(undefined as any);
					// When undefined is passed, it returns a MoneyBuilder instance
					expect(result).toBeDefined();
					expect(typeof result.amount).toBe('function');
				});

				test('throws error when input is a string', () => {
					expect(() => money('not an object' as any)).toThrow();
				});

				test('throws error when input is a number', () => {
					expect(() => money(123 as any)).toThrow();
				});

				test('throws error when input is an array', () => {
					expect(() => money([{ amount: 100, currency: 'USD' }] as any)).toThrow();
				});
			});
		});

		describe('money.parse()', () => {
			describe('success cases', () => {
				test('parses valid money object', () => {
					const input = { amount: 99.99, currency: 'USD' };
					const result = money.parse(input);
					expect(result).toEqual({ amount: 99.99, currency: 'USD' });
				});

				test('parses money with negative amount', () => {
					const input = { amount: -50.25, currency: 'GBP' };
					const result = money.parse(input);
					expect(result).toEqual({ amount: -50.25, currency: 'GBP' });
				});

				test('parses money with zero amount', () => {
					const input = { amount: 0, currency: 'EUR' };
					const result = money.parse(input);
					expect(result).toEqual({ amount: 0, currency: 'EUR' });
				});

				test('parses money with various currencies', () => {
					const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD'];

					for (const curr of currencies) {
						const input = { amount: 100, currency: curr };
						const result = money.parse(input);
						expect(result).toEqual({ amount: 100, currency: curr });
					}
				});
			});

			describe('validation failures', () => {
				test('throws error when amount is missing', () => {
					const input = { currency: 'USD' };
					expect(() => money.parse(input)).toThrow();
				});

				test('throws error when currency is missing', () => {
					const input = { amount: 100 };
					expect(() => money.parse(input)).toThrow();
				});

				test('throws error when currency pattern is invalid', () => {
					const input = { amount: 100, currency: 'usd' };
					expect(() => money.parse(input)).toThrow();
				});

				test('throws error when currency length is invalid', () => {
					const input = { amount: 100, currency: 'US' };
					expect(() => money.parse(input)).toThrow();
				});

				test('rejects additional properties (strict validation)', () => {
					const input = { amount: 100, currency: 'USD', extra: 'value' };
					expect(() => money.parse(input)).toThrow();
				});

				test('throws error when input is null', () => {
					expect(() => money.parse(null)).toThrow();
				});

				test('throws error when input is undefined', () => {
					expect(() => money.parse(undefined)).toThrow();
				});

				test('throws error when input is not an object', () => {
					expect(() => money.parse('string')).toThrow();
				});
			});
		});

		describe('money.safeParse()', () => {
			describe('success cases', () => {
				test('returns success result for valid money', () => {
					const input = { amount: 99.99, currency: 'USD' };
					const result = money.safeParse(input);

					expect(result.success).toBe(true);
					if (result.success) {
						expect(result.data).toEqual({ amount: 99.99, currency: 'USD' });
					}
				});

				test('returns success result for negative amount', () => {
					const input = { amount: -50.25, currency: 'GBP' };
					const result = money.safeParse(input);

					expect(result.success).toBe(true);
					if (result.success) {
						expect(result.data).toEqual({ amount: -50.25, currency: 'GBP' });
					}
				});

				test('returns success result for zero amount', () => {
					const input = { amount: 0, currency: 'EUR' };
					const result = money.safeParse(input);

					expect(result.success).toBe(true);
					if (result.success) {
						expect(result.data).toEqual({ amount: 0, currency: 'EUR' });
					}
				});

				test('returns success result for various currencies', () => {
					const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD'];

					for (const curr of currencies) {
						const input = { amount: 100, currency: curr };
						const result = money.safeParse(input);

						expect(result.success).toBe(true);
						if (result.success) {
							expect(result.data).toEqual({ amount: 100, currency: curr });
						}
					}
				});
			});

			describe('failure cases - returns error object', () => {
				test('returns error when amount is missing', () => {
					const input = { currency: 'USD' };
					const result = money.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when currency is missing', () => {
					const input = { amount: 100 };
					const result = money.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when both fields are missing', () => {
					const input = {};
					const result = money.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('rejects string amount (strict validation)', () => {
					const input = { amount: '100', currency: 'USD' };
					const result = money.safeParse(input);

					expect(result.success).toBe(false);
				});

				test('returns error when currency has wrong type', () => {
					const input = { amount: 100, currency: 123 };
					const result = money.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when currency is too short', () => {
					const input = { amount: 100, currency: 'US' };
					const result = money.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when currency is too long', () => {
					const input = { amount: 100, currency: 'USDD' };
					const result = money.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when currency has lowercase letters', () => {
					const input = { amount: 100, currency: 'usd' };
					const result = money.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when currency has mixed case', () => {
					const input = { amount: 100, currency: 'Usd' };
					const result = money.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when currency has numbers', () => {
					const input = { amount: 100, currency: 'US1' };
					const result = money.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when currency has special characters', () => {
					const input = { amount: 100, currency: 'US$' };
					const result = money.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('rejects additional properties (strict validation)', () => {
					const input = { amount: 100, currency: 'USD', extra: 'field' };
					const result = money.safeParse(input);

					expect(result.success).toBe(false);
				});

				test('returns error when input is null', () => {
					const result = money.safeParse(null);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when input is undefined', () => {
					const result = money.safeParse(undefined);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when input is not an object', () => {
					const result = money.safeParse('not an object');

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when input is an array', () => {
					const result = money.safeParse([{ amount: 100, currency: 'USD' }]);

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
				test('builds valid money with positive amount', () => {
					const result = money().amount(99.99).currency('USD').build();
					expect(result).toEqual({ amount: 99.99, currency: 'USD' });
				});

				test('builds valid money with negative amount (debt/credit)', () => {
					const result = money().amount(-50.25).currency('GBP').build();
					expect(result).toEqual({ amount: -50.25, currency: 'GBP' });
				});

				test('builds valid money with zero amount', () => {
					const result = money().amount(0).currency('EUR').build();
					expect(result).toEqual({ amount: 0, currency: 'EUR' });
				});

				test('builds valid money with decimal amount', () => {
					const result = money().amount(250.75).currency('CAD').build();
					expect(result).toEqual({ amount: 250.75, currency: 'CAD' });
				});

				test('builds valid money with integer amount', () => {
					const result = money().amount(1500).currency('JPY').build();
					expect(result).toEqual({ amount: 1500, currency: 'JPY' });
				});

				test('builds valid money with various ISO 4217 currencies', () => {
					const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY'];

					for (const curr of currencies) {
						const result = money().amount(100).currency(curr).build();
						expect(result).toEqual({ amount: 100, currency: curr });
					}
				});

				test('builds valid money with very large positive amount', () => {
					const result = money().amount(9007199254740991).currency('USD').build(); // MAX_SAFE_INTEGER
					expect(result).toEqual({ amount: 9007199254740991, currency: 'USD' });
				});

				test('builds valid money with very large negative amount', () => {
					const result = money().amount(-9007199254740991).currency('USD').build(); // MIN_SAFE_INTEGER
					expect(result).toEqual({ amount: -9007199254740991, currency: 'USD' });
				});

				test('builds valid money with very small decimal amount', () => {
					const result = money().amount(0.01).currency('USD').build();
					expect(result).toEqual({ amount: 0.01, currency: 'USD' });
				});

				test('builds valid money with many decimal places', () => {
					const result = money().amount(99.999999).currency('USD').build();
					expect(result).toEqual({ amount: 99.999999, currency: 'USD' });
				});

				test('supports method chaining', () => {
					const result = money().amount(100).currency('USD').build();
					expect(result).toEqual({ amount: 100, currency: 'USD' });
				});

				test('supports reverse order of method calls', () => {
					const result = money().currency('USD').amount(100).build();
					expect(result).toEqual({ amount: 100, currency: 'USD' });
				});

				test('allows overwriting amount', () => {
					const result = money().amount(50).amount(100).currency('USD').build();
					expect(result).toEqual({ amount: 100, currency: 'USD' });
				});

				test('allows overwriting currency', () => {
					const result = money().amount(100).currency('EUR').currency('USD').build();
					expect(result).toEqual({ amount: 100, currency: 'USD' });
				});
			});

			describe('validation failures on build()', () => {
				test('throws error when amount is not set', () => {
					expect(() => money().currency('USD').build()).toThrow();
				});

				test('throws error when currency is not set', () => {
					expect(() => money().amount(100).build()).toThrow();
				});

				test('throws error when neither field is set', () => {
					expect(() => money().build()).toThrow();
				});

				test('throws error when currency is too short (1 char)', () => {
					expect(() => money().amount(100).currency('U').build()).toThrow();
				});

				test('throws error when currency is too short (2 chars)', () => {
					expect(() => money().amount(100).currency('US').build()).toThrow();
				});

				test('throws error when currency is too long (4 chars)', () => {
					expect(() => money().amount(100).currency('USDD').build()).toThrow();
				});

				test('throws error when currency is too long (5+ chars)', () => {
					expect(() => money().amount(100).currency('DOLLAR').build()).toThrow();
				});

				test('throws error when currency has lowercase letters', () => {
					expect(() => money().amount(100).currency('usd').build()).toThrow();
				});

				test('throws error when currency has mixed case', () => {
					expect(() => money().amount(100).currency('Usd').build()).toThrow();
				});

				test('throws error when currency has numbers', () => {
					expect(() => money().amount(100).currency('US1').build()).toThrow();
				});

				test('throws error when currency has special characters', () => {
					expect(() => money().amount(100).currency('US$').build()).toThrow();
				});

				test('throws error when currency has spaces', () => {
					expect(() => money().amount(100).currency('U S').build()).toThrow();
				});

				test('throws error when currency has trailing space', () => {
					expect(() => money().amount(100).currency('USD ').build()).toThrow();
				});

				test('throws error when currency has leading space', () => {
					expect(() => money().amount(100).currency(' USD').build()).toThrow();
				});

				test('throws error when currency is empty string', () => {
					expect(() => money().amount(100).currency('').build()).toThrow();
				});
			});

			describe('builder instance behavior', () => {
				test('returns MoneyBuilder instance when called with no arguments', () => {
					const builder = money();
					expect(builder).toBeDefined();
					expect(typeof builder.amount).toBe('function');
					expect(typeof builder.currency).toBe('function');
					expect(typeof builder.build).toBe('function');
				});

				test('builder methods return this for chaining', () => {
					const builder = money();
					const afterAmount = builder.amount(100);
					const afterCurrency = afterAmount.currency('USD');

					expect(afterAmount).toBe(builder);
					expect(afterCurrency).toBe(builder);
				});

				test('multiple builders are independent', () => {
					const builder1 = money().amount(100).currency('USD');
					const builder2 = money().amount(200).currency('EUR');

					expect(builder1.build()).toEqual({ amount: 100, currency: 'USD' });
					expect(builder2.build()).toEqual({ amount: 200, currency: 'EUR' });
				});

				test('builder can be reused after build', () => {
					const builder = money().amount(100).currency('USD');
					const result1 = builder.build();
					const result2 = builder.build();

					expect(result1).toEqual({ amount: 100, currency: 'USD' });
					expect(result2).toEqual({ amount: 100, currency: 'USD' });
				});

				test('modifying builder after build affects subsequent builds', () => {
					const builder = money().amount(100).currency('USD');
					const result1 = builder.build();

					builder.amount(200);
					const result2 = builder.build();

					expect(result1).toEqual({ amount: 100, currency: 'USD' });
					expect(result2).toEqual({ amount: 200, currency: 'USD' });
				});
			});

			describe('edge cases and special scenarios', () => {
				test('handles floating point precision', () => {
					const result = money().amount(0.1 + 0.2).currency('USD').build();
					expect(result.amount).toBeCloseTo(0.3);
				});

				test('preserves exact decimal values', () => {
					const result = money().amount(123.456789).currency('USD').build();
					expect(result.amount).toBe(123.456789);
				});

					test('handles Infinity amount (should throw on build)', () => {
					expect(() => money().amount(Infinity).currency('USD').build()).toThrow();
				});

				test('handles -Infinity amount (should throw on build)', () => {
					expect(() => money().amount(-Infinity).currency('USD').build()).toThrow();
				});

				test('handles NaN amount (should throw on build)', () => {
					expect(() => money().amount(NaN).currency('USD').build()).toThrow();
				});
			});

			describe('TypeScript type safety scenarios', () => {
				test('accepts valid number for amount', () => {
					const result = money().amount(100).currency('USD').build();
					expect(result.amount).toBe(100);
				});

				test('accepts valid string for currency', () => {
					const result = money().amount(100).currency('USD').build();
					expect(result.currency).toBe('USD');
				});

				// These tests document the runtime behavior even though TypeScript would catch them
				test('rejects string amount at build time (strict validation)', () => {
					const builder = money();
					(builder as any).amount('100');
					builder.currency('USD');
					expect(() => builder.build()).toThrow();
				});

				test('validates currency pattern at build time', () => {
					const builder = money();
					builder.amount(100);
					(builder as any).currency('invalid');
					expect(() => builder.build()).toThrow();
				});
			});

			describe('common usage patterns', () => {
				test('creates USD amount', () => {
					const result = money().amount(99.99).currency('USD').build();
					expect(result).toEqual({ amount: 99.99, currency: 'USD' });
				});

				test('creates EUR amount', () => {
					const result = money().amount(150.5).currency('EUR').build();
					expect(result).toEqual({ amount: 150.5, currency: 'EUR' });
				});

				test('creates GBP amount', () => {
					const result = money().amount(75.25).currency('GBP').build();
					expect(result).toEqual({ amount: 75.25, currency: 'GBP' });
				});

				test('creates JPY amount (typically no decimals)', () => {
					const result = money().amount(10000).currency('JPY').build();
					expect(result).toEqual({ amount: 10000, currency: 'JPY' });
				});

				test('creates debt/negative amount', () => {
					const result = money().amount(-1000.5).currency('USD').build();
					expect(result).toEqual({ amount: -1000.5, currency: 'USD' });
				});

				test('creates zero balance', () => {
					const result = money().amount(0).currency('USD').build();
					expect(result).toEqual({ amount: 0, currency: 'USD' });
				});
			});

			describe('builder pattern vs object pattern comparison', () => {
				test('builder pattern produces same result as object pattern', () => {
					const builderResult = money().amount(100).currency('USD').build();
					const objectResult = money({ amount: 100, currency: 'USD' });

					expect(builderResult).toEqual(objectResult);
				});

				test('builder pattern validates on build(), object pattern validates immediately', () => {
					// Builder - no error until build()
					const builder = money().amount(100).currency('invalid');
					expect(() => builder.build()).toThrow();

					// Object - error immediately
					expect(() => money({ amount: 100, currency: 'invalid' } as any)).toThrow();
				});
			});

			describe('partial builder state', () => {
				test('builder can exist with no fields set', () => {
					const builder = money();
					expect(builder).toBeDefined();
				});

				test('builder can exist with only amount set', () => {
					const builder = money().amount(100);
					expect(builder).toBeDefined();
					expect(() => builder.build()).toThrow(); // But build fails
				});

				test('builder can exist with only currency set', () => {
					const builder = money().currency('USD');
					expect(builder).toBeDefined();
					expect(() => builder.build()).toThrow(); // But build fails
				});

				test('builder validates only on build() call', () => {
					const builder = money();
					// No error setting invalid currency
					(builder as any).currency(123);
					// Error only on build
					expect(() => builder.build()).toThrow();
				});
			});
		});
	});
});
