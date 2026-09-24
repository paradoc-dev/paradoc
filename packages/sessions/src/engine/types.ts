import type {
	Issue,
	Presentation,
	SessionEvent,
	Source,
} from "../event-log/types";

/**
 * Persisted shape of a single form-completion session.
 *
 * `events` is the only source of truth. Everything else (`answers`, `deferred`,
 * `skipped`, `currentTarget`, `phase`, etc.) is derived by replaying the log.
 */
export type FormSession = {
	formSessionId: string;
	chatId: string;
	artifactRef: {
		name: string;
		version?: string;
		/**
		 * Snapshot of the artifact definition at session-start time, kept on
		 * the session so reads are self-contained even if the source artifact
		 * is later mutated.
		 */
		snapshot?: Record<string, unknown>;
		/** Human-facing instructions content (Markdown), if the artifact provides any. */
		instructions?: string;
		/** Author-supplied agent-specific instructions (Markdown), if any. */
		agentInstructions?: string;
	};
	events: SessionEvent[];
	createdAt: string;
};

/**
 * A command is the only way to mutate a session. Tools submit commands;
 * `execute()` decides what events (if any) to append.
 */
export type Command =
	| { kind: "answer"; fieldPath: string; value: unknown; source: Source }
	| { kind: "revise"; fieldPath: string; value: unknown }
	| { kind: "clear"; fieldPath: string }
	| { kind: "defer"; fieldPath: string; note?: string }
	| { kind: "undefer"; fieldPath: string }
	| { kind: "skip"; fieldPath: string; note?: string }
	| { kind: "unskip"; fieldPath: string }
	| { kind: "present"; fieldPath: string; presentation: Presentation }
	| {
			kind: "answerParty";
			roleId: string;
			/** Position within a repeatable role (`max > 1`); defaults to 0. */
			index?: number;
			value: unknown;
			source: Source;
	  }
	| { kind: "answerAnnex"; annexId: string; value: unknown; source: Source }
	| { kind: "clearAnnex"; annexId: string }
	| { kind: "validate"; valid: boolean; errors: Issue[] }
	| { kind: "render"; renderRef: string }
	| { kind: "abandon" };

export type CommandErrorCode =
	| "field-not-found"
	| "field-not-visible"
	| "field-locked"
	| "unresolved-state"
	| "field-required"
	| "field-not-required"
	| "field-already-answered"
	| "field-not-answered"
	| "field-not-deferred"
	| "field-not-skipped"
	| "field-already-deferred"
	| "field-already-skipped"
	| "party-not-found"
	| "party-index-out-of-order"
	| "annex-not-found"
	| "annex-not-answered"
	| "stale-state"
	| "session-not-active"
	| "invalid-value";

export type CommandResult =
	| { ok: true; session: FormSession; emitted: SessionEvent[] }
	| { ok: false; code: CommandErrorCode; reason: string };

/**
 * Per-field schema validation outcome. On success, `value` carries the
 * canonical (post-coercion) value that should be persisted — so a numeric
 * string like "20" gets stored as the number 20.
 */
export type FieldValidation =
	| { ok: true; value: unknown }
	| { ok: false; issues: Issue[] };

/**
 * Minimal subset of FillState that `execute()` needs.
 *
 * In production this is wired to `@paradoc/core`'s real FillState via a thin
 * adapter; in tests it's built directly. Keeping the shape minimal keeps the
 * engine independent of core's evolution and makes tests cheap.
 */
/** A field's effective status; `required` implies visible (see @paradoc/core). */
export type FieldStatus = "hidden" | "optional" | "required";

