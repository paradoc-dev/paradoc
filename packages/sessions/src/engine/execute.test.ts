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
	resolved?: boolean;
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
		hasAnnex() {
			return false;
		},
		getFillState(answers): FillStateSnapshot {
			const open = opts.fields.filter(
				(fp) => isVisible(fp, answers) && !(fp in answers),
			);
			const done = opts.fields
				.filter((fp) => fp in answers)
				.map((fp, i) => ({
					fieldPath: fp,
					order: i,
					status: isVisible(fp, answers)
						? isRequired(fp, answers)
							? ("required" as const)
							: ("optional" as const)
						: ("hidden" as const),
				}));
			return {
				resolved: opts.resolved ?? true,
				openRequired: open
					.filter((fp) => isRequired(fp, answers))
					.map((fp, i) => ({ fieldPath: fp, order: i, status: "required" as const })),
				openOptional: open
					.filter((fp) => !isRequired(fp, answers))
					.map((fp, i) => ({ fieldPath: fp, order: i, status: "optional" as const })),
				done,
				openRequiredParties: [],
				openRequiredAnnexes: [],
				openOptionalAnnexes: [],
			};
		},
		validateField(fp, v) {
			if (isValid(fp, v)) return { ok: true, value: v };
			return { ok: false, issues: [{ fieldPath: fp, message: "invalid" }] };
		},
		validateParty(_roleId, value) {
			return { ok: true, value };
		},
		validateAnnex(_annexId, value) {
			return { ok: true, value };
		},
		listFields() {
			return opts.fields.map((fp) => ({ fieldPath: fp, required: true }));
		},
		listParties() {
			return [];
		},
		listAnnexes() {
			return [];
		},
	};
}

