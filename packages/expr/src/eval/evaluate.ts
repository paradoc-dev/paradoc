/**
 * The tree-walking evaluator. Null-safe member access, polymorphic `+`,
 * exact-decimal arithmetic, short-circuiting logic, membership, ternary, and
 * function dispatch (host-injected functions first, then builtins).
 */

import type { Expr } from '../ast/nodes'
import { Decimal, DivisionByZeroError } from '../decimal/decimal'
import { parse } from '../parser/parser'
import type { Diagnostic } from '../types'
import { EvaluationError, type EvalErrorCode } from './errors'
import { BUILTIN_IMPLS } from './functions'
import { NULL, Values, truthy, valueEquals, valueToString, type Value } from './values'
import type { EvaluationContext } from './context'

export function evaluate(node: Expr, ctx: EvaluationContext): Value {
	switch (node.kind) {
		case 'NumberLiteral':
			return Values.number(Decimal.fromString(node.value))
		case 'StringLiteral':
			return Values.string(node.value)
		case 'BooleanLiteral':
			return Values.boolean(node.value)
		case 'NullLiteral':
			return NULL
		case 'ArrayLiteral':
			return Values.array(node.elements.map((el) => evaluate(el, ctx)))
		case 'Identifier':
			return ctx.lookup(node.name) ?? NULL
		case 'Member': {
			const obj = evaluate(node.object, ctx)
			if (obj.kind === 'object') return obj.value.get(node.property) ?? NULL
			return NULL // null-safe: missing/non-object parent yields null
		}
		case 'Index': {
			const obj = evaluate(node.object, ctx)
			const idx = evaluate(node.index, ctx)
			if (obj.kind === 'array' && idx.kind === 'number') {
				return obj.value[idx.value.toNumber()] ?? NULL
			}
			return NULL
		}
		case 'Unary':
			return evalUnary(node.op, evaluate(node.operand, ctx))
		case 'Binary':
			return evalBinary(node.op, node, ctx)
		case 'Logical':
			return evalLogical(node.op, node, ctx)
		case 'Membership':
			return evalMembership(node, ctx)
		case 'Conditional':
			return truthy(evaluate(node.test, ctx))
				? evaluate(node.consequent, ctx)
				: evaluate(node.alternate, ctx)
		case 'Call':
			return evalCall(node, ctx)
	}
}

function evalUnary(op: 'not' | 'neg', operand: Value): Value {
	if (op === 'not') return Values.boolean(!truthy(operand))
	if (operand.kind !== 'number') {
		throw new EvaluationError('type-error', `Cannot negate ${operand.kind}`)
	}
	return Values.number(operand.value.neg())
}

function evalBinary(op: string, node: Extract<Expr, { kind: 'Binary' }>, ctx: EvaluationContext): Value {
	const left = evaluate(node.left, ctx)
	const right = evaluate(node.right, ctx)

	switch (op) {
		case '==':
			return Values.boolean(valueEquals(left, right))
		case '!=':
			return Values.boolean(!valueEquals(left, right))
		case '<':
		case '<=':
		case '>':
		case '>=':
			return compareOrdered(op, left, right)
		case '+':
			if (left.kind === 'number' && right.kind === 'number') {
				return Values.number(left.value.add(right.value))
			}
			if (left.kind === 'string' || right.kind === 'string') {
				return Values.string(valueToString(left) + valueToString(right))
			}
			throw new EvaluationError('type-error', `Cannot add ${left.kind} and ${right.kind}`)
		case '-':
		case '*':
		case '/':
		case '%':
			return arithmetic(op, left, right)
		default:
			throw new EvaluationError('type-error', `Unknown operator ${op}`)
	}
}

function arithmetic(op: string, left: Value, right: Value): Value {
	if (left.kind !== 'number' || right.kind !== 'number') {
		throw new EvaluationError('type-error', `Operator '${op}' requires numbers, got ${left.kind} and ${right.kind}`)
	}
	try {
		switch (op) {
			case '-':
				return Values.number(left.value.sub(right.value))
			case '*':
				return Values.number(left.value.mul(right.value))
			case '/':
				return Values.number(left.value.div(right.value))
			case '%':
				return Values.number(left.value.mod(right.value))
			default:
				throw new EvaluationError('type-error', `Unknown operator ${op}`)
		}
	} catch (e) {
		if (e instanceof DivisionByZeroError) {
			throw new EvaluationError('division-by-zero', 'Division by zero')
		}
		throw e
	}
}

