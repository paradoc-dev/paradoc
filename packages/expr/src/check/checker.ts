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
import { staticPath } from '../ast/paths'
import { extractReferences } from '../analyze/references'
import { isAggregateName, type AggregateName } from '../eval/aggregate'
import { parse } from '../parser/parser'
import { buildRegistry, type Registry, type ReturnSpec } from '../registry/registry'
import { formatType, typesEqual, T, type Diagnostic, type ExprType, type Span } from '../types'
import { validateDate, validateDateDuration, validateDatetime } from '../eval/temporal'

export interface TypeEnv {
	/** Type of a reference path (`fields.age`, `isAdult`), or undefined if unknown. */
	resolve(path: string): ExprType | undefined
	readonly registry: Registry
}

export interface CheckResult {
	readonly type: ExprType
	readonly diagnostics: readonly Diagnostic[]
}


/** Is `actual` acceptable where `expected` is wanted? `unknown` matches anything. */
function assignable(expected: ExprType, actual: ExprType): boolean {
	return expected.kind === 'unknown' || actual.kind === 'unknown' || typesEqual(expected, actual)
}

const NUMERIC = (t: ExprType) => t.kind === 'number' || t.kind === 'unknown'
const STRINGY = (t: ExprType) => t.kind === 'string' || t.kind === 'unknown'

const DEFAULT_REGISTRY = buildRegistry()

/** The element kinds each aggregate accepts; `count` accepts any row. */
const AGGREGATE_ELEMENT_KINDS: Readonly<Record<Exclude<AggregateName, 'count'>, readonly string[]>> = {
	sum: ['number', 'money'],
	avg: ['number', 'money'],
	min: ['number', 'money', 'date', 'datetime', 'time'],
	max: ['number', 'money', 'date', 'datetime', 'time'],
	any: ['boolean'],
	all: ['boolean'],
}

/** Statically known members of a money value that is not itself a reference path. */
const MONEY_MEMBERS: Readonly<Record<string, ExprType>> = { amount: T.number, currency: T.string }

