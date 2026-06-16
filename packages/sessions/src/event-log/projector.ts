import type {
	AnsweredValue,
	PresentationRecord,
	ProjectedSession,
	SessionEvent,
} from "./types";

function emptyProjection(): ProjectedSession {
	return {
		answers: {},
		deferred: new Set(),
		skipped: new Set(),
		presentation: [],
		status: "active",
		eventCount: 0,
		currentTurn: 0,
		lockedPaths: new Set(),
		parties: {},
	};
}

/**
 * Fold a sequence of events into a ProjectedSession.
 *
 * Pure: no IO, no clock, no randomness. The same input always produces an
 * equivalent output (Set ordering aside, which is insertion-order in JS).
 *
 * Order matters: events are applied left-to-right. The projector is the
 * exhaustive switch over event types — adding a new event type to `SessionEvent`
 * without handling it here is a compile error.
 */
export function project(events: ReadonlyArray<SessionEvent>): ProjectedSession {
	const p = emptyProjection();
	for (const ev of events) {
		p.eventCount += 1;
		applyEvent(p, ev);
	}
	return p;
}

function applyEvent(p: ProjectedSession, ev: SessionEvent): void {
	switch (ev.t) {
		case "SessionStarted":
			// No projection-visible state change beyond eventCount.
			return;

		case "PrefillApplied": {
			for (const [path, value] of Object.entries(ev.values)) {
				const source = ev.sources[path] ?? "prefill";
				const existing = p.answers[path];
				p.answers[path] = {
					value,
					source,
					at: ev.at,
					revisions: existing ? existing.revisions + 1 : 0,
				};
			}
			for (const path of ev.lockedPaths) {
				p.lockedPaths.add(path);
			}
			return;
		}

		case "FieldPresented": {
			const record: PresentationRecord = {
				fieldPath: ev.fieldPath,
				presentation: ev.presentation,
				turn: ev.turn,
				at: ev.at,
			};
			p.presentation.push(record);
			if (ev.turn > p.currentTurn) p.currentTurn = ev.turn;
			return;
		}

		case "FieldAnswered": {
			const existing = p.answers[ev.fieldPath];
			const answered: AnsweredValue = {
				value: ev.value,
				source: ev.source,
				at: ev.at,
				revisions: existing ? existing.revisions + 1 : 0,
			};
			p.answers[ev.fieldPath] = answered;
			// Answering a field clears any pending defer/skip marks.
			p.deferred.delete(ev.fieldPath);
			p.skipped.delete(ev.fieldPath);
			return;
		}

		case "FieldRevised": {
			const existing = p.answers[ev.fieldPath];
			p.answers[ev.fieldPath] = {
				value: ev.value,
				source: existing?.source ?? "user",
				at: ev.at,
				revisions: (existing?.revisions ?? 0) + 1,
			};
			p.deferred.delete(ev.fieldPath);
			p.skipped.delete(ev.fieldPath);
			return;
		}

		case "FieldCleared": {
			delete p.answers[ev.fieldPath];
			return;
		}

		case "FieldDeferred":
			p.deferred.add(ev.fieldPath);
			return;

		case "FieldUndeferred":
			p.deferred.delete(ev.fieldPath);
			return;

		case "FieldSkipped":
			p.skipped.add(ev.fieldPath);
			return;

		case "FieldUnskipped":
			p.skipped.delete(ev.fieldPath);
			return;

		case "PartyAnswered": {
			const key = `${ev.roleId}#${ev.index}`;
			p.parties[key] = {
				roleId: ev.roleId,
				index: ev.index,
				party: ev.party,
				source: ev.source,
				at: ev.at,
			};
			return;
		}

		case "ValidationRan":
			p.lastValidation = { valid: ev.valid, errors: ev.errors, at: ev.at };
			return;

		case "DocumentRendered":
			p.status = "rendered";
			return;

		case "SessionAbandoned":
			p.status = "abandoned";
			return;

		default: {
			// Exhaustiveness guard. If a new SessionEvent variant is added,
			// TypeScript will fail here until it's handled above.
			const _exhaustive: never = ev;
			void _exhaustive;
			return;
		}
	}
}
