import type {
	Bundle,
	BundleContentItem,
	CondExpr,
	Expression,
	Form,
	Party,
	Attestation,
	SignatureCapture,
	WitnessParty,
} from '@paradoc/types'
import { buildFormContext, evaluateExpression, type EvaluationContext } from '@/logic/runtime/evaluation'
import { EVALUATION_CLOCK } from '@/logic/runtime/evaluation/types'
import { signingStateOf } from '@/logic/runtime/evaluation/signing-state'
import { parseExpression } from '@/logic/design-time/validation/expression-parser'
import { topologicalSortDefsKeys } from '@/logic/design-time/type-checking/build-type-environment'
import { isScalarExpressionType } from '@/logic/shared/expression-types'
import { defsDependencyExpressions, definitionExpressionLeaves } from '@/logic/shared/defs-dependencies'
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
	/**
	 * Keys whose members belong in the resulting packet, whether or not their
	 * content has been supplied yet.
	 */
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

/**
 * A runtime member shape consumed by the evaluator without importing bundle
 * implementations. Only form and bundle members reach include conditions;
 * checklist and document members carry no values an include can read.
 */
export interface BundleRuntimeMember {
	readonly form?: Form
	readonly fields?: Record<string, unknown>
	readonly parties?: Record<string, unknown>
	readonly annexes?: Record<string, unknown>
	readonly witnesses?: readonly WitnessParty[]
	readonly captures?: readonly SignatureCapture[]
	readonly attestations?: readonly Attestation[]
	readonly context?: RuntimeContext
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

function isScalarExpression(expr: Expression): boolean {
	return isScalarExpressionType(expr.type)
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
		'forms',
		'bundles',
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
	if (/(?:^|[^\w])(today|now)\s*\(/.test(expression) && context[EVALUATION_CLOCK] === undefined) {
		return {
			status: 'unresolved',
			reason: `Include expression "${expression}" reads today() or now(), and the bundle has no clock.`,
		}
	}

	const missing = parsed.variables.filter((variable) => !valueAtPath(context, variable).present)
	if (missing.length > 0) {
		return {
			status: 'unresolved',
			reason: `Include expression "${expression}" needs unresolved data: ${missing.join(', ')}`,
		}
	}

	const result = evaluateExpression(expression, context)
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
			witnesses: member.witnesses,
			signing: signingStateOf(member.captures ?? [], member.attestations ?? []),
			context: member.context,
		})
	}

	if (member.bundle && member.getAllContents) {
		return buildBundleContext(member.bundle, member.getAllContents(), member.context).context
	}

	return undefined
}

/**
 * The context include conditions read. `today()` and `now()` read the bundle's
 * own clock, captured when the bundle was prepared; a member's clock never
 * decides inclusion, so members filled at different instants agree.
 */
function buildBundleContext(
	bundle: Bundle,
	contents: Record<string, BundleEvaluationMember>,
	bundleContext: RuntimeContext | undefined,
): BundleContextBuild {
	const forms: Record<string, unknown> = {}
	const bundles: Record<string, unknown> = {}
	const errors: string[] = []

	for (const item of bundle.contents) {
		const member = contents[item.key]
		if (!member || 'kind' in member) continue
		const childContext = buildRuntimeContext(member)
		if (!childContext) continue
		if (member.form) forms[item.key] = childContext
		else if (member.bundle) bundles[item.key] = childContext
	}

	const context: EvaluationContext = {
		fields: {},
		forms,
		bundles,
		...(bundleContext && { [EVALUATION_CLOCK]: bundleContext.asOf }),
	}

	if (!bundle.defs || Object.keys(bundle.defs).length === 0) return { context, errors }

	const { sorted } = topologicalSortDefsKeys(defsDependencyExpressions(bundle.defs))

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

		// An object definition resolves member by member, nested members too
		// (a bbox's `southWest.lat`), and reads as missing until all resolve.
		const values: Record<string, unknown> = {}
		let unresolved = false
		for (const leaf of definitionExpressionLeaves(expression.value)) {
			const result = expressionValue(leaf.expression, context)
			if (result.status === 'value') setAtPath(values, leaf.path, result.value)
			else {
				unresolved = true
				if (result.status === 'error') errors.push(`Bundle definition "${[key, ...leaf.path].join('.')}": ${result.reason}`)
			}
		}
		;(context as Record<string, unknown>)[key] = unresolved ? undefined : values
	}

	return { context, errors }
}

function setAtPath(target: Record<string, unknown>, path: readonly string[], value: unknown): void {
	let node = target
	for (const segment of path.slice(0, -1)) {
		const next = node[segment]
		node = (next && typeof next === 'object' ? next : (node[segment] = {})) as Record<string, unknown>
	}
	node[path[path.length - 1]!] = value
}

function nestedState(
	item: BundleContentItem,
	member: BundleEvaluationMember,
	): BundleInclusionState | undefined {
	if (item.type !== 'inline' || item.artifact.kind !== 'bundle') return undefined
	if (!member || 'kind' in member || !member.bundle || !member.getAllContents) return undefined
	return evaluateBundleInclusion(member.bundle, member.getAllContents(), member.context)
}

/**
 * Evaluate all bundle member conditions against the supplied runtime data.
 *
 * `context` is the bundle's clock. Without one, a condition that reads
 * `today()` or `now()` stays unresolved.
 */
export function evaluateBundleInclusion(
	bundle: Bundle,
	contents: Record<string, BundleEvaluationMember> = {},
	context?: RuntimeContext,
): BundleInclusionState {
	const { context: evaluationContext, errors } = buildBundleContext(bundle, contents, context)
	const decisions: BundleInclusionDecision[] = []

	for (const item of bundle.contents) {
		const include = item.include
		let decision: BundleInclusionDecision
		if (include === undefined || include === true) {
			decision = { key: item.key, ...(include !== undefined && { include }), status: 'included', value: true }
		} else if (include === false) {
			decision = { key: item.key, include, status: 'excluded', value: false }
		} else {
			const result = expressionValue(include, evaluationContext)
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
