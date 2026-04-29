/**
 * Closure-based annex builder for artifacts.
 *
 * Uses factory function and object literal instead of class.
 */

import type { FormAnnex } from '@paradoc/types';
import { parseFormAnnex } from '@/validation/artifact-parsers';

// Condition expression type (boolean or string expression)
type CondExpr = boolean | string;

// ============================================================================
// Validation
// ============================================================================

function parseAnnex(input: unknown): FormAnnex {
	return parseFormAnnex(input);
}

// ============================================================================
// Builder Type
// ============================================================================

export interface AnnexBuilder {
	/** Initialize from existing FormAnnex */
	from(value: FormAnnex): AnnexBuilder;
	/** Set the display title for this annex slot */
	title(value: string): AnnexBuilder;
	/** Set an optional description for this annex */
	description(value: string): AnnexBuilder;
	/** Set whether the annex is required */
	required(value?: CondExpr): AnnexBuilder;
	/** Set whether the annex is visible */
	visible(value?: CondExpr): AnnexBuilder;
	/** Set the display order for rendering */
	order(value: number): AnnexBuilder;
	/** Build the FormAnnex definition */
	build(): FormAnnex;
}

// ============================================================================
// Factory Function
// ============================================================================

export function annexBuilder(): AnnexBuilder {
	const _def: Record<string, unknown> = {};

	const self: AnnexBuilder = {
		from(value: FormAnnex) {
			Object.assign(_def, parseAnnex(value));
			return self;
		},
		title(value: string) {
			_def.title = value;
			return self;
		},
		description(value: string) {
			_def.description = value;
			return self;
		},
		required(value: CondExpr = true) {
			_def.required = value;
			return self;
		},
		visible(value: CondExpr = true) {
			_def.visible = value;
			return self;
		},
		order(value: number) {
			_def.order = value;
			return self;
		},
		build() {
			return parseAnnex(_def);
		},
	};

	return self;
}

// ============================================================================
// Annex API
// ============================================================================

export type AnnexAPI = {
	(): AnnexBuilder;
	(input: FormAnnex): FormAnnex;
	parse(input: unknown): FormAnnex;
	safeParse(input: unknown): { success: true; data: FormAnnex } | { success: false; error: Error };
};

function annexImpl(): AnnexBuilder;
function annexImpl(input: FormAnnex): FormAnnex;
function annexImpl(input?: FormAnnex): AnnexBuilder | FormAnnex {
	if (input !== undefined) {
		return parseAnnex(input);
	}
	return annexBuilder();
}

/**
 * Builder for FormAnnex - design-time annex slot definitions.
 *
 * FormAnnex defines a slot for supplementary documents that can be attached to a form.
 *
 * @example
 * ```ts
 * const photoIdAnnex = annex()
 *   .title('Photo ID')
 *   .description('Upload a government-issued photo ID')
 *   .required(true)
 *   .order(1)
 *   .build()
 * ```
 */
export const annex: AnnexAPI = Object.assign(annexImpl, {
	parse: parseAnnex,
	safeParse: (input: unknown): { success: true; data: FormAnnex } | { success: false; error: Error } => {
		try {
			return { success: true, data: parseAnnex(input) };
		} catch (err) {
			return { success: false, error: err as Error };
		}
	},
});
