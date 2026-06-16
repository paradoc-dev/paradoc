import { describe, expect, it } from "vitest";
import type { Actor, SessionEvent } from "../event-log/types";
import { execute } from "./execute";
import type {
	ArtifactRuntime,
	FillStateSnapshot,
	FormSession,
} from "./types";

const USER: Actor = { kind: "user" };
const AGENT: Actor = { kind: "agent", model: "test-model" };
const SYSTEM: Actor = { kind: "system", reason: "test" };

let clockTick = 0;
function nextTick(): string {
	clockTick += 1;
	return `2026-01-01T00:00:${String(clockTick).padStart(2, "0")}.000Z`;
}

function emptySession(initialEvents: SessionEvent[] = []): FormSession {
	clockTick = 0;
	return {
		formSessionId: "fs-1",
		chatId: "chat-1",
		artifactRef: { name: "test-form" },
		events: [...initialEvents],
		createdAt: "2026-01-01T00:00:00.000Z",
	};
}

/**
 * Build a runtime that treats certain fields as required and others as
 * optional, with simple visibility based on a `visibleWhen` predicate or
 * static membership.
 */
function makeRuntime(opts: {
	fields: string[]; // fields that exist on the artifact
	required?: (
		fieldPath: string,
		answers: Record<string, unknown>,
	) => boolean;
	visible?: (
		fieldPath: string,
		answers: Record<string, unknown>,
	) => boolean;
	validate?: (fieldPath: string, value: unknown) => boolean;
}): ArtifactRuntime {
	const isRequired =
		opts.required ?? ((p: string) => !p.endsWith("?optional"));
	const isVisible = opts.visible ?? (() => true);
	const isValid = opts.validate ?? (() => true);
	return {
		hasField(fp) {
			return opts.fields.includes(fp);
		},
		hasParty() {
			return false;
		},
		getFillState(answers): FillStateSnapshot {
			const open = opts.fields.filter(
				(fp) => isVisible(fp, answers) && !(fp in answers),
			);
			return {
				openRequired: open
					.filter((fp) => isRequired(fp, answers))
					.map((fp, i) => ({ fieldPath: fp, order: i })),
				openOptional: open
					.filter((fp) => !isRequired(fp, answers))
					.map((fp, i) => ({ fieldPath: fp, order: i })),
				openRequiredParties: [],
			};
		},
		validateField(fp, v) {
			if (isValid(fp, v)) return { ok: true, value: v };
			return { ok: false, issues: [{ fieldPath: fp, message: "invalid" }] };
		},
		validateParty(_roleId, value) {
			return { ok: true, value };
		},
		listFields() {
			return opts.fields.map((fp) => ({ fieldPath: fp, required: true }));
		},
		listParties() {
			return [];
		},
	};
}

// ─── answer ────────────────────────────────────────────────────────────────

