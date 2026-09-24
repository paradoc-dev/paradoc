/**
 * Fill-state types for progressive form filling.
 *
 * These types support incremental/draft form filling where
 * AI agents and step-by-step UIs build forms turn-by-turn.
 */

import type { EvaluationIssue } from '@/logic/runtime/evaluation/types'
import type { RuleValidationResult } from '@/logic/runtime/evaluation/rule-evaluator'
import type { FormPhase } from '@paradoc/types'

/** Options for form fill operations. */
export interface FillOptions {
	/** Fixed context captured by the new runtime instance. */
	context?: import('@/artifacts/shared/runtime-context').RuntimeContextOptions
}

/**
 * Options for getFillState / getAvailableFillTargets.
 */
export interface FillTargetOptions {
	/** Sort required targets before optional. Default: true */
	requiredFirst?: boolean
	/** Include optional (non-required) targets in candidates. Default: false */
	includeOptional?: boolean
}

/**
 * Kind of fill target.
 */
export type FillTargetKind = 'field' | 'party' | 'annex'

/**
 * A candidate target that can be filled next.
 */
export interface FillTarget {
	/** Whether this is a field, party role, or annex */
	kind: FillTargetKind
	/** Field id, role id, or annex id */
	key: string
	/** Whether this target is required */
	required: boolean
	/** Declaration order in schema (parties first, then fields, then annexes) */
	order: number
}

/**
 * A field's effective status: the single ordinal that composes `visible` and
 * `required`. `hidden` < `optional` < `required`; `required` implies `visible`,
 * so the impossible "hidden but required" combination cannot be represented.
 */
export type FillItemStatus = 'hidden' | 'optional' | 'required'

/**
 * Extended fill target with runtime state information.
 */
export interface FillItemState extends FillTarget {
	/** Whether this item is currently visible */
	visible: boolean
	/** Effective status: hidden | optional | required (required implies visible) */
	status: FillItemStatus
	/** Whether this item has been filled (has a non-null value) */
	filled: boolean
	/** Transitive unfilled fillable prerequisites gating this item's visibility */
	blockedBy: string[]
}

/**
 * Complete fill state for a draft form.
 */
export interface FillState {
	/** Current form phase */
	phase: FormPhase
	/** Progress summary */
	summary: {
		requiredTotal: number
		requiredDone: number
		requiredRemaining: number
		completionPercent: number
	}
	/** Evaluated defs values */
	defsValues: Record<string, unknown>
	/**
	 * Rule results, the same objects `validateRules()` returns. `valid` is true when
	 * every error-severity rule passed. It is false when the form's logic could not
	 * be resolved, because the rules were not run; `issues` then says why.
	 */
	rules: {
		valid: boolean
		/** Failed rules with severity `error` */
		errors: RuleValidationResult[]
		/** Failed rules with severity `warning` */
		warnings: RuleValidationResult[]
	}
	/** Logic evaluation failures: failed conditions and failed computed values. */
	issues: EvaluationIssue[]
	/** Visible, unfilled, required items */
	openRequired: FillItemState[]
	/** Visible, unfilled, optional items */
	openOptional: FillItemState[]
	/** Not visible but could become visible if dependencies are filled */
	blocked: FillItemState[]
	/** Already filled items */
	done: FillItemState[]
	/** Available fill targets in declaration order */
	candidates: FillTarget[]
	/** First candidate (convenience) */
	next: FillTarget | null
}