class Checker {
	readonly diagnostics: Diagnostic[] = []
	/** Lists whose rows are bound while an aggregate's filter is checked. */
	private rowScope: ReadonlySet<string> = new Set()
	/** The list an aggregate filter is checked against, for its diagnostics. */
	private filteredList: string | undefined

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
				const base = staticPath(node.object)
				if (base !== null && node.index.kind === 'StringLiteral') {
					// A key that is not an identifier reads a member: items["signed-contract"].
					return this.inferRef(`${base}.${node.index.value}`, node.span)
				}
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
		const open = this.openLists(path)
		if (open.length > 0) {
			const list = open[0]!
			this.error(
				'invalid-aggregate',
				this.filteredList
					? `The filter reads ${path} from ${list}, a different list than ${this.filteredList}`
					: `${path} reads a value from every row of ${list}; use it inside an aggregate such as sum(${path}) or count(${list})`,
				span,
			)
		}
		return t
	}

	/** The lists a path passes through (its proper prefixes typed as arrays). */
	private listsThrough(path: string): string[] {
		const segments = path.split('.')
		const lists: string[] = []
		for (let length = 1; length < segments.length; length++) {
			const prefix = segments.slice(0, length).join('.')
			if (this.env.resolve(prefix)?.kind === 'array') lists.push(prefix)
		}
		return lists
	}

	/** The lists a path passes through whose rows no enclosing aggregate has bound. */
	private openLists(path: string): string[] {
		return this.listsThrough(path).filter((list) => !this.rowScope.has(list))
	}

	private inferMember(node: Extract<Expr, { kind: 'Member' }>): ExprType {
		const path = staticPath(node)
		if (path !== null) return this.inferRef(path, node.span)
		const base = this.infer(node.object)
		if (base.kind === 'money') return MONEY_MEMBERS[node.property] ?? T.unknown
		return T.unknown
	}

	/**
	 * Check a list aggregate. Returns undefined when `min`/`max` is not given a
	 * path into a list, so the caller checks it as the variadic comparison.
	 */
	private inferAggregate(name: AggregateName, node: Extract<Expr, { kind: 'Call' }>): ExprType | undefined {
		const [valuesArg, filterArg] = node.args
		const path = valuesArg ? staticPath(valuesArg) : null
		const resolved = path === null ? undefined : this.env.resolve(path)
		const lists = path === null || resolved === undefined ? [] : this.aggregatedLists(path, resolved)
		if ((name === 'min' || name === 'max') && (lists.length === 0 || node.args.length > 2)) return undefined

		const fallback = name === 'count' ? T.number : name === 'any' || name === 'all' ? T.boolean : T.unknown
		if (node.args.length < 1 || node.args.length > 2) {
			this.error('arity', `${name} expects ${arityText(1, 2)}, got ${node.args.length}`, node.span)
			return fallback
		}
		if (path === null) {
			this.error('invalid-aggregate', `${name} expects a path into a list field, such as ${name}(fields.items.amount)`, valuesArg!.span)
			node.args.forEach((arg) => this.infer(arg))
			return fallback
		}
		if (resolved === undefined) {
			this.error('unknown-identifier', `Unknown reference: ${path}`, valuesArg!.span)
			return fallback
		}
		if (lists.length === 0) {
			this.error('invalid-aggregate', `${name} needs a path into a list field; ${path} is ${formatType(resolved)}`, valuesArg!.span)
			return fallback
		}

		const list = lists[lists.length - 1]!
		const element = list === path && resolved.kind === 'array' ? resolved.element : resolved
		if (filterArg) this.checkFilter(name, filterArg, lists, list)

		if (name === 'count') return T.number
		const accepted = AGGREGATE_ELEMENT_KINDS[name]
		if (element.kind !== 'unknown' && !accepted.includes(element.kind)) {
			this.error('type-mismatch', `${name} needs ${accepted.join(' or ')} values; ${path} is ${formatType(element)}`, valuesArg!.span)
			return fallback
		}
		if (name === 'any' || name === 'all') return T.boolean
		return element
	}

	/** The lists an aggregate over `path` fans out over: open lists it passes through, plus itself when it is one. */
	private aggregatedLists(path: string, type: ExprType): string[] {
		const lists = this.openLists(path)
		if (type.kind === 'array') lists.push(path)
		return lists
	}

	/** A filter is a boolean over the aggregated rows, with those rows bound. */
	private checkFilter(name: AggregateName, filter: Expr, lists: readonly string[], list: string): void {
		const savedScope = this.rowScope
		const savedList = this.filteredList
		this.rowScope = new Set([...savedScope, ...lists])
		this.filteredList = list
		const type = this.infer(filter)
		this.rowScope = savedScope
		this.filteredList = savedList

		if (type.kind !== 'boolean' && type.kind !== 'unknown') {
			this.error('type-mismatch', `The ${name} filter must be boolean, got ${formatType(type)}`, filter.span)
		}
		const readsRows = extractReferences(filter).paths.some((ref) => lists.some((bound) => ref.startsWith(`${bound}.`)))
		if (!readsRows) {
			this.error('invalid-aggregate', `The ${name} filter must test a value of each row of ${list}, such as ${list}.<field>`, filter.span)
		}
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
			const temporal = ['date', 'datetime', 'time'].includes(l.kind) && l.kind === r.kind
			const ok = (NUMERIC(l) && NUMERIC(r)) || (STRINGY(l) && STRINGY(r)) || temporal
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
		const element = this.infer(node.element)
		const coll = this.infer(node.collection)
		if (coll.kind !== 'array' && coll.kind !== 'string' && coll.kind !== 'unknown') {
			this.error('type-mismatch', `'in' requires an array or string, got ${formatType(coll)}`, node.collection.span)
		}
		if (coll.kind === 'string' && element.kind !== 'string' && element.kind !== 'unknown') {
			this.error('type-mismatch', `'in' against a string requires a string element, got ${formatType(element)}`, node.element.span)
		}
		if (coll.kind === 'array' && !assignable(coll.element, element)) {
			this.error('type-mismatch', `'in' element expects ${formatType(coll.element)}, got ${formatType(element)}`, node.element.span)
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
		if (sig.aggregate && isAggregateName(node.callee) && sig === DEFAULT_REGISTRY.get(node.callee)) {
			const aggregated = this.inferAggregate(node.callee, node)
			if (aggregated) return aggregated
		}
		const argTypes = node.args.map((a) => this.infer(a))
		if (node.callee === 'length') {
			const value = argTypes[0]
			if (value && !['string', 'array', 'null', 'unknown'].includes(value.kind)) {
				this.error('type-mismatch', `length expects a string or array, got ${formatType(value)}`, node.args[0]!.span)
			}
		}
		if (node.callee === 'contains') {
			const haystack = argTypes[0]
			const needle = argTypes[1]
			if (haystack && !['string', 'array', 'null', 'unknown'].includes(haystack.kind)) {
				this.error('type-mismatch', `contains expects a string or array, got ${formatType(haystack)}`, node.args[0]!.span)
			} else if (haystack?.kind === 'string' && needle && !assignable(T.string, needle)) {
				this.error('type-mismatch', `contains on a string expects a string needle, got ${formatType(needle)}`, node.args[1]!.span)
			} else if (haystack?.kind === 'array' && needle && !assignable(haystack.element, needle)) {
				this.error('type-mismatch', `contains expects ${formatType(haystack.element)}, got ${formatType(needle)}`, node.args[1]!.span)
			}
		}
		const required = sig.params.filter((p) => !p.optional).length
		const max = sig.variadic ? Infinity : sig.params.length
		if (argTypes.length < required || argTypes.length > max) {
			this.error('arity', `${node.callee} expects ${arityText(required, max)}, got ${argTypes.length}`, node.span)
		}
		argTypes.forEach((at, i) => {
			const param = sig.params[Math.min(i, sig.params.length - 1)]
			const temporalLiteral = param && ['date', 'datetime', 'time', 'duration'].includes(param.type.kind) && at.kind === 'string'
			if (param && !temporalLiteral && !assignable(param.type, at)) {
				this.error('type-mismatch', `${node.callee}: argument ${i + 1} expects ${formatType(param.type)}, got ${formatType(at)}`, node.args[i]!.span)
			}
			const argNode = node.args[i]
			if (param && argNode?.kind === 'StringLiteral') {
				try {
					if (param.type.kind === 'date') validateDate(argNode.value)
					else if (param.type.kind === 'datetime') validateDatetime(argNode.value)
					else if (param.type.kind === 'duration') validateDateDuration(argNode.value)
				} catch (error) {
					this.error('type-mismatch', error instanceof Error ? error.message : `Invalid ${param.type.kind}`, argNode.span)
				}
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
	if (spec.kind === 'aggregate') return T.unknown
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
	if (result.diagnostics.length === 0 && result.type.kind !== 'boolean') {
		const { ast } = parse(source)
		const span = ast ? ast.span : { start: { offset: 0, line: 1, column: 1 }, end: { offset: 0, line: 1, column: 1 } }
		return {
			type: result.type,
			diagnostics: [{ severity: 'error', code: 'non-boolean-gate', message: result.type.kind === 'unknown' ? 'A final gate must be verified as boolean; its type is unresolved' : `A gate must be boolean, got ${formatType(result.type)}`, span }],
		}
	}
	return result
}
