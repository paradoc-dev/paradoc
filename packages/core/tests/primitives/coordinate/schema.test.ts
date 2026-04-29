import { describe, test, expect } from 'vitest';
import { coordinate } from '@/primitives/coordinate';
import type { Coordinate } from '@paradoc/types';

describe('Coordinate', () => {
	// ============================================================================
	// Object Pattern Tests
	// ============================================================================

	describe('Object Pattern', () => {
		describe('coordinate() - direct validation', () => {
			describe('success cases', () => {
				test('creates valid coordinate with positive values', () => {
					const input: Coordinate = { lat: 37.7749, lon: -122.4194 };
					const result = coordinate(input);
					expect(result).toEqual({ lat: 37.7749, lon: -122.4194 });
				});

				test('creates valid coordinate at equator and prime meridian', () => {
					const input: Coordinate = { lat: 0, lon: 0 };
					const result = coordinate(input);
					expect(result).toEqual({ lat: 0, lon: 0 });
				});

				test('creates valid coordinate with negative latitude', () => {
					const input: Coordinate = { lat: -33.8688, lon: 151.2093 };
					const result = coordinate(input);
					expect(result).toEqual({ lat: -33.8688, lon: 151.2093 });
				});

				test('creates valid coordinate at North Pole', () => {
					const input: Coordinate = { lat: 90, lon: 0 };
					const result = coordinate(input);
					expect(result).toEqual({ lat: 90, lon: 0 });
				});

				test('creates valid coordinate at South Pole', () => {
					const input: Coordinate = { lat: -90, lon: 0 };
					const result = coordinate(input);
					expect(result).toEqual({ lat: -90, lon: 0 });
				});

				test('creates valid coordinate at maximum longitude', () => {
					const input: Coordinate = { lat: 0, lon: 180 };
					const result = coordinate(input);
					expect(result).toEqual({ lat: 0, lon: 180 });
				});

				test('creates valid coordinate at minimum longitude', () => {
					const input: Coordinate = { lat: 0, lon: -180 };
					const result = coordinate(input);
					expect(result).toEqual({ lat: 0, lon: -180 });
				});

				test('creates valid coordinates for major cities', () => {
					const cities = [
						{ lat: 51.5074, lon: -0.1278 }, // London
						{ lat: 40.7128, lon: -74.006 }, // New York
						{ lat: 35.6762, lon: 139.6503 }, // Tokyo
						{ lat: -23.5505, lon: -46.6333 }, // São Paulo
					];

					for (const city of cities) {
						const result = coordinate(city);
						expect(result).toEqual(city);
					}
				});

				test('handles high precision decimal values', () => {
					const input: Coordinate = { lat: 37.774929, lon: -122.419418 };
					const result = coordinate(input);
					expect(result).toEqual({ lat: 37.774929, lon: -122.419418 });
				});
			});

			describe('validation failures', () => {
				test('throws error when lat is missing', () => {
					const input = { lon: -122.4194 } as any;
					expect(() => coordinate(input)).toThrow();
				});

				test('throws error when lon is missing', () => {
					const input = { lat: 37.7749 } as any;
					expect(() => coordinate(input)).toThrow();
				});

				test('throws error when both fields are missing', () => {
					const input = {} as any;
					expect(() => coordinate(input)).toThrow();
				});

				test('throws error when lat exceeds maximum (90)', () => {
					const input = { lat: 90.1, lon: 0 } as any;
					expect(() => coordinate(input)).toThrow();
				});

				test('throws error when lat exceeds minimum (-90)', () => {
					const input = { lat: -90.1, lon: 0 } as any;
					expect(() => coordinate(input)).toThrow();
				});

				test('throws error when lon exceeds maximum (180)', () => {
					const input = { lat: 0, lon: 180.1 } as any;
					expect(() => coordinate(input)).toThrow();
				});

				test('throws error when lon exceeds minimum (-180)', () => {
					const input = { lat: 0, lon: -180.1 } as any;
					expect(() => coordinate(input)).toThrow();
				});

				test('throws error when lat is a string', () => {
					const input = { lat: '37.7749', lon: -122.4194 } as any;
					expect(() => coordinate(input)).toThrow();
				});

				test('throws error when lat is null', () => {
					const input = { lat: null, lon: -122.4194 } as any;
					expect(() => coordinate(input)).toThrow();
				});

				test('throws error when lat is undefined', () => {
					const input = { lat: undefined, lon: -122.4194 } as any;
					expect(() => coordinate(input)).toThrow();
				});

				test('throws error when lon is null', () => {
					const input = { lat: 37.7749, lon: null } as any;
					expect(() => coordinate(input)).toThrow();
				});

				test('throws error when lon is undefined', () => {
					const input = { lat: 37.7749, lon: undefined } as any;
					expect(() => coordinate(input)).toThrow();
				});

				test('rejects additional properties (strict validation)', () => {
					const input = { lat: 37.7749, lon: -122.4194, extra: 'field' } as any;
					expect(() => coordinate(input)).toThrow();
				});

				test('throws error when input is null', () => {
					expect(() => coordinate(null as any)).toThrow();
				});

				test('returns builder when input is undefined (TypeBox behavior)', () => {
					const result = coordinate(undefined as any);
					expect(result).toBeDefined();
					expect(typeof result.lat).toBe('function');
				});

				test('throws error when input is a string', () => {
					expect(() => coordinate('not an object' as any)).toThrow();
				});

				test('throws error when input is a number', () => {
					expect(() => coordinate(123 as any)).toThrow();
				});

				test('throws error when input is an array', () => {
					expect(() => coordinate([37.7749, -122.4194] as any)).toThrow();
				});
			});
		});

		describe('coordinate.parse()', () => {
			describe('success cases', () => {
				test('parses valid coordinate object', () => {
					const input = { lat: 37.7749, lon: -122.4194 };
					const result = coordinate.parse(input);
					expect(result).toEqual({ lat: 37.7749, lon: -122.4194 });
				});

				test('parses coordinate at boundaries', () => {
					const inputs = [
						{ lat: 90, lon: 180 },
						{ lat: -90, lon: -180 },
						{ lat: 0, lon: 0 },
					];

					for (const input of inputs) {
						const result = coordinate.parse(input);
						expect(result).toEqual(input);
					}
				});
			});

			describe('validation failures', () => {
				test('throws error when lat is missing', () => {
					const input = { lon: -122.4194 };
					expect(() => coordinate.parse(input)).toThrow();
				});

				test('throws error when lon is missing', () => {
					const input = { lat: 37.7749 };
					expect(() => coordinate.parse(input)).toThrow();
				});

				test('throws error when lat out of range', () => {
					const input = { lat: 91, lon: 0 };
					expect(() => coordinate.parse(input)).toThrow();
				});

				test('throws error when lon out of range', () => {
					const input = { lat: 0, lon: 181 };
					expect(() => coordinate.parse(input)).toThrow();
				});

				test('rejects additional properties (strict validation)', () => {
					const input = { lat: 37.7749, lon: -122.4194, extra: 'value' };
					expect(() => coordinate.parse(input)).toThrow();
				});

				test('throws error when input is null', () => {
					expect(() => coordinate.parse(null)).toThrow();
				});

				test('throws error when input is undefined', () => {
					expect(() => coordinate.parse(undefined)).toThrow();
				});

				test('throws error when input is not an object', () => {
					expect(() => coordinate.parse('string')).toThrow();
				});
			});
		});

		describe('coordinate.safeParse()', () => {
			describe('success cases', () => {
				test('returns success result for valid coordinate', () => {
					const input = { lat: 37.7749, lon: -122.4194 };
					const result = coordinate.safeParse(input);

					expect(result.success).toBe(true);
					if (result.success) {
						expect(result.data).toEqual({ lat: 37.7749, lon: -122.4194 });
					}
				});

				test('returns success result for boundary values', () => {
					const inputs = [
						{ lat: 90, lon: 180 },
						{ lat: -90, lon: -180 },
						{ lat: 0, lon: 0 },
					];

					for (const input of inputs) {
						const result = coordinate.safeParse(input);
						expect(result.success).toBe(true);
						if (result.success) {
							expect(result.data).toEqual(input);
						}
					}
				});
			});

			describe('failure cases - returns error object', () => {
				test('returns error when lat is missing', () => {
					const input = { lon: -122.4194 };
					const result = coordinate.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when lon is missing', () => {
					const input = { lat: 37.7749 };
					const result = coordinate.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when lat out of range', () => {
					const input = { lat: 91, lon: 0 };
					const result = coordinate.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when lon out of range', () => {
					const input = { lat: 0, lon: 181 };
					const result = coordinate.safeParse(input);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('rejects string values (strict validation)', () => {
					const input = { lat: '37.7749', lon: '-122.4194' };
					const result = coordinate.safeParse(input);

					expect(result.success).toBe(false);
				});

				test('rejects additional properties (strict validation)', () => {
					const input = { lat: 37.7749, lon: -122.4194, extra: 'field' };
					const result = coordinate.safeParse(input);

					expect(result.success).toBe(false);
				});

				test('returns error when input is null', () => {
					const result = coordinate.safeParse(null);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when input is undefined', () => {
					const result = coordinate.safeParse(undefined);

					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.error).toBeInstanceOf(Error);
					}
				});

				test('returns error when input is not an object', () => {
					const result = coordinate.safeParse('not an object');

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
				test('builds valid coordinate with positive values', () => {
					const result = coordinate().lat(37.7749).lon(-122.4194).build();
					expect(result).toEqual({ lat: 37.7749, lon: -122.4194 });
				});

				test('builds valid coordinate at equator and prime meridian', () => {
					const result = coordinate().lat(0).lon(0).build();
					expect(result).toEqual({ lat: 0, lon: 0 });
				});

				test('builds valid coordinate with negative latitude', () => {
					const result = coordinate().lat(-33.8688).lon(151.2093).build();
					expect(result).toEqual({ lat: -33.8688, lon: 151.2093 });
				});

				test('builds valid coordinate at North Pole', () => {
					const result = coordinate().lat(90).lon(0).build();
					expect(result).toEqual({ lat: 90, lon: 0 });
				});

				test('builds valid coordinate at South Pole', () => {
					const result = coordinate().lat(-90).lon(0).build();
					expect(result).toEqual({ lat: -90, lon: 0 });
				});

				test('builds valid coordinate at maximum longitude', () => {
					const result = coordinate().lat(0).lon(180).build();
					expect(result).toEqual({ lat: 0, lon: 180 });
				});

				test('builds valid coordinate at minimum longitude', () => {
					const result = coordinate().lat(0).lon(-180).build();
					expect(result).toEqual({ lat: 0, lon: -180 });
				});

				test('supports reverse order of method calls', () => {
					const result = coordinate().lon(-122.4194).lat(37.7749).build();
					expect(result).toEqual({ lat: 37.7749, lon: -122.4194 });
				});

				test('allows overwriting lat', () => {
					const result = coordinate().lat(40).lat(37.7749).lon(-122.4194).build();
					expect(result).toEqual({ lat: 37.7749, lon: -122.4194 });
				});

				test('allows overwriting lon', () => {
					const result = coordinate().lat(37.7749).lon(-74).lon(-122.4194).build();
					expect(result).toEqual({ lat: 37.7749, lon: -122.4194 });
				});

				test('builds with point() method', () => {
					const result = coordinate().point(37.7749, -122.4194).build();
					expect(result).toEqual({ lat: 37.7749, lon: -122.4194 });
				});

				test('point() method overwrites previous values', () => {
					const result = coordinate().lat(40).lon(-74).point(37.7749, -122.4194).build();
					expect(result).toEqual({ lat: 37.7749, lon: -122.4194 });
				});

				test('individual methods can override point()', () => {
					const result = coordinate().point(40, -74).lat(37.7749).build();
					expect(result).toEqual({ lat: 37.7749, lon: -74 });
				});

				test('handles high precision decimal values', () => {
					const result = coordinate().lat(37.774929).lon(-122.419418).build();
					expect(result).toEqual({ lat: 37.774929, lon: -122.419418 });
				});
			});

			describe('validation failures on build()', () => {
				test('throws error when lat is not set', () => {
					expect(() => coordinate().lon(-122.4194).build()).toThrow();
				});

				test('throws error when lon is not set', () => {
					expect(() => coordinate().lat(37.7749).build()).toThrow();
				});

				test('throws error when neither field is set', () => {
					expect(() => coordinate().build()).toThrow();
				});

				test('throws error when lat exceeds maximum (90)', () => {
					expect(() => coordinate().lat(90.1).lon(0).build()).toThrow();
				});

				test('throws error when lat exceeds minimum (-90)', () => {
					expect(() => coordinate().lat(-90.1).lon(0).build()).toThrow();
				});

				test('throws error when lon exceeds maximum (180)', () => {
					expect(() => coordinate().lat(0).lon(180.1).build()).toThrow();
				});

				test('throws error when lon exceeds minimum (-180)', () => {
					expect(() => coordinate().lat(0).lon(-180.1).build()).toThrow();
				});

				test('throws error when lat is Infinity', () => {
					expect(() => coordinate().lat(Infinity).lon(0).build()).toThrow();
				});

				test('throws error when lat is -Infinity', () => {
					expect(() => coordinate().lat(-Infinity).lon(0).build()).toThrow();
				});

				test('throws error when lat is NaN', () => {
					expect(() => coordinate().lat(NaN).lon(0).build()).toThrow();
				});

				test('throws error when lon is Infinity', () => {
					expect(() => coordinate().lat(0).lon(Infinity).build()).toThrow();
				});

				test('throws error when lon is -Infinity', () => {
					expect(() => coordinate().lat(0).lon(-Infinity).build()).toThrow();
				});

				test('throws error when lon is NaN', () => {
					expect(() => coordinate().lat(0).lon(NaN).build()).toThrow();
				});

				test('throws error when point() called with out-of-range lat', () => {
					expect(() => coordinate().point(91, 0).build()).toThrow();
				});

				test('throws error when point() called with out-of-range lon', () => {
					expect(() => coordinate().point(0, 181).build()).toThrow();
				});
			});

			describe('builder instance behavior', () => {
				test('returns CoordinateBuilder instance when called with no arguments', () => {
					const builder = coordinate();
					expect(builder).toBeDefined();
					expect(typeof builder.lat).toBe('function');
					expect(typeof builder.lon).toBe('function');
					expect(typeof builder.point).toBe('function');
					expect(typeof builder.build).toBe('function');
				});

				test('builder methods return this for chaining', () => {
					const builder = coordinate();
					const afterLat = builder.lat(37.7749);
					const afterLon = afterLat.lon(-122.4194);

					expect(afterLat).toBe(builder);
					expect(afterLon).toBe(builder);
				});

				test('point method returns this for chaining', () => {
					const builder = coordinate();
					const afterPoint = builder.point(37.7749, -122.4194);

					expect(afterPoint).toBe(builder);
				});

				test('multiple builders are independent', () => {
					const builder1 = coordinate().lat(37.7749).lon(-122.4194);
					const builder2 = coordinate().lat(40.7128).lon(-74.006);

					expect(builder1.build()).toEqual({ lat: 37.7749, lon: -122.4194 });
					expect(builder2.build()).toEqual({ lat: 40.7128, lon: -74.006 });
				});

				test('builder can be reused after build', () => {
					const builder = coordinate().lat(37.7749).lon(-122.4194);
					const result1 = builder.build();
					const result2 = builder.build();

					expect(result1).toEqual({ lat: 37.7749, lon: -122.4194 });
					expect(result2).toEqual({ lat: 37.7749, lon: -122.4194 });
				});

				test('modifying builder after build affects subsequent builds', () => {
					const builder = coordinate().lat(37.7749).lon(-122.4194);
					const result1 = builder.build();

					builder.lat(40.7128);
					const result2 = builder.build();

					expect(result1).toEqual({ lat: 37.7749, lon: -122.4194 });
					expect(result2).toEqual({ lat: 40.7128, lon: -122.4194 });
				});
			});

			describe('edge cases and special scenarios', () => {
				test('handles floating point precision', () => {
					const result = coordinate().lat(0.1 + 0.2).lon(0).build();
					expect(result.lat).toBeCloseTo(0.3);
				});

				test('preserves exact decimal values', () => {
					const result = coordinate().lat(37.774929).lon(-122.419418).build();
					expect(result.lat).toBe(37.774929);
					expect(result.lon).toBe(-122.419418);
				});

				});

			describe('common usage patterns', () => {
				test('creates San Francisco coordinates', () => {
					const result = coordinate().lat(37.7749).lon(-122.4194).build();
					expect(result).toEqual({ lat: 37.7749, lon: -122.4194 });
				});

				test('creates London coordinates', () => {
					const result = coordinate().lat(51.5074).lon(-0.1278).build();
					expect(result).toEqual({ lat: 51.5074, lon: -0.1278 });
				});

				test('creates Tokyo coordinates', () => {
					const result = coordinate().lat(35.6762).lon(139.6503).build();
					expect(result).toEqual({ lat: 35.6762, lon: 139.6503 });
				});

				test('creates Sydney coordinates', () => {
					const result = coordinate().lat(-33.8688).lon(151.2093).build();
					expect(result).toEqual({ lat: -33.8688, lon: 151.2093 });
				});

				test('creates coordinates using point() helper', () => {
					const result = coordinate().point(40.7128, -74.006).build();
					expect(result).toEqual({ lat: 40.7128, lon: -74.006 });
				});
			});

			describe('builder pattern vs object pattern comparison', () => {
				test('builder pattern produces same result as object pattern', () => {
					const builderResult = coordinate().lat(37.7749).lon(-122.4194).build();
					const objectResult = coordinate({ lat: 37.7749, lon: -122.4194 });

					expect(builderResult).toEqual(objectResult);
				});

				test('point() method produces same result as object pattern', () => {
					const builderResult = coordinate().point(37.7749, -122.4194).build();
					const objectResult = coordinate({ lat: 37.7749, lon: -122.4194 });

					expect(builderResult).toEqual(objectResult);
				});

				test('builder pattern validates on build(), object pattern validates immediately', () => {
					// Builder - no error until build()
					const builder = coordinate().lat(91).lon(0);
					expect(() => builder.build()).toThrow();

					// Object - error immediately
					expect(() => coordinate({ lat: 91, lon: 0 } as any)).toThrow();
				});
			});

			describe('partial builder state', () => {
				test('builder can exist with no fields set', () => {
					const builder = coordinate();
					expect(builder).toBeDefined();
				});

				test('builder can exist with only lat set', () => {
					const builder = coordinate().lat(37.7749);
					expect(builder).toBeDefined();
					expect(() => builder.build()).toThrow(); // But build fails
				});

				test('builder can exist with only lon set', () => {
					const builder = coordinate().lon(-122.4194);
					expect(builder).toBeDefined();
					expect(() => builder.build()).toThrow(); // But build fails
				});

				test('builder validates only on build() call', () => {
					const builder = coordinate();
					builder.lat(91); // Out of range, but no error yet
					builder.lon(0);
					expect(() => builder.build()).toThrow(); // Error only on build
				});
			});

			describe('point() method behavior', () => {
				test('point() sets both lat and lon', () => {
					const result = coordinate().point(37.7749, -122.4194).build();
					expect(result).toEqual({ lat: 37.7749, lon: -122.4194 });
				});

				test('point() can be called multiple times', () => {
					const result = coordinate()
						.point(40, -74)
						.point(37.7749, -122.4194)
						.build();
					expect(result).toEqual({ lat: 37.7749, lon: -122.4194 });
				});

				test('point() works with method chaining', () => {
					const result = coordinate().point(37.7749, -122.4194).lat(40).build();
					expect(result).toEqual({ lat: 40, lon: -122.4194 });
				});

				test('point() validates both parameters on build', () => {
					expect(() => coordinate().point(91, 0).build()).toThrow();
					expect(() => coordinate().point(0, 181).build()).toThrow();
				});
			});
		});
	});
});
