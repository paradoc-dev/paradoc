import { describe, test, expect } from 'vitest';
import { bbox } from '@/primitives/bbox';
import type { Bbox } from '@paradoc/types';

describe('Bbox', () => {
	// ============================================================================
	// Object Pattern Tests
	// ============================================================================

	describe('Object Pattern', () => {
		describe('bbox() - direct validation', () => {
			describe('success cases', () => {
				test('creates valid bbox with positive coordinates', () => {
					const input: Bbox = {
						southWest: { lat: 37.7396, lon: -122.4863 },
						northEast: { lat: 37.7749, lon: -122.4194 },
					};
					const result = bbox(input);
					expect(result).toEqual({
						southWest: { lat: 37.7396, lon: -122.4863 },
						northEast: { lat: 37.7749, lon: -122.4194 },
					});
				});

				test('creates valid bbox spanning equator', () => {
					const input: Bbox = {
						southWest: { lat: -10, lon: -10 },
						northEast: { lat: 10, lon: 10 },
					};
					const result = bbox(input);
					expect(result).toEqual({
						southWest: { lat: -10, lon: -10 },
						northEast: { lat: 10, lon: 10 },
					});
				});

				test('creates valid bbox with maximum size', () => {
					const input: Bbox = {
						southWest: { lat: -90, lon: -180 },
						northEast: { lat: 90, lon: 180 },
					};
					const result = bbox(input);
					expect(result).toEqual({
						southWest: { lat: -90, lon: -180 },
						northEast: { lat: 90, lon: 180 },
					});
				});
			});

			describe('validation failures', () => {
				test('throws error when southWest is missing', () => {
					const input = {
						northEast: { lat: 37.7749, lon: -122.4194 },
					} as any;
					expect(() => bbox(input)).toThrow();
				});

				test('throws error when northEast is missing', () => {
					const input = {
						southWest: { lat: 37.7396, lon: -122.4863 },
					} as any;
					expect(() => bbox(input)).toThrow();
				});

				test('throws error when southWest.lat equals northEast.lat', () => {
					const input = {
						southWest: { lat: 37.7749, lon: -122.4863 },
						northEast: { lat: 37.7749, lon: -122.4194 },
					} as any;
					expect(() => bbox(input)).toThrow('southWest.lat');
				});

				test('throws error when southWest.lat exceeds northEast.lat', () => {
					const input = {
						southWest: { lat: 40, lon: -122.4863 },
						northEast: { lat: 37.7749, lon: -122.4194 },
					} as any;
					expect(() => bbox(input)).toThrow('southWest.lat');
				});

				test('throws error when southWest.lon exceeds northEast.lon', () => {
					const input = {
						southWest: { lat: 37.7396, lon: -120 },
						northEast: { lat: 37.7749, lon: -122.4194 },
					} as any;
					expect(() => bbox(input)).toThrow('southWest.lon');
				});
			});
		});

		describe('bbox.safeParse()', () => {
			test('returns success result for valid bbox', () => {
				const input = {
					southWest: { lat: 37.7396, lon: -122.4863 },
					northEast: { lat: 37.7749, lon: -122.4194 },
				};
				const result = bbox.safeParse(input);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.data).toEqual({
						southWest: { lat: 37.7396, lon: -122.4863 },
						northEast: { lat: 37.7749, lon: -122.4194 },
					});
				}
			});

			test('returns error when southWest.lat >= northEast.lat', () => {
				const input = {
					southWest: { lat: 40, lon: -122.4863 },
					northEast: { lat: 37.7749, lon: -122.4194 },
				};
				const result = bbox.safeParse(input);

				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error).toBeInstanceOf(Error);
					expect(result.error.message).toContain('southWest.lat');
				}
			});
		});
	});

	// ============================================================================
	// Builder Pattern Tests
	// ============================================================================

	describe('Builder Pattern', () => {
		describe('fluent builder API', () => {
			describe('success cases', () => {
				test('builds valid bbox with southWest and northEast', () => {
					const result = bbox()
						.southWest({ lat: 37.7396, lon: -122.4863 })
						.northEast({ lat: 37.7749, lon: -122.4194 })
						.build();
					expect(result).toEqual({
						southWest: { lat: 37.7396, lon: -122.4863 },
						northEast: { lat: 37.7749, lon: -122.4194 },
					});
				});

				test('builds valid bbox with maximum size', () => {
					const result = bbox()
						.southWest({ lat: -90, lon: -180 })
						.northEast({ lat: 90, lon: 180 })
						.build();
					expect(result).toEqual({
						southWest: { lat: -90, lon: -180 },
						northEast: { lat: 90, lon: 180 },
					});
				});

				test('supports reverse order of method calls', () => {
					const result = bbox()
						.northEast({ lat: 37.7749, lon: -122.4194 })
						.southWest({ lat: 37.7396, lon: -122.4863 })
						.build();
					expect(result).toEqual({
						southWest: { lat: 37.7396, lon: -122.4863 },
						northEast: { lat: 37.7749, lon: -122.4194 },
					});
				});

				test('builds with bounds() method', () => {
					const result = bbox()
						.bounds(
							{ lat: 37.7396, lon: -122.4863 },
							{ lat: 37.7749, lon: -122.4194 },
						)
						.build();
					expect(result).toEqual({
						southWest: { lat: 37.7396, lon: -122.4863 },
						northEast: { lat: 37.7749, lon: -122.4194 },
					});
				});
			});

			describe('validation failures on build()', () => {
				test('throws error when southWest is not set', () => {
					expect(() =>
						bbox().northEast({ lat: 37.7749, lon: -122.4194 }).build(),
					).toThrow();
				});

				test('throws error when northEast is not set', () => {
					expect(() =>
						bbox().southWest({ lat: 37.7396, lon: -122.4863 }).build(),
					).toThrow();
				});

				test('throws error when neither corner is set', () => {
					expect(() => bbox().build()).toThrow();
				});

				test('throws error when southWest.lat exceeds northEast.lat', () => {
					expect(() =>
						bbox()
							.southWest({ lat: 40, lon: -122.4863 })
							.northEast({ lat: 37.7749, lon: -122.4194 })
							.build(),
					).toThrow('southWest.lat');
				});

				test('throws error when southWest.lon exceeds northEast.lon', () => {
					expect(() =>
						bbox()
							.southWest({ lat: 37.7396, lon: -120 })
							.northEast({ lat: 37.7749, lon: -122.4194 })
							.build(),
					).toThrow('southWest.lon');
				});
			});

			describe('builder instance behavior', () => {
				test('returns BboxBuilder instance when called with no arguments', () => {
					const builder = bbox();
					expect(builder).toBeDefined();
					expect(typeof builder.southWest).toBe('function');
					expect(typeof builder.northEast).toBe('function');
					expect(typeof builder.bounds).toBe('function');
					expect(typeof builder.build).toBe('function');
				});

				test('builder methods return this for chaining', () => {
					const builder = bbox();
					const afterSouthWest = builder.southWest({ lat: 37.7396, lon: -122.4863 });
					const afterNorthEast = afterSouthWest.northEast({
						lat: 37.7749,
						lon: -122.4194,
					});

					expect(afterSouthWest).toBe(builder);
					expect(afterNorthEast).toBe(builder);
				});

				test('multiple builders are independent', () => {
					const builder1 = bbox()
						.southWest({ lat: 37.7396, lon: -122.4863 })
						.northEast({ lat: 37.7749, lon: -122.4194 });
					const builder2 = bbox()
						.southWest({ lat: 40.7128, lon: -74.006 })
						.northEast({ lat: 40.7589, lon: -73.9857 });

					expect(builder1.build()).toEqual({
						southWest: { lat: 37.7396, lon: -122.4863 },
						northEast: { lat: 37.7749, lon: -122.4194 },
					});
					expect(builder2.build()).toEqual({
						southWest: { lat: 40.7128, lon: -74.006 },
						northEast: { lat: 40.7589, lon: -73.9857 },
					});
				});
			});

			describe('builder pattern vs object pattern comparison', () => {
				test('builder pattern produces same result as object pattern', () => {
					const builderResult = bbox()
						.southWest({ lat: 37.7396, lon: -122.4863 })
						.northEast({ lat: 37.7749, lon: -122.4194 })
						.build();
					const objectResult = bbox({
						southWest: { lat: 37.7396, lon: -122.4863 },
						northEast: { lat: 37.7749, lon: -122.4194 },
					});

					expect(builderResult).toEqual(objectResult);
				});

				test('bounds() method produces same result as object pattern', () => {
					const builderResult = bbox()
						.bounds(
							{ lat: 37.7396, lon: -122.4863 },
							{ lat: 37.7749, lon: -122.4194 },
						)
						.build();
					const objectResult = bbox({
						southWest: { lat: 37.7396, lon: -122.4863 },
						northEast: { lat: 37.7749, lon: -122.4194 },
					});

					expect(builderResult).toEqual(objectResult);
				});
			});
		});
	});
});