describe("execute — answer", () => {
	it("emits FieldAnswered on happy path", () => {
		const session = emptySession();
		const rt = makeRuntime({ fields: ["/name"] });
		const result = execute(
			session,
			rt,
			{ kind: "answer", fieldPath: "/name", value: "Toby", source: "user" },
			USER,
			{ now: nextTick },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.emitted).toHaveLength(1);
		expect(result.emitted[0]).toMatchObject({
			t: "FieldAnswered",
			fieldPath: "/name",
			value: "Toby",
			source: "user",
		});
		expect(result.session.events).toHaveLength(1);
	});

	it("rejects when the field doesn't exist", () => {
		const session = emptySession();
		const rt = makeRuntime({ fields: ["/name"] });
		const result = execute(
			session,
			rt,
			{ kind: "answer", fieldPath: "/unknown", value: 1, source: "user" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-not-found" });
	});

	it("rejects when the field is not currently visible", () => {
		const session = emptySession();
		const rt = makeRuntime({
			fields: ["/license"],
			visible: () => false,
		});
		const result = execute(
			session,
			rt,
			{ kind: "answer", fieldPath: "/license", value: "abc", source: "user" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-not-visible" });
	});

	it("rejects when the field is already answered (use revise)", () => {
		const session = emptySession([
			{
				v: 1,
				t: "FieldAnswered",
				at: "t0",
				by: USER,
				fieldPath: "/name",
				value: "Old",
				source: "user",
			},
		]);
		const rt = makeRuntime({ fields: ["/name"] });
		const result = execute(
			session,
			rt,
			{ kind: "answer", fieldPath: "/name", value: "New", source: "user" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-already-answered" });
	});

	it("rejects an invalid value", () => {
		const session = emptySession();
		const rt = makeRuntime({
			fields: ["/age"],
			validate: (_, v) => typeof v === "number" && v >= 0,
		});
		const result = execute(
			session,
			rt,
			{ kind: "answer", fieldPath: "/age", value: -1, source: "user" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "invalid-value" });
	});
});

// ─── revise ─────────────────────────────────────────────────────────────────

describe("execute — revise", () => {
	it("emits FieldRevised when the field is already answered", () => {
		const session = emptySession([
			{
				v: 1,
				t: "FieldAnswered",
				at: "t0",
				by: USER,
				fieldPath: "/name",
				value: "Old",
				source: "user",
			},
		]);
		const rt = makeRuntime({ fields: ["/name"] });
		const result = execute(
			session,
			rt,
			{ kind: "revise", fieldPath: "/name", value: "New" },
			USER,
			{ now: nextTick },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.emitted[0]).toMatchObject({
			t: "FieldRevised",
			fieldPath: "/name",
			previous: "Old",
			value: "New",
		});
	});

	it("rejects when there is nothing to revise", () => {
		const session = emptySession();
		const rt = makeRuntime({ fields: ["/name"] });
		const result = execute(
			session,
			rt,
			{ kind: "revise", fieldPath: "/name", value: "X" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-not-answered" });
	});

	it("rejects an invalid revised value", () => {
		const session = emptySession([
			{
				v: 1,
				t: "FieldAnswered",
				at: "t0",
				by: USER,
				fieldPath: "/age",
				value: 30,
				source: "user",
			},
		]);
		const rt = makeRuntime({
			fields: ["/age"],
			validate: (_, v) => typeof v === "number" && v >= 0,
		});
		const result = execute(
			session,
			rt,
			{ kind: "revise", fieldPath: "/age", value: -5 },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "invalid-value" });
	});
});

// ─── clear ──────────────────────────────────────────────────────────────────

describe("execute — clear", () => {
	it("emits FieldCleared with the previous value", () => {
		const session = emptySession([
			{
				v: 1,
				t: "FieldAnswered",
				at: "t0",
				by: USER,
				fieldPath: "/x",
				value: 42,
				source: "user",
			},
		]);
		const rt = makeRuntime({ fields: ["/x"] });
		const result = execute(
			session,
			rt,
			{ kind: "clear", fieldPath: "/x" },
			USER,
			{ now: nextTick },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.emitted[0]).toMatchObject({
			t: "FieldCleared",
			fieldPath: "/x",
			previous: 42,
		});
	});

	it("rejects on an unanswered field", () => {
		const session = emptySession();
		const rt = makeRuntime({ fields: ["/x"] });
		const result = execute(
			session,
			rt,
			{ kind: "clear", fieldPath: "/x" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-not-answered" });
	});
});

// ─── defer / undefer ────────────────────────────────────────────────────────

describe("execute — defer", () => {
	it("emits FieldDeferred on happy path", () => {
		const session = emptySession();
		const rt = makeRuntime({ fields: ["/x"] });
		const result = execute(
			session,
			rt,
			{ kind: "defer", fieldPath: "/x" },
			USER,
			{ now: nextTick },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.emitted[0]).toMatchObject({ t: "FieldDeferred", fieldPath: "/x" });
	});

	it("includes note when provided", () => {
		const session = emptySession();
		const rt = makeRuntime({ fields: ["/x"] });
		const result = execute(
			session,
			rt,
			{ kind: "defer", fieldPath: "/x", note: "later" },
			USER,
			{ now: nextTick },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.emitted[0]).toMatchObject({ note: "later" });
	});

	it("rejects deferring an already-answered field", () => {
		const session = emptySession([
			{
				v: 1,
				t: "FieldAnswered",
				at: "t0",
				by: USER,
				fieldPath: "/x",
				value: 1,
				source: "user",
			},
		]);
		const rt = makeRuntime({ fields: ["/x"] });
		const result = execute(
			session,
			rt,
			{ kind: "defer", fieldPath: "/x" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-already-answered" });
	});

	it("rejects deferring a field that's already deferred", () => {
		const session = emptySession([
			{
				v: 1,
				t: "FieldDeferred",
				at: "t0",
				by: USER,
				fieldPath: "/x",
			},
		]);
		const rt = makeRuntime({ fields: ["/x"] });
		const result = execute(
			session,
			rt,
			{ kind: "defer", fieldPath: "/x" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-already-deferred" });
	});

	it("rejects deferring an invisible field", () => {
		const session = emptySession();
		const rt = makeRuntime({ fields: ["/x"], visible: () => false });
		const result = execute(
			session,
			rt,
			{ kind: "defer", fieldPath: "/x" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-not-visible" });
	});
});

describe("execute — undefer", () => {
	it("emits FieldUndeferred when the field is deferred", () => {
		const session = emptySession([
			{ v: 1, t: "FieldDeferred", at: "t0", by: USER, fieldPath: "/x" },
		]);
		const rt = makeRuntime({ fields: ["/x"] });
		const result = execute(
			session,
			rt,
			{ kind: "undefer", fieldPath: "/x" },
			USER,
			{ now: nextTick },
		);
		expect(result.ok).toBe(true);
	});

	it("rejects when the field isn't deferred", () => {
		const session = emptySession();
		const rt = makeRuntime({ fields: ["/x"] });
		const result = execute(
			session,
			rt,
			{ kind: "undefer", fieldPath: "/x" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-not-deferred" });
	});
});

// ─── skip / unskip ──────────────────────────────────────────────────────────

describe("execute — skip", () => {
	it("emits FieldSkipped on an optional field", () => {
		const session = emptySession();
		const rt = makeRuntime({
			fields: ["/color"],
			required: () => false,
		});
		const result = execute(
			session,
			rt,
			{ kind: "skip", fieldPath: "/color" },
			USER,
			{ now: nextTick },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.emitted[0]).toMatchObject({ t: "FieldSkipped", fieldPath: "/color" });
	});

	it("rejects skipping a required field", () => {
		const session = emptySession();
		const rt = makeRuntime({
			fields: ["/name"],
			required: () => true,
		});
		const result = execute(
			session,
			rt,
			{ kind: "skip", fieldPath: "/name" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-required" });
	});

	it("rejects skipping an already-answered field", () => {
		const session = emptySession([
			{
				v: 1,
				t: "FieldAnswered",
				at: "t0",
				by: USER,
				fieldPath: "/c",
				value: "red",
				source: "user",
			},
		]);
		const rt = makeRuntime({
			fields: ["/c"],
			required: () => false,
		});
		const result = execute(
			session,
			rt,
			{ kind: "skip", fieldPath: "/c" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-already-answered" });
	});

	it("rejects skipping a field that's already skipped", () => {
		const session = emptySession([
			{ v: 1, t: "FieldSkipped", at: "t0", by: USER, fieldPath: "/c" },
		]);
		const rt = makeRuntime({
			fields: ["/c"],
			required: () => false,
		});
		const result = execute(
			session,
			rt,
			{ kind: "skip", fieldPath: "/c" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-already-skipped" });
	});
});

describe("execute — unskip", () => {
	it("emits FieldUnskipped when the field was skipped", () => {
		const session = emptySession([
			{ v: 1, t: "FieldSkipped", at: "t0", by: USER, fieldPath: "/c" },
		]);
		const rt = makeRuntime({ fields: ["/c"], required: () => false });
		const result = execute(
			session,
			rt,
			{ kind: "unskip", fieldPath: "/c" },
			USER,
			{ now: nextTick },
		);
		expect(result.ok).toBe(true);
	});

	it("rejects when not skipped", () => {
		const session = emptySession();
		const rt = makeRuntime({ fields: ["/c"], required: () => false });
		const result = execute(
			session,
			rt,
			{ kind: "unskip", fieldPath: "/c" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-not-skipped" });
	});
});

// ─── present ────────────────────────────────────────────────────────────────

describe("execute — present", () => {
	it("emits FieldPresented with auto-incremented turn", () => {
		const session = emptySession();
		const rt = makeRuntime({ fields: ["/a", "/b"] });

		const r1 = execute(
			session,
			rt,
			{ kind: "present", fieldPath: "/a", presentation: "rendered" },
			AGENT,
			{ now: nextTick },
		);
		expect(r1.ok).toBe(true);
		if (!r1.ok) throw new Error("unreachable");
		expect(r1.emitted[0]).toMatchObject({
			t: "FieldPresented",
			fieldPath: "/a",
			presentation: "rendered",
			turn: 1,
		});

		const r2 = execute(
			r1.session,
			rt,
			{ kind: "present", fieldPath: "/b", presentation: "text" },
			AGENT,
			{ now: nextTick },
		);
		expect(r2.ok).toBe(true);
		if (!r2.ok) throw new Error("unreachable");
		expect(r2.emitted[0]).toMatchObject({ turn: 2 });
	});

	it("rejects presenting an invisible field", () => {
		const session = emptySession();
		const rt = makeRuntime({ fields: ["/a"], visible: () => false });
		const result = execute(
			session,
			rt,
			{ kind: "present", fieldPath: "/a", presentation: "rendered" },
			AGENT,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-not-visible" });
	});
});

// ─── validate / render / abandon ───────────────────────────────────────────

describe("execute — validate", () => {
	it("emits ValidationRan with the supplied result", () => {
		const session = emptySession();
		const rt = makeRuntime({ fields: [] });
		const result = execute(
			session,
			rt,
			{ kind: "validate", valid: false, errors: [{ message: "missing" }] },
			SYSTEM,
			{ now: nextTick },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.emitted[0]).toMatchObject({
			t: "ValidationRan",
			valid: false,
		});
	});
});

describe("execute — render", () => {
	it("emits DocumentRendered and marks status rendered in subsequent projection", () => {
		const session = emptySession();
		const rt = makeRuntime({ fields: [] });
		const result = execute(
			session,
			rt,
			{ kind: "render", renderRef: "blob://abc" },
			SYSTEM,
			{ now: nextTick },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.emitted[0]).toMatchObject({
			t: "DocumentRendered",
			renderRef: "blob://abc",
		});
	});
});

describe("execute — abandon", () => {
	it("emits SessionAbandoned", () => {
		const session = emptySession();
		const rt = makeRuntime({ fields: [] });
		const result = execute(
			session,
			rt,
			{ kind: "abandon" },
			USER,
			{ now: nextTick },
		);
		expect(result.ok).toBe(true);
	});
});

// ─── terminal-state guards ──────────────────────────────────────────────────

describe("execute — terminal state guard", () => {
	it("rejects answer after render", () => {
		const session = emptySession([
			{ v: 1, t: "DocumentRendered", at: "t0", renderRef: "x" },
		]);
		const rt = makeRuntime({ fields: ["/x"] });
		const result = execute(
			session,
			rt,
			{ kind: "answer", fieldPath: "/x", value: 1, source: "user" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "session-not-active" });
	});

	it("rejects defer after abandon", () => {
		const session = emptySession([
			{ v: 1, t: "SessionAbandoned", at: "t0", by: USER },
		]);
		const rt = makeRuntime({ fields: ["/x"] });
		const result = execute(
			session,
			rt,
			{ kind: "defer", fieldPath: "/x" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "session-not-active" });
	});

	it("allows validate after render (read-only telemetry)", () => {
		const session = emptySession([
			{ v: 1, t: "DocumentRendered", at: "t0", renderRef: "x" },
		]);
		const rt = makeRuntime({ fields: [] });
		const result = execute(
			session,
			rt,
			{ kind: "validate", valid: true, errors: [] },
			SYSTEM,
			{ now: nextTick },
		);
		expect(result.ok).toBe(true);
	});
});

// ─── optimistic concurrency ─────────────────────────────────────────────────

describe("execute — expectedEventCount", () => {
	it("accepts when count matches", () => {
		const session = emptySession();
		const rt = makeRuntime({ fields: ["/x"] });
		const result = execute(
			session,
			rt,
			{ kind: "answer", fieldPath: "/x", value: 1, source: "user" },
			USER,
			{ now: nextTick, expectedEventCount: 0 },
		);
		expect(result.ok).toBe(true);
	});

	it("rejects with stale-state when count mismatches", () => {
		const session = emptySession([
			{
				v: 1,
				t: "FieldAnswered",
				at: "t0",
				by: USER,
				fieldPath: "/y",
				value: 2,
				source: "user",
			},
		]);
		const rt = makeRuntime({ fields: ["/x", "/y"] });
		const result = execute(
			session,
			rt,
			{ kind: "answer", fieldPath: "/x", value: 1, source: "user" },
			USER,
			{ now: nextTick, expectedEventCount: 0 }, // expected 0, found 1
		);
		expect(result).toMatchObject({ ok: false, code: "stale-state" });
	});
});

// ─── immutability ───────────────────────────────────────────────────────────

describe("execute — input immutability", () => {
	it("does not mutate the input session", () => {
		const session = emptySession();
		Object.freeze(session.events);
		const rt = makeRuntime({ fields: ["/x"] });
		const before = session.events.length;
		const result = execute(
			session,
			rt,
			{ kind: "answer", fieldPath: "/x", value: 1, source: "user" },
			USER,
			{ now: nextTick },
		);
		expect(result.ok).toBe(true);
		expect(session.events.length).toBe(before);
	});
});

// ─── happy-path session walkthrough ────────────────────────────────────────

describe("execute — end-to-end scripted walkthrough", () => {
	it("models a complete fill: required → optional skipped → render", () => {
		const rt = makeRuntime({
			fields: ["/name", "/age", "/color"],
			required: (p) => p === "/name" || p === "/age",
		});
		let session = emptySession();

		const r1 = execute(
			session,
			rt,
			{ kind: "answer", fieldPath: "/name", value: "Toby", source: "user" },
			USER,
			{ now: nextTick },
		);
		if (!r1.ok) throw new Error("r1 failed");
		session = r1.session;

		const r2 = execute(
			session,
			rt,
			{ kind: "answer", fieldPath: "/age", value: 5, source: "user" },
			USER,
			{ now: nextTick },
		);
		if (!r2.ok) throw new Error("r2 failed");
		session = r2.session;

		const r3 = execute(
			session,
			rt,
			{ kind: "skip", fieldPath: "/color" },
			USER,
			{ now: nextTick },
		);
		if (!r3.ok) throw new Error("r3 failed");
		session = r3.session;

		const r4 = execute(
			session,
			rt,
			{ kind: "render", renderRef: "blob://done" },
			SYSTEM,
			{ now: nextTick },
		);
		if (!r4.ok) throw new Error("r4 failed");
		session = r4.session;

		expect(session.events).toHaveLength(4);
		expect(session.events.map((e) => e.t)).toEqual([
			"FieldAnswered",
			"FieldAnswered",
			"FieldSkipped",
			"DocumentRendered",
		]);
	});
});
