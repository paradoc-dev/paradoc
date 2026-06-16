/**
 * Event-log types for the form-completion session engine.
 *
 * The event log is the only persisted state. Every meaningful state change is
 * one of the events below. All other notions of "state" — collectedData, the
 * deferred/skipped sets, presentation order, validation history, current
 * phase — are pure projections over the log (see `projector.ts`).
 *
 * Design contract:
 *   - Events are append-only. They are never modified or deleted.
 *   - Every event is versioned (`v`), timestamped (`at`), and attributed (`by`).
 *   - `t` is the discriminant. Add new event types additively; never repurpose `t`.
 *   - Adding a new event type requires updating `project()` exhaustively.
 */

export type Actor =
	| { kind: "user" }
	| { kind: "agent"; model: string }
	| { kind: "system"; reason: string };

/**
 * Where a field value came from. Used to distinguish user-typed values from
 * those supplied by prefill, schema defaults, or computed expressions.
 */
export type Source = "user" | "prefill" | "default" | "computed";

/**
 * How a field was surfaced to the user. `rendered` means an interactive
 * widget appeared (chip, picker, etc.); `text` means the agent asked in
 * natural language.
 */
export type Presentation = "text" | "rendered";

/**
 * Validation issue surfaced by per-field or whole-form validation.
 * Mirrors the shape returned by Paradoc's validators, kept loose here so
 * the engine package stays independent of validator-internal types.
 */
export type Issue = {
	fieldPath?: string;
	message: string;
	code?: string;
};

export type SessionEvent =
	| {
			v: 1;
			t: "SessionStarted";
			at: string;
			by: Actor;
			artifact: string;
	  }
	| {
			v: 1;
			t: "PrefillApplied";
			at: string;
			by: Actor;
			values: Record<string, unknown>;
			sources: Record<string, Source>;
			lockedPaths: string[];
	  }
	| {
			v: 1;
			t: "FieldPresented";
			at: string;
			by: Actor;
			fieldPath: string;
			presentation: Presentation;
			turn: number;
	  }
	| {
			v: 1;
			t: "FieldAnswered";
			at: string;
			by: Actor;
			fieldPath: string;
			value: unknown;
			source: Source;
	  }
	| {
			v: 1;
			t: "FieldRevised";
			at: string;
			by: Actor;
			fieldPath: string;
			previous: unknown;
			value: unknown;
	  }
	| {
			v: 1;
			t: "FieldCleared";
			at: string;
			by: Actor;
			fieldPath: string;
			previous: unknown;
	  }
	| {
			v: 1;
			t: "FieldDeferred";
			at: string;
			by: Actor;
			fieldPath: string;
			note?: string;
	  }
	| {
			v: 1;
			t: "FieldUndeferred";
			at: string;
			by: Actor;
			fieldPath: string;
	  }
	| {
			v: 1;
			t: "FieldSkipped";
			at: string;
			by: Actor;
			fieldPath: string;
			note?: string;
	  }
	| {
			v: 1;
			t: "FieldUnskipped";
			at: string;
			by: Actor;
			fieldPath: string;
	  }
	| {
			v: 1;
			t: "PartyAnswered";
			at: string;
			by: Actor;
			roleId: string;
			/** Index for repeatable parties (max > 1); default 0. */
			index: number;
			/**
			 * Normalized RuntimeParty value as returned by validatePartyInput —
			 * keeps the engine independent of party-internal types.
			 */
			party: unknown;
			source: Source;
	  }
	| {
			v: 1;
			t: "ValidationRan";
			at: string;
			valid: boolean;
			errors: Issue[];
	  }
	| {
			v: 1;
			t: "DocumentRendered";
			at: string;
			renderRef: string;
	  }
	| {
			v: 1;
			t: "SessionAbandoned";
			at: string;
			by: Actor;
	  };

export type SessionEventType = SessionEvent["t"];

/**
 * Projected (in-memory) view of an event log. Recomputed on every read; never
 * persisted. See `projector.ts` for derivation rules.
 */
export type ProjectedSession = {
	/** Map of fieldPath -> latest value, with provenance. */
	answers: Record<string, AnsweredValue>;
	/** Field paths the user wants to revisit later. */
	deferred: Set<string>;
	/** Optional field paths the user has opted out of answering. */
	skipped: Set<string>;
	/** Ordered record of every presentation event, oldest first. */
	presentation: PresentationRecord[];
	/** Lifecycle status of the session. */
	status: "active" | "abandoned" | "rendered";
	/** Most recent whole-form validation outcome, if any. */
	lastValidation?: { valid: boolean; errors: Issue[]; at: string };
	/** Total number of events folded into this projection. */
	eventCount: number;
	/** Highest `turn` seen so far on FieldPresented events. */
	currentTurn: number;
	/** Locked field paths from prefill (not user-editable). */
	lockedPaths: Set<string>;
	/** Map of `roleId#index` -> latest party value, with provenance. */
	parties: Record<string, AnsweredParty>;
};

export type AnsweredParty = {
	roleId: string;
	index: number;
	party: unknown;
	source: Source;
	at: string;
};

export type AnsweredValue = {
	value: unknown;
	source: Source;
	at: string;
	/** Number of times this answer has been revised since first set. */
	revisions: number;
};

export type PresentationRecord = {
	fieldPath: string;
	presentation: Presentation;
	turn: number;
	at: string;
};
