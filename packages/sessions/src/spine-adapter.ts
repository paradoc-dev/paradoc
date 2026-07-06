/**
 * Postgres session-spine adapter for the form-completion agent (case-manager chat).
 *
 * The landing playground stores the agent's `FormSession` event log in Redis as
 * its OWN store. The case-manager respondent surface has a different, authoritative
 * store: the `ai_session_event` Postgres log the typed respondent procedures
 * (answer/revise/defer/submit/...) already read and write. Per the design
 * (§4.4): chat is a transport, NOT a second source of truth — the agent's tool
 * calls must land in the SAME log form-mode reads. This adapter is the seam.
 *
 * It implements `WorkflowStateAdapterV2`:
 *   - `load(chatId)` reads the persisted engine events for the bound session
 *     (chatId === the spine sessionId), translates each into the agent's
 *     in-memory `SessionEvent`, and assembles the single `FormSession` the
 *     agent operates on. Resume is therefore free: the log IS the state.
 *   - `save(state)` diffs the agent's event log against what was loaded and
 *     appends only the NEW (tail) events back through the spine's
 *     optimistic-concurrency `appendEvent` — so chat writes and form writes
 *     share one ordering and one validation gate.
 *
 * The adapter is provider-agnostic: it takes a `SessionSpinePort` (the engine
 * functions injected by the route) and never imports `@paradoc/engine`, keeping
 * `@paradoc/ai` free of the heavy server dependency. Translation is pure and
 * unit-tested in `spine-adapter.test.ts`.
 *
 * Gate safety (acceptance criterion): the adapter deliberately does NOT
 * translate the agent's `DocumentRendered` into any finalize/submit event.
 * Chat-mode never finalizes a session; submit stays the explicit, gated
 * respondent action (`respondentSubmit`), so a conversational "yes" cannot
 * bypass review-required / signature-required gates.
 */

import type { Actor, Issue, SessionEvent, Source } from "./event-log/types";
import type { FormSession } from "./engine/types";
import {
	createEmptyWorkflowStateV2,
	type PlaygroundWorkflowStateV2,
	type WorkflowStateAdapterV2,
} from "./state/types";

/**
 * One persisted spine event, narrowed to what the translation needs. Mirrors
 * the engine's `PersistedEvent` / `ai_session_event` row without depending on
 * the engine package.
 */
export type SpineEvent = {
	event_count: number;
	type: string;
	path: string | null;
	payload: Record<string, unknown>;
	actor_type: string;
	actor_model?: string | null;
	source: string | null;
	occurred_at: string;
};

/** An event the agent wants appended, translated to spine vocabulary. */
export type SpineAppend = {
	type: string;
	path: string | null;
	payload: Record<string, unknown>;
	source: Source | null;
	language: string | null;
};

/** Outcome of one append against the spine (mirrors the engine `AppendResult`). */
export type SpineAppendResult =
	| { accepted: true; eventCount: number }
	| { accepted: false; currentEventCount: number };

/**
 * The seam the route wires to the engine. `appendEvent` MUST enforce the
 * spine's optimistic concurrency (claim `expectedEventCount`); a lost race is
 * returned, not thrown.
 */
export interface SessionSpinePort {
	/** The artifact definition snapshot the agent runtime loads, or null. */
	loadSnapshot(): Promise<Record<string, unknown> | null>;
	/** The artifact name (registry name / collection title), for attribution. */
	artifactName(): string;
	/** Persisted events for the bound session, in `event_count` order. */
	listEvents(): Promise<SpineEvent[]>;
	/** Append one event at the asserted ordinal; returns accepted | conflict. */
	appendEvent(
		expectedEventCount: number,
		event: SpineAppend,
	): Promise<SpineAppendResult>;
}

// ---------------------------------------------------------------------------
// Event translation: spine row -> agent SessionEvent (load direction)
// ---------------------------------------------------------------------------

function actorFromSpine(e: SpineEvent): Actor {
	if (e.actor_type === "respondent" || e.actor_type === "user") {
		return { kind: "user" };
	}
	if (e.actor_type === "agent") {
		return { kind: "agent", model: e.actor_model ?? "unknown" };
	}
	return { kind: "system", reason: e.type };
}

function sourceFromSpine(e: SpineEvent): Source {
	// Engine value sources are user/prefill/default/computed; reviewer/extract
	// (platform overrides) are surfaced to the agent as `user` — the agent only
	// distinguishes user-typed from machine-supplied, and a reviewer edit is a
	// human-authored value for its purposes.
	const s = e.source ?? (e.payload.source as string | undefined);
	if (s === "prefill" || s === "default" || s === "computed") return s;
	return "user";
}

/**
 * Translate one persisted spine event into the agent's `SessionEvent`, or null
 * when the kind has no agent-projection meaning (lifecycle/auth/review events
 * the agent doesn't fold). `previous`/`turn` carry no projection weight for the
 * fields where they're cosmetic, so safe defaults are used.
 */
