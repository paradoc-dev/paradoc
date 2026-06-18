/**
 * Fill-state types for progressive form filling.
 *
 * These types support incremental/draft form filling where
 * AI agents and step-by-step UIs build forms turn-by-turn.
 */

/**
 * Validation mode for partial fill and update operations.
 * - "patch": validate only provided fields (progressive validation)
 * - "full": validate entire payload (same as fill())
 * - "none": skip validation entirely
 */
export type FillValidationMode = 'patch' | 'full' | 'none'

/**
 * Options for partialFill / safePartialFill.
 */
export interface PartialFillOptions {
	/** Validation mode. Default: "patch" */
	validate?: FillValidationMode
	/** Whether to evaluate and report rules. Default: false */
	rules?: boolean
}

/**
 * Options for update / safeUpdate on DraftForm.
 */
export interface UpdateOptions {
	/** Validation mode. Default: "patch" */
	validate?: FillValidationMode
	/** Whether to evaluate and report rules. Default: false */
	rules?: boolean
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
	phase: 'draft' | 'signable' | 'executed'
	/** Progress summary */
	summary: {
		requiredTotal: number
		requiredDone: number
		requiredRemaining: number
		completionPercent: number
	}
	/** Evaluated defs values */
	defsValues: Record<string, unknown>
	/** Rules evaluation result */
	rules: {
		valid: boolean
		errors: string[]
		warnings: string[]
	}
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
