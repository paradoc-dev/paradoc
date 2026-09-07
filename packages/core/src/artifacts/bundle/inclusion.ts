import type {
	Bundle,
	BundleContentItem,
	Checklist,
	CondExpr,
	Expression,
	Form,
	Party,
} from '@paradoc/types'
import { buildFormContext, evaluateExpression, type EvaluationContext } from '@/logic/runtime/evaluation'
import { parseExpression } from '@/logic/design-time/validation/expression-parser'
import { topologicalSortDefsKeys } from '@/logic/design-time/type-checking/build-type-environment'
import type { RuntimeContext } from '../shared/runtime-context'

/** A member's resolved membership in a bundle. */
export type BundleInclusionStatus = 'included' | 'excluded' | 'unresolved'

/** The result of evaluating one bundle member's optional include condition. */
export interface BundleInclusionDecision {
	/** The bundle member key. */
	readonly key: string
	/** The condition as authored, when one was supplied. */
	readonly include?: CondExpr
	/** The resolved membership status. */
	readonly status: BundleInclusionStatus
	/** The evaluated boolean, when the condition resolved. */
	readonly value?: boolean
	/** Why an unresolved or invalid condition could not be used. */
	readonly reason?: string
	/** Nested membership state for an included nested bundle. */
	readonly nested?: BundleInclusionState
}

/** The complete membership state for one bundle instance. */
export interface BundleInclusionState {
	/** One decision for every declared bundle member, in declaration order. */
	readonly decisions: readonly BundleInclusionDecision[]
	/** Keys that are present in the resulting packet. */
	readonly includedKeys: readonly string[]
	/** Keys retained in the definition and draft but omitted from output. */
	readonly excludedKeys: readonly string[]
	/** Keys whose conditions still need data before completion. */
	readonly unresolvedKeys: readonly string[]
	/** Invalid expression or nested-evaluation errors. */
	readonly errors: readonly string[]
	/** Whether every condition needed by packet production has resolved. */
	readonly resolved: boolean
}

/** A runtime member shape consumed by the evaluator without importing bundle implementations. */
export interface BundleRuntimeMember {
	readonly form?: Form
	readonly fields?: Record<string, unknown>
	readonly parties?: Record<string, unknown>
	readonly annexes?: Record<string, unknown>
	readonly witnesses?: readonly { party: unknown }[]
	readonly context?: RuntimeContext
	readonly checklist?: Checklist
	readonly items?: unknown
	readonly bundle?: Bundle
	readonly phase?: string
	getAllContents?: () => Record<string, BundleEvaluationMember>
}

/** A bytes entry carries no declared instance data. */
export interface BundleBytesMember {
	readonly kind: 'bytes'
}

export type BundleEvaluationMember = BundleRuntimeMember | BundleBytesMember | undefined

interface BundleContextBuild {
	readonly context: EvaluationContext
	readonly errors: string[]
}

const SCALAR_EXPRESSION_TYPES = new Set([
	'boolean',
	'string',
	'number',
	'integer',
	'percentage',
	'rating',
	'date',
	'time',
	'datetime',
	'duration',
])

function isScalarExpression(expr: Expression): boolean {
	return SCALAR_EXPRESSION_TYPES.has(expr.type)
}

function valueAtPath(root: unknown, path: string): { present: boolean; value: unknown } {
	let value: unknown = root
	for (const segment of path.split('.')) {
		if (value === null || value === undefined || (typeof value !== 'object' && typeof value !== 'function')) {
			return { present: false, value: undefined }
		}
		if (!Object.prototype.hasOwnProperty.call(value, segment)) {
			return { present: false, value: undefined }
		}
		value = (value as Record<string, unknown>)[segment]
	}
	return { present: value !== undefined, value }
}

