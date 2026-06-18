/**
 * The artifact-aware checker. Infers the type of an expression against a
 * host-supplied type environment (which maps reference paths and defs keys to
 * types) and the function registry, emitting positioned diagnostics. This is
 * what an authoring editor lints with.
 *
 * @paradoc/expr stays decoupled from the artifact schema: the host (e.g.
 * @paradoc/core) builds the TypeEnv from real field definitions.
 */

import type { Expr } from '../ast/nodes'
import { parse } from '../parser/parser'
import { buildRegistry, type Registry, type ReturnSpec } from '../registry/registry'
import { formatType, typesEqual, T, type Diagnostic, type ExprType, type Span } from '../types'

export interface TypeEnv {
	/** Type of a reference path (`fields.age`, `isAdult`), or undefined if unknown. */
	resolve(path: string): ExprType | undefined
	readonly registry: Registry
}

export interface CheckResult {
	readonly type: ExprType
	readonly diagnostics: readonly Diagnostic[]
}

/** A reference path for an identifier-rooted member chain, else null. */
function staticPath(node: Expr): string | null {
	if (node.kind === 'Identifier') return node.name
	if (node.kind === 'Member') {
		const base = staticPath(node.object)
		return base === null ? null : `${base}.${node.property}`
	}
	return null
}

/** Is `actual` acceptable where `expected` is wanted? `unknown` matches anything. */
function assignable(expected: ExprType, actual: ExprType): boolean {
	return expected.kind === 'unknown' || actual.kind === 'unknown' || typesEqual(expected, actual)
}

const NUMERIC = (t: ExprType) => t.kind === 'number' || t.kind === 'unknown'
const STRINGY = (t: ExprType) => t.kind === 'string' || t.kind === 'unknown'

class Checker {
	readonly diagnostics: Diagnostic[] = []

	constructor(private readonly env: TypeEnv) {}

	private error(code: Diagnostic['code'], message: string, span: Span): void {
		this.diagnostics.push({ severity: 'error', code, message, span })
	}

	infer(node: Expr): ExprType {
		switch (node.kind) {
			case 'NumberLiteral':
				return T.number
			case 'StringLiteral':
				return T.string
			case 'BooleanLiteral':
				return T.boolean
			case 'NullLiteral':
				return T.null
			case 'ArrayLiteral':
				return this.inferArray(node)
			case 'Identifier':
				return this.inferRef(node.name, node.span)
			case 'Member':
				return this.inferMember(node)
			case 'Index': {
				const obj = this.infer(node.object)
				const idx = this.infer(node.index)
				if (!NUMERIC(idx)) this.error('type-mismatch', 'Array index must be a number', node.index.span)
				return obj.kind === 'array' ? obj.element : T.unknown
			}
			case 'Unary':
				return this.inferUnary(node)
			case 'Binary':
				return this.inferBinary(node)
			case 'Logical':
				this.infer(node.left)
				this.infer(node.right)
				return T.boolean
			case 'Membership':
				return this.inferMembership(node)
			case 'Conditional':
				return this.inferConditional(node)
			case 'Call':
				return this.inferCall(node)
		}
	}

	private inferArray(node: Extract<Expr, { kind: 'ArrayLiteral' }>): ExprType {
		if (node.elements.length === 0) return T.array(T.unknown)
		const types = node.elements.map((el) => this.infer(el))
		const first = types[0]!
		const uniform = types.every((t) => typesEqual(t, first))
		return T.array(uniform ? first : T.unknown)
	}

	private inferRef(path: string, span: Span): ExprType {
		const t = this.env.resolve(path)
		if (t === undefined) {
			this.error('unknown-identifier', `Unknown reference: ${path}`, span)
			return T.unknown
		}
		return t
	}

	private inferMember(node: Extract<Expr, { kind: 'Member' }>): ExprType {
		const path = staticPath(node)
		if (path !== null) return this.inferRef(path, node.span)
		this.infer(node.object)
		return T.unknown
	}

	private inferUnary(node: Extract<Expr, { kind: 'Unary' }>): ExprType {
		const t = this.infer(node.operand)
		if (node.op === 'not') return T.boolean
		if (!NUMERIC(t)) this.error('type-mismatch', `Cannot negate ${formatType(t)}`, node.span)
		return T.number
	}

