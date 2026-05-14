/**
 * Buildable utilities for artifacts.
 *
 * Allows accepting either raw values or builder objects with a build() method.
 */

export type Buildable<T> = T | { build(): T };

export type BuildableRecord<T extends Record<string, unknown>> = {
	[K in keyof T]: Buildable<T[K]>;
};

export type BuildableArray<T> = Array<Buildable<T>>;

const hasBuildMethod = (value: unknown): value is { build: () => unknown } => {
	if (
		(value !== null && typeof value === 'object') ||
		typeof value === 'function'
	) {
		return (
			'build' in (value as Record<string, unknown>) &&
			typeof (value as { build?: () => unknown }).build === 'function'
		);
	}
	return false;
};

export const resolveBuildable = <T>(value: Buildable<T>): T => {
	if (hasBuildMethod(value)) {
		return value.build() as T;
	}
	return value;
};