function compareOrdered(op: string, left: Value, right: Value): Value {
	let c: number
	if (left.kind === 'number' && right.kind === 'number') {
		c = left.value.cmp(right.value)
	} else if (left.kind === 'string' && right.kind === 'string') {
		c = left.value < right.value ? -1 : left.value > right.value ? 1 : 0
	} else {
		// Incomparable or missing (null) operands degrade to false at runtime; the
		// checker reports genuine type mismatches at authoring time.
		return Values.boolean(false)
	}
	switch (op) {
		case '<':
			return Values.boolean(c < 0)
		case '<=':
			return Values.boolean(c <= 0)
		case '>':
			return Values.boolean(c > 0)
		default:
			return Values.boolean(c >= 0)
	}
}

function evalLogical(op: 'and' | 'or', node: Extract<Expr, { kind: 'Logical' }>, ctx: EvaluationContext): Value {
	const left = truthy(evaluate(node.left, ctx))
	if (op === 'and') return left ? Values.boolean(truthy(evaluate(node.right, ctx))) : Values.boolean(false)
	return left ? Values.boolean(true) : Values.boolean(truthy(evaluate(node.right, ctx)))
}

function evalMembership(node: Extract<Expr, { kind: 'Membership' }>, ctx: EvaluationContext): Value {
	const element = evaluate(node.element, ctx)
	const collection = evaluate(node.collection, ctx)
	let present: boolean
	if (collection.kind === 'array') {
		present = collection.value.some((el) => valueEquals(el, element))
	} else if (collection.kind === 'string') {
		if (element.kind !== 'string') {
			throw new EvaluationError('type-error', `Cannot test ${element.kind} membership in a string`)
		}
		present = collection.value.includes(element.value)
	} else if (collection.kind === 'null') {
		present = false
	} else {
		throw new EvaluationError('type-error', `'in' requires an array or string, got ${collection.kind}`)
	}
	return Values.boolean(node.negated ? !present : present)
}

function evalCall(node: Extract<Expr, { kind: 'Call' }>, ctx: EvaluationContext): Value {
	const args = node.args.map((a) => evaluate(a, ctx))
	const host = ctx.hostFunctions?.[node.callee]
	if (host) return host(args)
	const impl = BUILTIN_IMPLS[node.callee]
	if (impl) return impl(args, ctx)
	throw new EvaluationError('unknown-function', `Unknown function: ${node.callee}`)
}

// --- public surface ---

export type EvalResult =
	| { readonly success: true; readonly value: Value }
	| { readonly success: false; readonly error: string; readonly code?: EvalErrorCode; readonly diagnostics?: readonly Diagnostic[] }

/** Parse and evaluate a source expression, capturing errors as a result. */
export function evaluateExpression(source: string, ctx: EvaluationContext): EvalResult {
	const { ast, errors } = parse(source)
	if (!ast) {
		return { success: false, error: errors[0]?.message ?? 'Parse error', diagnostics: errors }
	}
	try {
		return { success: true, value: evaluate(ast, ctx) }
	} catch (e) {
		if (e instanceof EvaluationError) return { success: false, error: e.message, code: e.code }
		throw e
	}
}

/**
 * Evaluate an expression in a boolean gate context, returning `defaultValue`
 * when it is undefined or fails (the default-on-failure gate semantics). A
 * boolean literal short-circuits without parsing.
 */
export function evaluateBoolean(
	condExpr: boolean | string | undefined,
	ctx: EvaluationContext,
	defaultValue: boolean,
): boolean {
	if (condExpr === undefined) return defaultValue
	if (typeof condExpr === 'boolean') return condExpr
	const result = evaluateExpression(condExpr, ctx)
	return result.success ? truthy(result.value) : defaultValue
}