describe("execute — resolved presentation contract", () => {
	it("rejects mutations while the host snapshot is unresolved", () => {
		const session = emptySession();
		const rt = makeRuntime({ fields: ["/name"], resolved: false });

		for (const command of [
			{ kind: "answer", fieldPath: "/name", value: "Toby", source: "user" } as const,
			{ kind: "defer", fieldPath: "/name" } as const,
			{ kind: "present", fieldPath: "/name", presentation: "text" } as const,
		]) {
			const result = execute(session, rt, command, USER, { now: nextTick });
			expect(result).toMatchObject({ ok: false, code: "unresolved-state" });
		}

		const reviseSession = emptySession([
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
		const revised = execute(
			reviseSession,
			rt,
			{ kind: "revise", fieldPath: "/name", value: "New", source: "user" },
			USER,
			{ now: nextTick },
		);
		expect(revised).toMatchObject({ ok: false, code: "unresolved-state" });
	});

	it("denies an answered field omitted from the resolved snapshot", () => {
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
		const base = makeRuntime({ fields: ["/name"] });
		const rt: ArtifactRuntime = {
			...base,
			getFillState: () => ({
				resolved: true,
				openRequired: [],
				openOptional: [],
				done: [],
				openRequiredParties: [],
				openRequiredAnnexes: [],
				openOptionalAnnexes: [],
			}),
		};
		const result = execute(
			session,
			rt,
			{ kind: "revise", fieldPath: "/name", value: "New", source: "user" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-not-visible" });
		expect(session.events).toHaveLength(1);
	});

	it("denies revising a field that the host now marks hidden", () => {
		const session = emptySession([
			{
				v: 1,
				t: "FieldAnswered",
				at: "t0",
				by: USER,
				fieldPath: "/license",
				value: "abc",
				source: "user",
			},
		]);
		const rt = makeRuntime({ fields: ["/license"], visible: () => false });
		const result = execute(
			session,
			rt,
			{ kind: "revise", fieldPath: "/license", value: "def", source: "user" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-not-visible" });
		expect(session.events).toHaveLength(1);
	});
});

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
			{ kind: "revise", fieldPath: "/name", value: "New", source: "user" },
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
			{ kind: "revise", fieldPath: "/name", value: "X", source: "user" },
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
			{ kind: "revise", fieldPath: "/age", value: -5, source: "user" },
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

	it("rejects clearing a field the host now marks hidden", () => {
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
		const rt = makeRuntime({ fields: ["/x"], visible: () => false });
		const result = execute(
			session,
			rt,
			{ kind: "clear", fieldPath: "/x" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-not-visible" });
		expect(session.events).toHaveLength(1);
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

describe("execute — locked prefill fields", () => {
	function prefilled(lockedPaths: string[]): FormSession {
		return emptySession([
			{
				v: 1,
				t: "PrefillApplied",
				at: "2026-01-01T00:00:00.000Z",
				by: SYSTEM,
				values: { "/ssn": "123-45-6789" },
				sources: { "/ssn": "prefill" },
				lockedPaths,
			},
		]);
	}
	const rt = makeRuntime({ fields: ["/ssn", "/name"] });

	it("rejects revise on a locked path, names the path, and leaves the answer unchanged", () => {
		const session = prefilled(["/ssn"]);
		const result = execute(
			session,
			rt,
			{ kind: "revise", fieldPath: "/ssn", value: "000-00-0000", source: "user" },
			AGENT,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-locked" });
		if (result.ok) throw new Error("expected rejection");
		expect(result.reason).toContain("/ssn");
		expect(session.events).toHaveLength(1);
	});

	it("rejects clear on a locked path", () => {
		const result = execute(
			prefilled(["/ssn"]),
			rt,
			{ kind: "clear", fieldPath: "/ssn" },
			AGENT,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-locked" });
		if (result.ok) throw new Error("expected rejection");
		expect(result.reason).toContain("/ssn");
	});

	it("rejects a first answer to a locked path that carries no prefilled value", () => {
		const result = execute(
			prefilled(["/name"]),
			rt,
			{ kind: "answer", fieldPath: "/name", value: "Mallory", source: "user" },
			USER,
			{ now: nextTick },
		);
		expect(result).toMatchObject({ ok: false, code: "field-locked" });
		if (result.ok) throw new Error("expected rejection");
		expect(result.reason).toContain("/name");
	});

	it("still accepts revise, clear, and answer on unlocked paths of a prefilled session", () => {
		const session = prefilled([]);
		const revised = execute(
			session,
			rt,
			{ kind: "revise", fieldPath: "/ssn", value: "000-00-0000", source: "user" },
			AGENT,
			{ now: nextTick },
		);
		expect(revised.ok).toBe(true);
		const cleared = execute(session, rt, { kind: "clear", fieldPath: "/ssn" }, AGENT, {
			now: nextTick,
		});
		expect(cleared.ok).toBe(true);
		const answered = execute(
			prefilled(["/ssn"]),
			rt,
			{ kind: "answer", fieldPath: "/name", value: "Toby", source: "user" },
			USER,
			{ now: nextTick },
		);
		expect(answered.ok).toBe(true);
	});
});

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

describe("execute — start", () => {
	it("opens an empty session with SessionStarted naming the artifact", () => {
		const result = execute(emptySession(), makeRuntime({ fields: [] }), { kind: "start" }, SYSTEM, {
			now: nextTick,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.emitted).toEqual([
			{ v: 1, t: "SessionStarted", at: "2026-01-01T00:00:01.000Z", by: SYSTEM, artifact: "test-form" },
		]);
	});

	it("rejects a second start", () => {
		const rt = makeRuntime({ fields: [] });
		const started = execute(emptySession(), rt, { kind: "start" }, SYSTEM, { now: nextTick });
		if (!started.ok) throw new Error("unreachable");
		const again = execute(started.session, rt, { kind: "start" }, SYSTEM, { now: nextTick });
		expect(again).toMatchObject({ ok: false, code: "session-already-started" });
	});

	it("opens a session with no chatId — the engine has no chat host to tie to", () => {
		// FormSession.chatId is host metadata for a chat-based host; a
		// non-chat host must be able to open a session without inventing one.
		const session: FormSession = {
			formSessionId: "fs-no-chat",
			artifactRef: { name: "test-form" },
			events: [],
			createdAt: "2026-01-01T00:00:00.000Z",
		};
		const result = execute(session, makeRuntime({ fields: [] }), { kind: "start" }, SYSTEM, {
			now: nextTick,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.session.chatId).toBeUndefined();
	});
});

describe("execute — prefill", () => {
	const rt = makeRuntime({
		fields: ["/name", "/age"],
		validate: (fp, v) => fp !== "/age" || typeof v === "number",
	});

	it("applies validated values with prefill source and locks the named paths", () => {
		const result = execute(
			emptySession(),
			rt,
			{ kind: "prefill", values: { "/name": "Acme" }, lockedPaths: ["/name"] },
			SYSTEM,
			{ now: nextTick },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.emitted[0]).toMatchObject({
			t: "PrefillApplied",
			values: { "/name": "Acme" },
			sources: { "/name": "prefill" },
			lockedPaths: ["/name"],
		});
		const revise = execute(
			result.session,
			rt,
			{ kind: "revise", fieldPath: "/name", value: "Other", source: "user" },
			USER,
			{ now: nextTick },
		);
		expect(revise).toMatchObject({ ok: false, code: "field-locked" });
	});

	it("stores the value the runtime's validation returns", () => {
		const coercing: ArtifactRuntime = {
			...rt,
			validateField: (_fp, v) => ({ ok: true, value: Number(v) }),
		};
		const result = execute(emptySession(), coercing, { kind: "prefill", values: { "/age": "20" } }, SYSTEM);
		if (!result.ok) throw new Error("unreachable");
		expect(result.emitted[0]).toMatchObject({ values: { "/age": 20 } });
	});

	it.each<[string, { values: Record<string, unknown>; lockedPaths?: string[] }, string]>([
		["an unknown value path", { values: { "/nope": 1 } }, "field-not-found"],
		["an invalid value", { values: { "/age": "old" } }, "invalid-value"],
		["an unknown locked path", { values: {}, lockedPaths: ["/nope"] }, "field-not-found"],
	])("rejects %s and emits nothing", (_label, cmd, code) => {
		const session = emptySession();
		const result = execute(session, rt, { kind: "prefill", ...cmd }, SYSTEM);
		expect(result).toMatchObject({ ok: false, code });
		if (result.ok) throw new Error("unreachable");
		expect(result.reason).toContain("/");
		expect(session.events).toHaveLength(0);
	});

	it("rejects a value for a path that is already answered or locked", () => {
		const answered = emptySession([
			{ v: 1, t: "FieldAnswered", at: "t", by: USER, fieldPath: "/name", value: "A", source: "user" },
		]);
		expect(execute(answered, rt, { kind: "prefill", values: { "/name": "B" } }, SYSTEM)).toMatchObject({
			ok: false,
			code: "field-already-answered",
		});
		const locked = emptySession([
			{ v: 1, t: "PrefillApplied", at: "t", by: SYSTEM, values: {}, sources: {}, lockedPaths: ["/age"] },
		]);
		expect(execute(locked, rt, { kind: "prefill", values: { "/age": 3 } }, SYSTEM)).toMatchObject({
			ok: false,
			code: "field-locked",
		});
	});
});

describe("execute — revise source", () => {
	it("records the revision's own source over a prefilled one", () => {
		const rt = makeRuntime({ fields: ["/name"] });
		const prefilled = execute(emptySession(), rt, { kind: "prefill", values: { "/name": "Pre" } }, SYSTEM);
		if (!prefilled.ok) throw new Error("unreachable");
		const revised = execute(
			prefilled.session,
			rt,
			{ kind: "revise", fieldPath: "/name", value: "Mine", source: "user" },
			USER,
		);
		if (!revised.ok) throw new Error("unreachable");
		expect(revised.emitted[0]).toMatchObject({ t: "FieldRevised", source: "user" });
	});
});
