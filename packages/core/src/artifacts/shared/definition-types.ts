/**
 * Type helpers for separating readonly generated input from mutable authoring
 * definitions. Generated modules commonly use `as const`, while the public
 * artifact model remains mutable for builder and authoring workflows.
 */
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
	? T
	: T extends readonly unknown[]
		? { readonly [K in keyof T]: DeepReadonly<T[K]> }
		: T extends object
			? { readonly [K in keyof T]: DeepReadonly<T[K]> }
			: T

export type DeepMutable<T> = T extends readonly unknown[]
	? { -readonly [K in keyof T]: DeepMutable<T[K]> }
	: T extends object
		? { -readonly [K in keyof T]: DeepMutable<T[K]> }
		: T