export type FillStateSnapshot = {
	/** Whether the host successfully resolved visibility and requiredness. */
	resolved: boolean;
	/**
	 * Host diagnostics: why a snapshot is unresolved, or a computed value that
	 * failed while visibility and requiredness still resolved.
	 */
	diagnostics?: string[];
	/** Required, unanswered, visible fields — in artifact declaration order. */
	openRequired: Array<{ fieldPath: string; order: number; status: FieldStatus }>;
	/** Optional, unanswered, visible fields — in artifact declaration order. */
	openOptional: Array<{ fieldPath: string; order: number; status: FieldStatus }>;
	/** Already answered fields, including their current effective visibility. */
	done: Array<{ fieldPath: string; order: number; status: FieldStatus }>;
	/** Party roles that still need filling — in artifact declaration order. */
	openRequiredParties: Array<{ roleId: string; label?: string; order: number }>;
	/** Required, unattached, visible annexes — in artifact declaration order. */
	openRequiredAnnexes: Array<{ annexId: string; label?: string; order: number }>;
	/** Optional, unattached, visible annexes — in artifact declaration order. */
	openOptionalAnnexes: Array<{ annexId: string; label?: string; order: number }>;
	/**
	 * The canonical DAG-ordered, required-first candidate sequence (fields and
	 * parties), straight from core — the single source of next-field order.
	 */
	candidates?: Array<{ kind: "field" | "party" | "annex"; key: string; required: boolean; order: number }>;
};

/**
 * Validated party value as returned by validatePartyInput. The engine treats
 * this as opaque — it's just a value to round-trip from validator to renderer.
 */
export type PartyValidation =
	| { ok: true; value: unknown }
	| { ok: false; issues: Issue[] };

/**
 * Validated annex value (an Attachment) as returned by validateAnnexInput.
 * Opaque to the engine, like a party.
 */
export type AnnexValidation =
	| { ok: true; value: unknown }
	| { ok: false; issues: Issue[] };

/**
 * Read-only interface the engine uses to query the artifact. Tests build a
 * fake; production wires this to @paradoc/core via a factory in derive.ts.
 */
export interface ArtifactRuntime {
	/** True iff the field exists in the artifact schema (regardless of visibility). */
	hasField(fieldPath: string): boolean;
	/** True iff the artifact defines a party role with this id. */
	hasParty(roleId: string): boolean;
	/** True iff the artifact defines an annex slot with this id. */
	hasAnnex(annexId: string): boolean;
	/**
	 * Compute the open-required and open-optional buckets given current state:
	 * flat field answers, parties keyed by role (an array for a role with
	 * `max > 1`), and annexes keyed by id. `sessionPayload` builds the last two.
	 */
	getFillState(
		answers: Record<string, unknown>,
		parties: Record<string, unknown>,
		annexes: Record<string, unknown>,
	): FillStateSnapshot;
	/** Validate a value against the field's per-field schema. */
	validateField(fieldPath: string, value: unknown): FieldValidation;
	/**
	 * Validate a value against the party role's schema at `index` (0 for a
	 * single-party role); returns the normalized party.
	 */
	validateParty(roleId: string, value: unknown, index: number): PartyValidation;
	/** Validate a value against the annex slot's Attachment schema. */
	validateAnnex(annexId: string, value: unknown): AnnexValidation;
	/**
	 * Enumerate every field path the artifact defines (declaration order). A
	 * list contributes its own path and its item paths under `[]`, for example
	 * `items` and `items[].name`.
	 */
	listFields(): Array<{ fieldPath: string; required: boolean; type?: string }>;
	/**
	 * Enumerate every party role the artifact defines (declaration order).
	 * `max` is how many parties the role accepts; above 1 the payload carries
	 * the role as an array.
	 */
	listParties(): Array<{
		roleId: string;
		label?: string;
		partyType: "person" | "organization" | "any";
		max: number;
	}>;
	/** Enumerate every annex slot the artifact defines (declaration order). */
	listAnnexes(): Array<{ annexId: string; label?: string }>;
}

export type ExecuteOptions = {
	/**
	 * If supplied, execute() rejects with `stale-state` when the session's
	 * current event count doesn't match. Use for optimistic concurrency.
	 */
	expectedEventCount?: number;
	/** Injected clock for tests. Defaults to `new Date().toISOString()`. */
	now?: () => string;
};
