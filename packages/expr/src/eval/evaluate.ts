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
import { buildRegistry } from '../registry/registry'
import type { ExprType } from '../types'
import { validateDate, validateDateDuration, validateDatetime } from './temporal'

const DEFAULT_REGISTRY = buildRegistry()

function isValue(value: unknown): value is Value {
	if (!value || typeof value !== 'object' || !('kind' in value)) return false
	const candidate = value as { kind?: unknown; value?: unknown }
	if (candidate.kind === 'null') return true
	if (candidate.kind === 'boolean') return typeof candidate.value === 'boolean'
	if (candidate.kind === 'string') return typeof candidate.value === 'string'
	if (candidate.kind === 'number') return candidate.value instanceof Decimal
	if (candidate.kind === 'array') return Array.isArray(candidate.value) && candidate.value.every(isValue)
	if (candidate.kind === 'object') return candidate.value instanceof Map && [...candidate.value.values()].every(isValue)
	return false
}

function valueMatchesType(value: Value, type: ExprType): boolean {
	if (type.kind === 'unknown') return true
	if (value.kind === 'string' && type.kind === 'date') { try { validateDate(value.value); return true } catch { return false } }
	if (value.kind === 'string' && type.kind === 'datetime') { try { validateDatetime(value.value); return true } catch { return false } }
	if (value.kind === 'string' && type.kind === 'duration') { try { validateDateDuration(value.value); return true } catch { return false } }
	if (value.kind === 'string' && type.kind === 'time') return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/.test(value.value)
	if (type.kind === 'money' || type.kind === 'object') return value.kind === 'object'
	if (type.kind === 'array') return value.kind === 'array' && value.value.every((item) => valueMatchesType(item, type.element))
	return value.kind === type.kind
}

function typeOfValue(value: Value): ExprType {
	if (value.kind === 'array') return { kind: 'array', element: value.value[0] ? typeOfValue(value.value[0]) : { kind: 'unknown' } }
	if (value.kind === 'object') return { kind: 'object' }
	return { kind: value.kind }
}

function resolvedReturnType(sig: ReturnType<NonNullable<EvaluationContext['registry']>['get']>, args: readonly Value[]): ExprType | undefined {
	if (!sig) return undefined
	if (sig.returns.kind === 'fixed') return sig.returns.type
	if (sig.returns.kind === 'elementOf') {
		const value = args[sig.returns.arg]
		return value?.kind === 'array' && value.value[0] ? typeOfValue(value.value[0]) : undefined
	}
	const nonNull = args.filter((arg) => arg.kind !== 'null')
	const first = nonNull[0]
	return first && nonNull.every((arg) => arg.kind === first.kind) ? typeOfValue(first) : undefined
}

export function evaluate(node: Expr, ctx: EvaluationContext): Value {
	try {
		return evaluateNode(node, ctx)
	} catch (error) {
		if (error instanceof EvaluationError) {
			if (error.span) throw error
			throw new EvaluationError(error.code, error.message, node.span)
		}
		if (error instanceof RangeError) throw new EvaluationError('limit-exceeded', error.message, node.span)
		throw error
	}
}

function evaluateNode(node: Expr, ctx: EvaluationContext): Value {
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
	const sig = (ctx.registry ?? DEFAULT_REGISTRY).get(node.callee)
	if (!sig) throw new EvaluationError('unknown-function', `Unknown function: ${node.callee}`)
	const required = sig.params.filter((param) => !param.optional).length
	const maximum = sig.variadic ? Infinity : sig.params.length
	if (node.args.length < required || node.args.length > maximum) {
		throw new EvaluationError('arity', `${node.callee} expects ${maximum === Infinity ? `at least ${required}` : required === maximum ? String(required) : `${required} to ${maximum}`} argument(s), got ${node.args.length}`)
	}
	const explicitlyOverridden = Boolean(ctx.registry && sig !== DEFAULT_REGISTRY.get(node.callee))
	if (node.callee === 'coalesce' && !explicitlyOverridden) {
		for (const arg of node.args) {
			const value = evaluate(arg, ctx)
			if (value.kind !== 'null') return value
		}
		return NULL
	}
	const args = node.args.map((a) => evaluate(a, ctx))
	args.forEach((value, index) => {
		const param = sig.params[Math.min(index, sig.params.length - 1)]
		if (param && !valueMatchesType(value, param.type)) {
			throw new EvaluationError('type-error', `${node.callee}: argument ${index + 1} expects ${param.type.kind}, got ${value.kind}`, node.args[index]!.span)
		}
	})
	const host = ctx.hostFunctions && Object.prototype.hasOwnProperty.call(ctx.hostFunctions, node.callee)
		? ctx.hostFunctions[node.callee]
		: undefined
	const impl = Object.prototype.hasOwnProperty.call(BUILTIN_IMPLS, node.callee) ? BUILTIN_IMPLS[node.callee] : undefined
	if (host && impl && !explicitlyOverridden) {
		throw new EvaluationError('type-error', `Host function ${node.callee} collides with a builtin without an explicit override`, node.span)
	}
	if (host) {
		try {
			const result: unknown = host(args)
			if (!isValue(result)) throw new EvaluationError('host-error', `Host function ${node.callee} returned an invalid value`, node.span)
			const returnType = resolvedReturnType(sig, args)
			if (!returnType && sig.returns.kind !== 'fixed') {
				throw new EvaluationError('host-error', `Host function ${node.callee} return type cannot be verified from its arguments`, node.span)
			}
			if (returnType && !valueMatchesType(result, returnType)) {
				throw new EvaluationError('host-error', `Host function ${node.callee} returned ${result.kind}, expected ${returnType.kind}`, node.span)
			}
			return result
		}
		catch (error) { throw new EvaluationError('host-error', error instanceof Error ? error.message : 'Host function failed', node.span) }
	}
	if (explicitlyOverridden) throw new EvaluationError('missing-capability', `Override ${node.callee} requires a host implementation`, node.span)
	if (impl) return impl(args, ctx)
	if (sig.hostInjected) throw new EvaluationError('missing-capability', `Function ${node.callee} requires a host capability`)
	throw new EvaluationError('unknown-function', `Unknown function: ${node.callee}`)
}

// --- public surface ---

export type EvalResult =
	| { readonly success: true; readonly value: Value }
	| { readonly success: false; readonly error: string; readonly code?: EvalErrorCode; readonly span?: Expr['span']; readonly diagnostics?: readonly Diagnostic[] }

/** Parse and evaluate a source expression, capturing errors as a result. */
export function evaluateExpression(source: string, ctx: EvaluationContext): EvalResult {
	const { ast, errors } = parse(source)
	if (!ast) {
		return { success: false, error: errors[0]?.message ?? 'Parse error', diagnostics: errors }
	}
	try {
		return { success: true, value: evaluate(ast, ctx) }
	} catch (e) {
		if (e instanceof EvaluationError) return { success: false, error: e.message, code: e.code, span: e.span }
		if (e instanceof RangeError) return { success: false, error: e.message, code: 'limit-exceeded' }
		if (e instanceof SyntaxError || e instanceof TypeError) {
			return { success: false, error: e.message, code: 'type-error' }
		}
		return { success: false, error: e instanceof Error ? e.message : 'Host function failed', code: 'host-error' }
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