export function spineEventToAgentEvent(e: SpineEvent): SessionEvent | null {
	const by = actorFromSpine(e);
	const at = e.occurred_at;
	switch (e.type) {
		case "session_started":
			return {
				v: 1,
				t: "SessionStarted",
				at,
				by,
				artifact: (e.payload.artifact as string) ?? "",
			};
		case "prefill_applied": {
			// The spine carries prefill as one event per path (path + value); the
			// agent model uses a single PrefillApplied with maps. One-path-per-event
			// still folds correctly: each becomes a single-entry PrefillApplied.
			const path = e.path;
			if (!path) return null;
			return {
				v: 1,
				t: "PrefillApplied",
				at,
				by,
				values: { [path]: e.payload.value },
				sources: { [path]: sourceFromSpine(e) },
				lockedPaths: (e.payload.lockedPaths as string[]) ?? [],
			};
		}
		case "field_presented":
			if (!e.path) return null;
			return {
				v: 1,
				t: "FieldPresented",
				at,
				by,
				fieldPath: e.path,
				presentation:
					e.payload.presentation === "rendered" ? "rendered" : "text",
				turn: typeof e.payload.turn === "number" ? e.payload.turn : 0,
			};
		case "field_answered":
			if (!e.path) return null;
			return {
				v: 1,
				t: "FieldAnswered",
				at,
				by,
				fieldPath: e.path,
				value: e.payload.value,
				source: sourceFromSpine(e),
			};
		case "field_revised":
			if (!e.path) return null;
			return {
				v: 1,
				t: "FieldRevised",
				at,
				by,
				fieldPath: e.path,
				previous: e.payload.previous,
				value: e.payload.value,
			};
		case "field_cleared":
			if (!e.path) return null;
			return {
				v: 1,
				t: "FieldCleared",
				at,
				by,
				fieldPath: e.path,
				previous: e.payload.previous,
			};
		case "field_deferred":
			if (!e.path) return null;
			return { v: 1, t: "FieldDeferred", at, by, fieldPath: e.path };
		case "field_undeferred":
			if (!e.path) return null;
			return { v: 1, t: "FieldUndeferred", at, by, fieldPath: e.path };
		case "field_skipped":
			if (!e.path) return null;
			return { v: 1, t: "FieldSkipped", at, by, fieldPath: e.path };
		case "field_unskipped":
			if (!e.path) return null;
			return { v: 1, t: "FieldUnskipped", at, by, fieldPath: e.path };
		case "party_answered":
			if (!e.path) return null;
			return {
				v: 1,
				t: "PartyAnswered",
				at,
				by,
				roleId: e.path,
				index: typeof e.payload.index === "number" ? e.payload.index : 0,
				party: e.payload.value,
				source: sourceFromSpine(e),
			};
		case "validation_ran":
			return {
				v: 1,
				t: "ValidationRan",
				at,
				valid: e.payload.valid === true,
				errors: Array.isArray(e.payload.errors)
					? (e.payload.errors as Issue[])
					: [],
			};
		case "document_rendered":
			return {
				v: 1,
				t: "DocumentRendered",
				at,
				renderRef: (e.payload.renderRef as string) ?? "",
			};
		case "session_abandoned":
			return { v: 1, t: "SessionAbandoned", at, by };
		// Platform-only kinds the agent does not fold (language_switched,
		// auth_completed, session_submitted, review_*, signature_*, etc.).
		default:
			return null;
	}
}

// ---------------------------------------------------------------------------
// Event translation: agent SessionEvent -> spine append (save direction)
// ---------------------------------------------------------------------------

/**
 * Translate a NEW agent event into a spine append, or null when the event is
 * not persisted to the spine. `DocumentRendered` returns null on purpose (gate
 * safety — chat never finalizes; see file header). `SessionStarted` is also
 * dropped because the spine session already exists before chat begins.
 */
export function agentEventToSpineAppend(ev: SessionEvent): SpineAppend | null {
	switch (ev.t) {
		case "SessionStarted":
			return null;
		case "FieldAnswered":
			return {
				type: "field_answered",
				path: ev.fieldPath,
				payload: { value: ev.value },
				source: ev.source,
				language: null,
			};
		case "FieldRevised":
			return {
				type: "field_revised",
				path: ev.fieldPath,
				payload: { value: ev.value, previous: ev.previous },
				source: null,
				language: null,
			};
		case "FieldCleared":
			return {
				type: "field_cleared",
				path: ev.fieldPath,
				payload: { previous: ev.previous },
				source: null,
				language: null,
			};
		case "FieldDeferred":
			return {
				type: "field_deferred",
				path: ev.fieldPath,
				payload: ev.note ? { note: ev.note } : {},
				source: null,
				language: null,
			};
		case "FieldUndeferred":
			return {
				type: "field_undeferred",
				path: ev.fieldPath,
				payload: {},
				source: null,
				language: null,
			};
		case "FieldSkipped":
			return {
				type: "field_skipped",
				path: ev.fieldPath,
				payload: ev.note ? { note: ev.note } : {},
				source: null,
				language: null,
			};
		case "FieldUnskipped":
			return {
				type: "field_unskipped",
				path: ev.fieldPath,
				payload: {},
				source: null,
				language: null,
			};
		case "FieldPresented":
			return {
				type: "field_presented",
				path: ev.fieldPath,
				payload: { presentation: ev.presentation, turn: ev.turn },
				source: null,
				language: null,
			};
		case "PartyAnswered":
			return {
				type: "party_answered",
				path: ev.roleId,
				payload: { value: ev.party, index: ev.index },
				source: ev.source,
				language: null,
			};
		case "PrefillApplied": {
			// Defensive: the chat agent never emits prefill (prefill is applied at
			// session start by the spine), so this is unreachable in practice. If it
			// ever does, drop it rather than re-applying prefill through chat.
			return null;
		}
		case "ValidationRan":
			return {
				type: "validation_ran",
				path: null,
				payload: { valid: ev.valid, errors: ev.errors },
				source: null,
				language: null,
			};
		case "DocumentRendered":
			// Gate safety: never persisted from chat. See file header.
			return null;
		case "SessionAbandoned":
			return null;
		default: {
			const _exhaustive: never = ev;
			void _exhaustive;
			return null;
		}
	}
}

