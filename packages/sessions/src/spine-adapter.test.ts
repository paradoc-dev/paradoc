import { describe, expect, it } from "vitest";
import {
	agentEventToSpineAppend,
	createSpineStateAdapter,
	spineEventToAgentEvent,
	SpineConflictError,
	type SessionSpinePort,
	type SpineAppend,
	type SpineEvent,
} from "./spine-adapter";
import { project } from "./event-log/projector";
import type { SessionEvent } from "./event-log/types";

/**
 * The spine adapter is the seam that makes chat and form-mode write the SAME
 * `ai_session_event` log (design §4.4). These tests encode WHY that matters:
 *
 *  - A field a respondent answered in form-mode MUST be visible to the chat
 *    agent on load, and vice-versa — switching channels mid-session can never
 *    lose an answer (acceptance criterion).
 *  - Chat-mode must NOT persist a render/finalize: a conversational "yes"
 *    cannot bypass review/signature gates (acceptance criterion). The render
 *    event is dropped on the way to the spine.
 *  - Saves append only the NEW tail through the spine's optimistic-concurrency
 *    append, and a lost race surfaces as a typed conflict the route resyncs
 *    from — never a silent overwrite.
 */

function spineEvent(partial: Partial<SpineEvent> & { type: string }): SpineEvent {
	return {
		event_count: 0,
		path: null,
		payload: {},
		actor_type: "respondent",
		source: null,
		occurred_at: "2026-06-08T00:00:00.000Z",
		...partial,
	};
}

/** An in-memory spine the adapter writes through, with optimistic concurrency. */
function fakeSpine(initial: SpineEvent[], snapshot: Record<string, unknown> | null = { fields: {} }) {
	const events = [...initial];
	const port: SessionSpinePort = {
		loadSnapshot: async () => snapshot,
		artifactName: () => "test-form",
		listEvents: async () => events.map((e, i) => ({ ...e, event_count: i })),
		appendEvent: async (expected, append) => {
			if (expected !== events.length) {
				return { accepted: false, currentEventCount: events.length };
			}
			events.push(
				spineEvent({
					type: append.type,
					path: append.path,
					payload: append.payload,
					source: append.source,
					event_count: events.length,
				}),
			);
			return { accepted: true, eventCount: events.length };
		},
	};
	return { port, events };
}

describe("spineEventToAgentEvent", () => {
	it("maps a form-mode field answer to the agent's FieldAnswered so chat sees it", () => {
		const ev = spineEventToAgentEvent(
			spineEvent({
				type: "field_answered",
				path: "fullName",
				payload: { value: "Ada" },
				source: "user",
			}),
		);
		expect(ev).toMatchObject({
			t: "FieldAnswered",
			fieldPath: "fullName",
			value: "Ada",
			source: "user",
		});
	});

	it("drops platform-only lifecycle kinds the agent does not fold", () => {
		expect(spineEventToAgentEvent(spineEvent({ type: "session_submitted" }))).toBeNull();
		expect(spineEventToAgentEvent(spineEvent({ type: "language_switched" }))).toBeNull();
		expect(spineEventToAgentEvent(spineEvent({ type: "auth_completed" }))).toBeNull();
	});
});

describe("agentEventToSpineAppend — gate safety", () => {
	it("never persists DocumentRendered (a verbal yes must not finalize)", () => {
		const render: SessionEvent = {
			v: 1,
			t: "DocumentRendered",
			at: "2026-06-08T00:00:00.000Z",
			renderRef: "r2://x",
		};
		expect(agentEventToSpineAppend(render)).toBeNull();
	});

	it("does not persist SessionStarted (the spine session predates chat)", () => {
		const started: SessionEvent = {
			v: 1,
			t: "SessionStarted",
			at: "2026-06-08T00:00:00.000Z",
			by: { kind: "system", reason: "x" },
			artifact: "f",
		};
		expect(agentEventToSpineAppend(started)).toBeNull();
	});

	it("maps a chat answer to a field_answered append", () => {
		const answered: SessionEvent = {
			v: 1,
			t: "FieldAnswered",
			at: "2026-06-08T00:00:00.000Z",
			by: { kind: "user" },
			fieldPath: "email",
			value: "a@b.co",
			source: "user",
		};
		expect(agentEventToSpineAppend(answered)).toEqual<SpineAppend>({
			type: "field_answered",
			path: "email",
			payload: { value: "a@b.co" },
			source: "user",
			language: null,
		});
	});
});