	private inferBinary(node: Extract<Expr, { kind: 'Binary' }>): ExprType {
		const l = this.infer(node.left)
		const r = this.infer(node.right)
		const op = node.op
		if (op === '==' || op === '!=') return T.boolean
		if (op === '<' || op === '<=' || op === '>' || op === '>=') {
			const ok = (NUMERIC(l) && NUMERIC(r)) || (STRINGY(l) && STRINGY(r))
			if (!ok) this.error('type-mismatch', `Cannot compare ${formatType(l)} and ${formatType(r)}`, node.span)
			return T.boolean
		}
		if (op === '+') {
			if (NUMERIC(l) && NUMERIC(r)) return T.number
			if (l.kind === 'string' || r.kind === 'string') return T.string
			if (l.kind === 'unknown' || r.kind === 'unknown') return T.unknown
			this.error('type-mismatch', `Cannot add ${formatType(l)} and ${formatType(r)}`, node.span)
			return T.unknown
		}
		// - * / %
		if (!NUMERIC(l) || !NUMERIC(r)) {
			this.error('type-mismatch', `Operator '${op}' requires numbers, got ${formatType(l)} and ${formatType(r)}`, node.span)
		}
		return T.number
	}

	private inferMembership(node: Extract<Expr, { kind: 'Membership' }>): ExprType {
		this.infer(node.element)
		const coll = this.infer(node.collection)
		if (coll.kind !== 'array' && coll.kind !== 'string' && coll.kind !== 'unknown') {
			this.error('type-mismatch', `'in' requires an array or string, got ${formatType(coll)}`, node.collection.span)
		}
		return T.boolean
	}

	private inferConditional(node: Extract<Expr, { kind: 'Conditional' }>): ExprType {
		this.infer(node.test)
		const a = this.infer(node.consequent)
		const b = this.infer(node.alternate)
		return typesEqual(a, b) ? a : T.unknown
	}

	private inferCall(node: Extract<Expr, { kind: 'Call' }>): ExprType {
		const sig = this.env.registry.get(node.callee)
		if (!sig) {
			this.error('unknown-function', `Unknown function: ${node.callee}`, node.span)
			node.args.forEach((a) => this.infer(a))
			return T.unknown
		}
		const argTypes = node.args.map((a) => this.infer(a))
		const required = sig.params.filter((p) => !p.optional).length
		const max = sig.variadic ? Infinity : sig.params.length
		if (argTypes.length < required || argTypes.length > max) {
			this.error('arity', `${node.callee} expects ${arityText(required, max)}, got ${argTypes.length}`, node.span)
		}
		argTypes.forEach((at, i) => {
			const param = sig.params[Math.min(i, sig.params.length - 1)]
			if (param && !assignable(param.type, at)) {
				this.error('type-mismatch', `${node.callee}: argument ${i + 1} expects ${formatType(param.type)}, got ${formatType(at)}`, node.args[i]!.span)
			}
		})
		return resolveReturn(sig.returns, argTypes)
	}
}

function arityText(required: number, max: number): string {
	if (max === Infinity) return `at least ${required} argument(s)`
	if (required === max) return `${required} argument(s)`
	return `${required} to ${max} argument(s)`
}

function resolveReturn(spec: ReturnSpec, argTypes: readonly ExprType[]): ExprType {
	if (spec.kind === 'fixed') return spec.type
	if (spec.kind === 'elementOf') {
		const t = argTypes[spec.arg]
		return t && t.kind === 'array' ? t.element : T.unknown
	}
	// commonOfArgs
	const known = argTypes.filter((t) => t.kind !== 'null' && t.kind !== 'unknown')
	const first = known[0]
	if (first && known.every((t) => typesEqual(t, first))) return first
	return T.unknown
}

/** Build a simple TypeEnv from a path->type map (host adapters build richer ones). */
export function createTypeEnv(paths: Record<string, ExprType>, registry: Registry = buildRegistry()): TypeEnv {
	const map = new Map(Object.entries(paths))
	return { resolve: (p) => map.get(p), registry }
}

/** Infer the type of a parsed expression, collecting diagnostics. */
export function checkAst(ast: Expr, env: TypeEnv): CheckResult {
	const checker = new Checker(env)
	const type = checker.infer(ast)
	return { type, diagnostics: checker.diagnostics }
}

/** Parse and check a source expression. Syntax errors short-circuit type checks. */
export function check(source: string, env: TypeEnv): CheckResult {
	const { ast, errors } = parse(source)
	if (!ast) return { type: T.unknown, diagnostics: errors }
	return checkAst(ast, env)
}

/**
 * Check an expression used in a boolean gate (visible/required/include/rule):
 * everything `check` does, plus a non-boolean-gate error when the result is not
 * boolean (boolean literals are allowed as a degenerate gate).
 */
export function checkBooleanGate(source: string, env: TypeEnv): CheckResult {
	const result = check(source, env)
	if (result.diagnostics.length === 0 && result.type.kind !== 'boolean' && result.type.kind !== 'unknown') {
		const { ast } = parse(source)
		const span = ast ? ast.span : { start: { offset: 0, line: 1, column: 1 }, end: { offset: 0, line: 1, column: 1 } }
		return {
			type: result.type,
			diagnostics: [{ severity: 'error', code: 'non-boolean-gate', message: `A gate must be boolean, got ${formatType(result.type)}`, span }],
		}
	}
	return result
}