// ---------------------------------------------------------------------------
// The adapter
// ---------------------------------------------------------------------------

/** A conflict surfaced from `save` so the route can resync and retry the turn. */
export class SpineConflictError extends Error {
	constructor(public readonly currentEventCount: number) {
		super(
			`Session spine conflict: another writer advanced past the expected ordinal (now ${currentEventCount}).`,
		);
		this.name = "SpineConflictError";
	}
}

/**
 * Build a `WorkflowStateAdapterV2` over a single spine session. The `chatId`
 * the agent uses MUST be the spine `sessionId` (the route binds them). The
 * adapter exposes one form session keyed by that id.
 */
export function createSpineStateAdapter(
	sessionId: string,
	port: SessionSpinePort,
): WorkflowStateAdapterV2 {
	// The spine's CURRENT event count (its next-claimable ordinal) at load time,
	// and how many of the agent's persistable events were already on the spine.
	// `save` appends only the tail past `loadedPersistableCount` and claims
	// ordinals starting at `spineEventCount`.
	let spineEventCount = 0;
	let loadedPersistableCount = 0;

	return {
		async load(chatId): Promise<PlaygroundWorkflowStateV2> {
			const state = createEmptyWorkflowStateV2(chatId);
			const [snapshot, events] = await Promise.all([
				port.loadSnapshot(),
				port.listEvents(),
			]);
			spineEventCount = events.length;

			const agentEvents: SessionEvent[] = [];
			let persistableLoaded = 0;
			for (const e of events) {
				const translated = spineEventToAgentEvent(e);
				if (translated) agentEvents.push(translated);
				// A loaded event is "persistable" iff it round-trips: it translated
				// to an agent event AND that agent event maps back to a spine append.
				// These are the events the agent log already reflects on the spine.
				if (translated && agentEventToSpineAppend(translated)) {
					persistableLoaded += 1;
				}
			}
			loadedPersistableCount = persistableLoaded;
			// The agent requires a SessionStarted as the log's first event (the
			// projector treats it as a no-op, but tools expect the session to be
			// "started"). The spine may not carry one explicitly, so synthesize.
			if (!agentEvents.some((e) => e.t === "SessionStarted")) {
				agentEvents.unshift({
					v: 1,
					t: "SessionStarted",
					at: events[0]?.occurred_at ?? new Date().toISOString(),
					by: { kind: "system", reason: "spine" },
					artifact: port.artifactName(),
				});
			}

			const formSession: FormSession = {
				formSessionId: sessionId,
				chatId,
				artifactRef: {
					name: port.artifactName(),
					...(snapshot ? { snapshot } : {}),
				},
				events: agentEvents,
				createdAt: events[0]?.occurred_at ?? new Date().toISOString(),
			};
			state.sessions[sessionId] = formSession;
			state.activeFormSessionId = sessionId;
			return state;
		},

		async save(state): Promise<void> {
			const formSession = state.sessions[sessionId];
			if (!formSession) return;

			// The agent's persistable events, in order. The first
			// `loadedPersistableCount` of these are already on the spine (they were
			// loaded from it); everything after is the new tail this turn appended.
			const persistable: SpineAppend[] = [];
			for (const ev of formSession.events) {
				const append = agentEventToSpineAppend(ev);
				if (append) persistable.push(append);
			}
			const tail = persistable.slice(loadedPersistableCount);

			let expected = spineEventCount;
			for (const append of tail) {
				const result = await port.appendEvent(expected, append);
				if (!result.accepted) {
					throw new SpineConflictError(result.currentEventCount);
				}
				expected = result.eventCount;
			}
			// Advance the cursors so a subsequent save in the same turn appends only
			// further tail (the agent may save multiple times per turn).
			spineEventCount = expected;
			loadedPersistableCount = persistable.length;
		},
	};
}