describe("createSpineStateAdapter — load", () => {
	it("rehydrates prior form-mode answers so chat resumes with state intact", async () => {
		const { port } = fakeSpine([
			spineEvent({ type: "session_started", payload: { artifact: "test-form" } }),
			spineEvent({ type: "field_answered", path: "fullName", payload: { value: "Ada" }, source: "user" }),
			spineEvent({ type: "field_answered", path: "email", payload: { value: "a@b.co" }, source: "user" }),
		]);
		const adapter = createSpineStateAdapter("sess-1", port);
		const state = await adapter.load("sess-1");
		const session = state.sessions["sess-1"]!;
		const projected = project(session.events);
		// Both answers a respondent gave in form-mode are visible to the agent.
		expect(projected.answers.fullName?.value).toBe("Ada");
		expect(projected.answers.email?.value).toBe("a@b.co");
		expect(state.activeFormSessionId).toBe("sess-1");
	});

	it("synthesizes a SessionStarted when the spine log lacks one", async () => {
		const { port } = fakeSpine([
			spineEvent({ type: "field_answered", path: "x", payload: { value: 1 }, source: "user" }),
		]);
		const adapter = createSpineStateAdapter("sess-1", port);
		const state = await adapter.load("sess-1");
		const events = state.sessions["sess-1"]!.events;
		expect(events[0]?.t).toBe("SessionStarted");
	});
});

describe("createSpineStateAdapter — save", () => {
	it("appends only the new tail through the spine, preserving order", async () => {
		const { port, events } = fakeSpine([
			spineEvent({ type: "session_started", payload: { artifact: "test-form" } }),
			spineEvent({ type: "field_answered", path: "a", payload: { value: 1 }, source: "user" }),
		]);
		const adapter = createSpineStateAdapter("sess-1", port);
		const state = await adapter.load("sess-1");
		const session = state.sessions["sess-1"]!;
		// Agent answers two more fields this turn.
		session.events.push(
			{ v: 1, t: "FieldAnswered", at: "t", by: { kind: "user" }, fieldPath: "b", value: 2, source: "user" },
			{ v: 1, t: "FieldAnswered", at: "t", by: { kind: "user" }, fieldPath: "c", value: 3, source: "user" },
		);
		await adapter.save(state);
		// Only the two new answers were appended (not the pre-existing 'a').
		const appended = events.filter((e) => e.type === "field_answered").map((e) => e.path);
		expect(appended).toEqual(["a", "b", "c"]);
	});

	it("surfaces a SpineConflictError when another writer wins the race", async () => {
		const { port, events } = fakeSpine([
			spineEvent({ type: "session_started", payload: { artifact: "test-form" } }),
		]);
		const adapter = createSpineStateAdapter("sess-1", port);
		const state = await adapter.load("sess-1");
		// A concurrent form-mode writer lands an event after load but before save.
		events.push(spineEvent({ type: "field_answered", path: "x", payload: { value: 9 }, source: "user" }));
		state.sessions["sess-1"]!.events.push({
			v: 1,
			t: "FieldAnswered",
			at: "t",
			by: { kind: "user" },
			fieldPath: "y",
			value: 1,
			source: "user",
		});
		await expect(adapter.save(state)).rejects.toBeInstanceOf(SpineConflictError);
	});

	it("does not write a render event even if the agent emits one", async () => {
		const { port, events } = fakeSpine([
			spineEvent({ type: "session_started", payload: { artifact: "test-form" } }),
		]);
		const adapter = createSpineStateAdapter("sess-1", port);
		const state = await adapter.load("sess-1");
		state.sessions["sess-1"]!.events.push({
			v: 1,
			t: "DocumentRendered",
			at: "t",
			renderRef: "r2://x",
		});
		await adapter.save(state);
		expect(events.some((e) => e.type === "document_rendered")).toBe(false);
	});
});
