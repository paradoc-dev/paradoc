/**
 * Core shared types for @paradoc/expr: source spans, the expression type
 * system, and diagnostics. Consumed by the parser, evaluator, and checker.
 */

/** A 0-based byte offset plus 1-based line/column into the source string. */
export interface Position {
	readonly offset: number
	readonly line: number
	readonly column: number
}

/** A source span `[start, end)` over the original expression text. */
export interface Span {
	readonly start: Position
	readonly end: Position
}

/** Primitive (non-parameterized) type kinds in the language. */
export type PrimitiveTypeKind =
	| 'string'
	| 'number' // exact decimal at runtime
	| 'boolean'
	| 'date'
	| 'datetime'
	| 'time'
	| 'duration'
	| 'money' // { amount: number, currency: string }
	| 'object' // structured composite / fieldset record
	| 'null'
	| 'unknown' // unresolved; degrades type-checking to a warning

/** A type in the language. Arrays carry their element type (`array<T>`). */
export type ExprType =
	| { readonly kind: PrimitiveTypeKind }
	| { readonly kind: 'array'; readonly element: ExprType }

/** Terse constructors, e.g. `T.array(T.string)`. */
export const T = {
	string: { kind: 'string' } as ExprType,
	number: { kind: 'number' } as ExprType,
	boolean: { kind: 'boolean' } as ExprType,
	date: { kind: 'date' } as ExprType,
	datetime: { kind: 'datetime' } as ExprType,
	time: { kind: 'time' } as ExprType,
	duration: { kind: 'duration' } as ExprType,
	money: { kind: 'money' } as ExprType,
	object: { kind: 'object' } as ExprType,
	null: { kind: 'null' } as ExprType,
	unknown: { kind: 'unknown' } as ExprType,
	array: (element: ExprType): ExprType => ({ kind: 'array', element }),
} as const

/** Human-readable rendering, e.g. `array<string>`. */
export function formatType(t: ExprType): string {
	return t.kind === 'array' ? `array<${formatType(t.element)}>` : t.kind
}

/** Structural type equality. */
export function typesEqual(a: ExprType, b: ExprType): boolean {
	if (a.kind === 'array' && b.kind === 'array') {
		return typesEqual(a.element, b.element)
	}
	return a.kind === b.kind
}

/** Diagnostic severity. Errors block authoring; warnings inform. */
export type Severity = 'error' | 'warning'

/** Stable diagnostic codes. Extended as the checker grows. */
export type DiagnosticCode =
	| 'syntax'
	| 'unknown-identifier'
	| 'unknown-function'
	| 'type-mismatch'
	| 'arity'
	| 'non-boolean-gate'
	| 'circular-defs'
	| 'forbidden-operator' // '=' used as an operator, '||', '&&'
	| 'non-deterministic' // random() and similar
	| 'division-by-zero'

export interface Diagnostic {
	readonly severity: Severity
	readonly code: DiagnosticCode
	readonly message: string
	readonly span: Span
}