function expressionValue(expression: string, context: EvaluationContext):
	| { status: 'value'; value: unknown }
	| { status: 'unresolved'; reason: string }
	| { status: 'error'; reason: string } {
	const parsed = parseExpression(expression)
	if (!parsed.success) {
		return { status: 'error', reason: `Invalid include expression "${expression}": ${parsed.error ?? 'syntax error'}` }
	}
	const knownRoots = new Set([
		'fields',
		'parties',
		'witnesses',
		'asOf',
		'forms',
		'bundles',
		'checklists',
		'documents',
		...Object.keys(context),
	])
	const unknownRoots = parsed.variables
		.map((variable) => variable.split('.')[0]!)
		.filter((root, index, roots) => !knownRoots.has(root) && roots.indexOf(root) === index)
	if (unknownRoots.length > 0) {
		return {
			status: 'error',
			reason: `Unknown variable(s) in include expression "${expression}": ${unknownRoots.join(', ')}`,
		}
	}
	if (/(?:^|[^\w])(today|now)\s*\(/.test(expression) && context.asOf === undefined) {
		return {
			status: 'unresolved',
			reason: `Include expression "${expression}" needs a fixed evaluation clock.`,
		}
	}

	const missing = parsed.variables.filter((variable) => !valueAtPath(context, variable).present)
	if (missing.length > 0) {
		return {
			status: 'unresolved',
			reason: `Include expression "${expression}" needs unresolved data: ${missing.join(', ')}`,
		}
	}

	const result = evaluateExpression(expression, context, { throwOnError: false })
	if (!result.success) {
		return { status: 'error', reason: `Invalid include expression "${expression}": ${result.error ?? 'evaluation failed'}` }
	}
	return { status: 'value', value: result.value }
}

function buildRuntimeContext(member: BundleRuntimeMember): EvaluationContext | undefined {
	if (member.form) {
		return buildFormContext(member.form, {
			fields: member.fields,
			parties: member.parties as Record<string, Party | Party[]> | undefined,
			witnesses: member.witnesses?.map((witness) => witness.party as Party),
			context: member.context,
		})
	}

	if (member.bundle && member.getAllContents) {
		return buildBundleContext(member.bundle, member.getAllContents()).context
	}

	if (member.checklist) {
		return {
			fields: {},
			checklists: { items: member.items ?? {} },
			...(member.context?.asOf && { asOf: member.context.asOf }),
		}
	}

	return undefined
}

function buildBundleContext(
	bundle: Bundle,
	contents: Record<string, BundleEvaluationMember>,
	): BundleContextBuild {
	const forms: Record<string, unknown> = {}
	const bundles: Record<string, unknown> = {}
	const checklists: Record<string, unknown> = {}
	const documents: Record<string, unknown> = {}
	const errors: string[] = []
	let asOf: RuntimeContext['asOf'] | undefined
	let clockConflict = false

	for (const item of bundle.contents) {
		const member = contents[item.key]
		if (!member || 'kind' in member) continue
		const childContext = buildRuntimeContext(member)
		if (!childContext) continue
		if (childContext.asOf) {
			if (asOf === undefined) asOf = childContext.asOf
			else if (asOf.datetime !== childContext.asOf.datetime) clockConflict = true
		}

		if (member.form) forms[item.key] = childContext
		else if (member.bundle) bundles[item.key] = childContext
		else if (member.checklist) checklists[item.key] = childContext
		else documents[item.key] = childContext
	}

	const context: EvaluationContext = {
		fields: {},
		forms,
		bundles,
		checklists,
		documents,
		...(asOf && !clockConflict && { asOf }),
	}

	if (!bundle.defs || Object.keys(bundle.defs).length === 0) return { context, errors }

	const expressions = Object.fromEntries(
		Object.entries(bundle.defs).map(([key, expression]) => [
			key,
			isScalarExpression(expression)
				? String(expression.value)
			: Object.values(expression.value as unknown as Record<string, string | undefined>)
						.filter((value): value is string => value !== undefined)
						.join(' and '),
		]),
	)
	const { sorted } = topologicalSortDefsKeys(expressions)

	for (const key of sorted) {
		const expression = bundle.defs[key]
		if (!expression) continue
		if (isScalarExpression(expression)) {
			const result = expressionValue(String(expression.value), context)
			if (result.status === 'value') {
				;(context as Record<string, unknown>)[key] = result.value
			} else {
				;(context as Record<string, unknown>)[key] = undefined
				if (result.status === 'error') errors.push(`Bundle definition "${key}": ${result.reason}`)
			}
			continue
		}

		const values: Record<string, unknown> = {}
		let unresolved = false
		for (const [property, propertyExpression] of Object.entries(
			expression.value as unknown as Record<string, string | undefined>,
		)) {
			if (propertyExpression === undefined) continue
			const result = expressionValue(propertyExpression, context)
			if (result.status === 'value') values[property] = result.value
			else {
				unresolved = true
				if (result.status === 'error') errors.push(`Bundle definition "${key}.${property}": ${result.reason}`)
			}
		}
		;(context as Record<string, unknown>)[key] = unresolved ? undefined : values
	}

	return { context, errors }
}

function nestedState(
	item: BundleContentItem,
	member: BundleEvaluationMember,
	): BundleInclusionState | undefined {
	if (item.type !== 'inline' || item.artifact.kind !== 'bundle') return undefined
	if (!member || 'kind' in member || !member.bundle || !member.getAllContents) return undefined
	return evaluateBundleInclusion(member.bundle, member.getAllContents())
}

/** Evaluate all bundle member conditions against the supplied runtime data. */
export function evaluateBundleInclusion(
	bundle: Bundle,
	contents: Record<string, BundleEvaluationMember> = {},
): BundleInclusionState {
	const { context, errors } = buildBundleContext(bundle, contents)
	const decisions: BundleInclusionDecision[] = []

	for (const item of bundle.contents) {
		const include = item.include
		let decision: BundleInclusionDecision
		if (include === undefined || include === true) {
			decision = { key: item.key, ...(include !== undefined && { include }), status: 'included', value: true }
		} else if (include === false) {
			decision = { key: item.key, include, status: 'excluded', value: false }
		} else {
			const result = expressionValue(include, context)
			if (result.status === 'value') {
				if (typeof result.value !== 'boolean') {
					decision = {
						key: item.key,
						include,
						status: 'unresolved',
						reason: `Include expression "${include}" must evaluate to a boolean.`,
					}
					errors.push(`Content "${item.key}": ${decision.reason}`)
				} else {
					decision = {
						key: item.key,
						include,
						status: result.value ? 'included' : 'excluded',
						value: result.value,
					}
				}
			} else {
				decision = { key: item.key, include, status: 'unresolved', reason: result.reason }
				if (result.status === 'error') errors.push(`Content "${item.key}": ${result.reason}`)
			}
		}

		const member = contents[item.key]
		const child = decision.status === 'included' ? nestedState(item, member) : undefined
		if (child) decision = { ...decision, nested: child }
		decisions.push(decision)
	}

	const includedKeys = decisions.filter((decision) => decision.status === 'included').map((decision) => decision.key)
	const excludedKeys = decisions.filter((decision) => decision.status === 'excluded').map((decision) => decision.key)
	const unresolvedKeys = decisions
		.filter((decision) => decision.status === 'unresolved')
		.map((decision) => decision.key)

	for (const decision of decisions) {
		if (decision.status === 'included' && decision.nested && !decision.nested.resolved) {
			unresolvedKeys.push(decision.key)
		}
		errors.push(...(decision.nested?.errors ?? []).map((error) => `Content "${decision.key}": ${error}`))
	}

	return {
		decisions,
		includedKeys,
		excludedKeys,
		unresolvedKeys: [...new Set(unresolvedKeys)],
		errors: [...new Set(errors)],
		resolved: unresolvedKeys.length === 0 && errors.length === 0,
	}
}

/** Return the decision for one member, or an unresolved decision for an unknown key. */
export function decisionForKey(state: BundleInclusionState, key: string): BundleInclusionDecision {
	return state.decisions.find((decision) => decision.key === key) ?? {
		key,
		status: 'unresolved',
		reason: `Content key "${key}" is not declared in the bundle.`,
	}
}

/** Throw a packet-boundary error when inclusion has not fully resolved. */
export function assertBundleInclusionResolved(state: BundleInclusionState): void {
	if (state.resolved) return
	const details = [...state.errors, ...state.unresolvedKeys.map((key) => `Content "${key}" has unresolved inclusion.`)]
	throw new Error(`Cannot produce a completed bundle packet: ${details.join('; ')}`)
}

/** Return a runtime-content map containing only members included by the state. */
export function includedRuntimeContents<T>(
	state: BundleInclusionState,
	contents: Record<string, T>,
): Record<string, T> {
	const included: Record<string, T> = {}
	for (const key of state.includedKeys) {
		if (key in contents) included[key] = contents[key]!
	}
	return included
}
