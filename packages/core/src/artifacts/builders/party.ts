/**
 * Closure-based party builder for artifacts.
 *
 * Uses factory function and object literal instead of class.
 */

import type { FormParty, FormSignature } from '@paradoc/types';
import { parseFormParty } from '@/validation/artifact-parsers';

// Condition expression type (boolean or string expression)
type CondExpr = boolean | string;

// ============================================================================
// Validation
// ============================================================================

function parseParty(input: unknown): FormParty {
	return parseFormParty(input);
}

// ============================================================================
// Builder Type
// ============================================================================

export interface PartyBuilder {
	/** Initialize from existing FormParty */
	from(value: FormParty): PartyBuilder;
	/** Set the display label for this role */
	label(value: string): PartyBuilder;
	/** Set an optional description for this role */
	description(value: string): PartyBuilder;
	/** Constrain what type of party can fill this role */
	partyType(value: 'person' | 'organization' | 'any'): PartyBuilder;
	/** Allow multiple parties to fill this role */
	multiple(value?: boolean): PartyBuilder;
	/** Set minimum number of parties required (when multiple=true) */
	min(value: number): PartyBuilder;
	/** Set maximum number of parties allowed (when multiple=true) */
	max(value: number): PartyBuilder;
	/** Set whether this role is required */
	required(value?: CondExpr): PartyBuilder;
	/** Set signature requirements for this party role */
	signature(value: FormSignature): PartyBuilder;
	/** Build the FormParty definition */
	build(): FormParty;
}

// ============================================================================
// Factory Function
// ============================================================================

export function partyBuilder(): PartyBuilder {
	const _def: Record<string, unknown> = {};

	const self: PartyBuilder = {
		from(value: FormParty) {
			const parsed = parseParty(value);
			Object.assign(_def, parsed);
			return self;
		},
		label(value: string) {
			_def.label = value;
			return self;
		},
		description(value: string) {
			_def.description = value;
			return self;
		},
		partyType(value: 'person' | 'organization' | 'any') {
			_def.partyType = value;
			return self;
		},
		multiple(value = true) {
			_def.multiple = value;
			return self;
		},
		min(value: number) {
			_def.min = value;
			return self;
		},
		max(value: number) {
			_def.max = value;
			return self;
		},
		required(value: CondExpr = true) {
			_def.required = value;
			return self;
		},
		signature(value: FormSignature) {
			_def.signature = value;
			return self;
		},
		build() {
			return parseParty(_def);
		},
	};

	return self;
}

// ============================================================================
// Party API
// ============================================================================

export type PartyAPI = {
	(): PartyBuilder;
	(input: FormParty): FormParty;
	parse(input: unknown): FormParty;
	safeParse(input: unknown): { success: true; data: FormParty } | { success: false; error: Error };
};

function partyImpl(): PartyBuilder;
function partyImpl(input: FormParty): FormParty;
function partyImpl(input?: FormParty): PartyBuilder | FormParty {
	if (input !== undefined) {
		return parseParty(input);
	}
	return partyBuilder();
}

/**
 * Definition-time party role builder.
 *
 * Use this to define party roles when creating a form schema.
 * At runtime, use person or organization data to fill roles.
 *
 * @example
 * ```ts
 * const buyerRole = party()
 *   .label('Buyer')
 *   .partyType('any')
 *   .signature({ required: true })
 *   .build()
 * ```
 */
export const party: PartyAPI = Object.assign(partyImpl, {
	parse: parseParty,
	safeParse: (input: unknown): { success: true; data: FormParty } | { success: false; error: Error } => {
		try {
			return { success: true, data: parseParty(input) };
		} catch (err) {
			return { success: false, error: err as Error };
		}
	},
});
