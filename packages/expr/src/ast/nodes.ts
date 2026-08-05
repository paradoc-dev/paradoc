/**
 * The typed AST produced by the parser and consumed by both the evaluator and
 * the checker. Every node carries a source `span` so diagnostics can point at
 * exact positions.
 *
 * Numeric literals keep their raw lexeme (`value: string`) so the evaluator can
 * parse them into exact decimals without an intermediate float that would lose
 * precision.
 */

import type { Span } from '../types'

interface NodeBase {
	readonly span: Span
}

export interface NumberLiteral extends NodeBase {
	readonly kind: 'NumberLiteral'
	/** Raw lexeme, parsed to exact decimal by the evaluator. */
	readonly value: string
}

export interface StringLiteral extends NodeBase {
	readonly kind: 'StringLiteral'
	readonly value: string
}

export interface BooleanLiteral extends NodeBase {
	readonly kind: 'BooleanLiteral'
	readonly value: boolean
}

export interface NullLiteral extends NodeBase {
	readonly kind: 'NullLiteral'
}

export interface ArrayLiteral extends NodeBase {
	readonly kind: 'ArrayLiteral'
	readonly elements: readonly Expr[]
}

/** A bare reference: a defs key, or a context root such as `fields`. */
export interface Identifier extends NodeBase {
	readonly kind: 'Identifier'
	readonly name: string
}

/** Dotted member access `object.property`. Null-safe at evaluation. */
export interface Member extends NodeBase {
	readonly kind: 'Member'
	readonly object: Expr
	readonly property: string
}

/** Indexed access `object[index]`, including list-field values. */
export interface Index extends NodeBase {
	readonly kind: 'Index'
	readonly object: Expr
	readonly index: Expr
}

export type UnaryOp = 'not' | 'neg'

export interface Unary extends NodeBase {
	readonly kind: 'Unary'
	readonly op: UnaryOp
	readonly operand: Expr
}

export type ArithmeticOp = '+' | '-' | '*' | '/' | '%'
export type ComparisonOp = '==' | '!=' | '<' | '<=' | '>' | '>='
/** `+` is polymorphic: numeric add or string concat, resolved by operand type. */
export type BinaryOp = ArithmeticOp | ComparisonOp

export interface Binary extends NodeBase {
	readonly kind: 'Binary'
	readonly op: BinaryOp
	readonly left: Expr
	readonly right: Expr
}

export type LogicalOp = 'and' | 'or'

export interface Logical extends NodeBase {
	readonly kind: 'Logical'
	readonly op: LogicalOp
	readonly left: Expr
	readonly right: Expr
}

/** `element in collection` / `element not in collection`. */
export interface Membership extends NodeBase {
	readonly kind: 'Membership'
	readonly negated: boolean
	readonly element: Expr
	readonly collection: Expr
}

/** Ternary `test ? consequent : alternate`. */
export interface Conditional extends NodeBase {
	readonly kind: 'Conditional'
	readonly test: Expr
	readonly consequent: Expr
	readonly alternate: Expr
}

/** A function call by name. Functions are not first-class values. */
export interface Call extends NodeBase {
	readonly kind: 'Call'
	readonly callee: string
	readonly args: readonly Expr[]
}

export type Expr =
	| NumberLiteral
	| StringLiteral
	| BooleanLiteral
	| NullLiteral
	| ArrayLiteral
	| Identifier
	| Member
	| Index
	| Unary
	| Binary
	| Logical
	| Membership
	| Conditional
	| Call

export type ExprKind = Expr['kind']
