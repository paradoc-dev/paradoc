import { describe, expect, it } from "vitest";
import { project } from "./projector";
import type { Actor, SessionEvent } from "./types";

const USER: Actor = { kind: "user" };
const AGENT: Actor = { kind: "agent", model: "test-model" };
const SYSTEM: Actor = { kind: "system", reason: "test" };

const AT = (i: number) => `2026-01-01T00:00:${String(i).padStart(2, "0")}.000Z`;

describe("project — empty log", () => {
	it("returns a fresh projection", () => {
		const p = project([]);
		expect(p.answers).toEqual({});
		expect(p.deferred.size).toBe(0);
		expect(p.skipped.size).toBe(0);
		expect(p.presentation).toEqual([]);
		expect(p.status).toBe("active");
		expect(p.eventCount).toBe(0);
		expect(p.currentTurn).toBe(0);
		expect(p.lockedPaths.size).toBe(0);
		expect(p.lastValidation).toBeUndefined();
	});
});

describe("project — eventCount", () => {
	it("counts every event applied", () => {
		const events: SessionEvent[] = [
			{ v: 1, t: "SessionStarted", at: AT(0), by: SYSTEM, artifact: "x" },
			{
				v: 1,
				t: "FieldAnswered",
				at: AT(1),
				by: USER,
				fieldPath: "/a",
				value: 1,
				source: "user",
			},
		];
		expect(project(events).eventCount).toBe(2);
	});
});

describe("project — SessionStarted", () => {
	it("has no projection effect beyond eventCount", () => {
		const p = project([
			{ v: 1, t: "SessionStarted", at: AT(0), by: SYSTEM, artifact: "x" },
		]);
		expect(p.status).toBe("active");
		expect(p.answers).toEqual({});
	});
});

describe("project — PrefillApplied", () => {
	it("populates answers and locks paths", () => {
		const p = project([
			{
				v: 1,
				t: "PrefillApplied",
				at: AT(0),
				by: SYSTEM,
				values: { "/a": 1, "/b": "x" },
				sources: { "/a": "prefill", "/b": "default" },
				lockedPaths: ["/a"],
			},
		]);
		expect(p.answers["/a"]).toMatchObject({
			value: 1,
			source: "prefill",
			revisions: 0,
		});
		expect(p.answers["/b"]).toMatchObject({
			value: "x",
			source: "default",
			revisions: 0,
		});
		expect(p.lockedPaths.has("/a")).toBe(true);
		expect(p.lockedPaths.has("/b")).toBe(false);
	});

	it("defaults source to 'prefill' when not specified per-path", () => {
		const p = project([
			{
				v: 1,
				t: "PrefillApplied",
				at: AT(0),
				by: SYSTEM,
				values: { "/a": 1 },
				sources: {},
				lockedPaths: [],
			},
		]);
		expect(p.answers["/a"]?.source).toBe("prefill");
	});
});

describe("project — FieldAnswered", () => {
	it("records value, source, timestamp, and zero revisions on first answer", () => {
		const p = project([
			{
				v: 1,
				t: "FieldAnswered",
				at: AT(1),
				by: USER,
				fieldPath: "/name",
				value: "Toby",
				source: "user",
			},
		]);
		expect(p.answers["/name"]).toEqual({
			value: "Toby",
			source: "user",
			at: AT(1),
			revisions: 0,
		});
	});

	it("increments revisions when answering an already-answered field", () => {
		const p = project([
			{
				v: 1,
				t: "FieldAnswered",
				at: AT(1),
				by: USER,
				fieldPath: "/name",
				value: "Toby",
				source: "user",
			},
			{
				v: 1,
				t: "FieldAnswered",
				at: AT(2),
				by: USER,
				fieldPath: "/name",
				value: "Rex",
				source: "user",
			},
		]);
		expect(p.answers["/name"]?.value).toBe("Rex");
		expect(p.answers["/name"]?.revisions).toBe(1);
	});

	it("clears defer mark on the same field", () => {
		const p = project([
			{
				v: 1,
				t: "FieldDeferred",
				at: AT(1),
				by: USER,
				fieldPath: "/name",
			},
			{
				v: 1,
				t: "FieldAnswered",
				at: AT(2),
				by: USER,
				fieldPath: "/name",
				value: "Toby",
				source: "user",
			},
		]);
		expect(p.deferred.has("/name")).toBe(false);
		expect(p.answers["/name"]?.value).toBe("Toby");
	});

	it("clears skip mark on the same field", () => {
		const p = project([
			{
				v: 1,
				t: "FieldSkipped",
				at: AT(1),
				by: USER,
				fieldPath: "/color",
			},
			{
				v: 1,
				t: "FieldAnswered",
				at: AT(2),
				by: USER,
				fieldPath: "/color",
				value: "blue",
				source: "user",
			},
		]);
		expect(p.skipped.has("/color")).toBe(false);
		expect(p.answers["/color"]?.value).toBe("blue");
	});
});

describe("project — FieldRevised", () => {
	it("updates value and bumps revisions, preserving source from prior answer", () => {
		const p = project([
			{
				v: 1,
				t: "FieldAnswered",
				at: AT(1),
				by: USER,
				fieldPath: "/age",
				value: 20,
				source: "prefill",
			},
			{
				v: 1,
				t: "FieldRevised",
				at: AT(2),
				by: USER,
				fieldPath: "/age",
				previous: 20,
				value: 21,
			},
		]);
		expect(p.answers["/age"]?.value).toBe(21);
		expect(p.answers["/age"]?.source).toBe("prefill");
		expect(p.answers["/age"]?.revisions).toBe(1);
	});

	it("defaults source to 'user' when revising a path with no prior answer", () => {
		const p = project([
			{
				v: 1,
				t: "FieldRevised",
				at: AT(1),
				by: USER,
				fieldPath: "/x",
				previous: null,
				value: 1,
			},
		]);
		expect(p.answers["/x"]?.source).toBe("user");
		expect(p.answers["/x"]?.revisions).toBe(1);
	});
});

describe("project — FieldCleared", () => {
	it("removes the field from answers", () => {
		const p = project([
			{
				v: 1,
				t: "FieldAnswered",
				at: AT(1),
				by: USER,
				fieldPath: "/a",
				value: 1,
				source: "user",
			},
			{
				v: 1,
				t: "FieldCleared",
				at: AT(2),
				by: USER,
				fieldPath: "/a",
				previous: 1,
			},
		]);
		expect(p.answers["/a"]).toBeUndefined();
	});

	it("is a no-op on a path that was never answered", () => {
		const p = project([
			{
				v: 1,
				t: "FieldCleared",
				at: AT(1),
				by: USER,
				fieldPath: "/never",
				previous: null,
			},
		]);
		expect(p.answers["/never"]).toBeUndefined();
	});
});

describe("project — defer/undefer/skip/unskip", () => {
	it("adds and removes from the deferred set", () => {
		const p = project([
			{
				v: 1,
				t: "FieldDeferred",
				at: AT(1),
				by: USER,
				fieldPath: "/a",
			},
		]);
		expect(p.deferred.has("/a")).toBe(true);

		const p2 = project([
			{
				v: 1,
				t: "FieldDeferred",
				at: AT(1),
				by: USER,
				fieldPath: "/a",
			},
			{
				v: 1,
				t: "FieldUndeferred",
				at: AT(2),
				by: USER,
				fieldPath: "/a",
			},
		]);
		expect(p2.deferred.has("/a")).toBe(false);
	});

	it("adds and removes from the skipped set", () => {
		const p = project([
			{
				v: 1,
				t: "FieldSkipped",
				at: AT(1),
				by: USER,
				fieldPath: "/a",
			},
		]);
		expect(p.skipped.has("/a")).toBe(true);

		const p2 = project([
			{
				v: 1,
				t: "FieldSkipped",
				at: AT(1),
				by: USER,
				fieldPath: "/a",
			},
			{
				v: 1,
				t: "FieldUnskipped",
				at: AT(2),
				by: USER,
				fieldPath: "/a",
			},
		]);
		expect(p2.skipped.has("/a")).toBe(false);
	});

	it("a field can be deferred and then skipped (independent sets)", () => {
		// While in practice execute() will enforce only-one-at-a-time, the
		// projector remains agnostic — sets are independent.
		const p = project([
			{
				v: 1,
				t: "FieldDeferred",
				at: AT(1),
				by: USER,
				fieldPath: "/a",
			},
			{
				v: 1,
				t: "FieldSkipped",
				at: AT(2),
				by: USER,
				fieldPath: "/a",
			},
		]);
		expect(p.deferred.has("/a")).toBe(true);
		expect(p.skipped.has("/a")).toBe(true);
	});
});

describe("project — FieldPresented", () => {
	it("appends presentation records in event order", () => {
		const p = project([
			{
				v: 1,
				t: "FieldPresented",
				at: AT(1),
				by: AGENT,
				fieldPath: "/a",
				presentation: "rendered",
				turn: 1,
			},
			{
				v: 1,
				t: "FieldPresented",
				at: AT(2),
				by: AGENT,
				fieldPath: "/b",
				presentation: "text",
				turn: 2,
			},
		]);
		expect(p.presentation).toEqual([
			{ fieldPath: "/a", presentation: "rendered", turn: 1, at: AT(1) },
			{ fieldPath: "/b", presentation: "text", turn: 2, at: AT(2) },
		]);
	});

	it("tracks currentTurn as the max turn seen", () => {
		const p = project([
			{
				v: 1,
				t: "FieldPresented",
				at: AT(1),
				by: AGENT,
				fieldPath: "/a",
				presentation: "rendered",
				turn: 3,
			},
			{
				v: 1,
				t: "FieldPresented",
				at: AT(2),
				by: AGENT,
				fieldPath: "/b",
				presentation: "rendered",
				turn: 2,
			},
		]);
		expect(p.currentTurn).toBe(3);
	});
});

describe("project — ValidationRan", () => {
	it("records the latest validation result", () => {
		const p = project([
			{
				v: 1,
				t: "ValidationRan",
				at: AT(1),
				valid: false,
				errors: [{ message: "bad" }],
			},
			{
				v: 1,
				t: "ValidationRan",
				at: AT(2),
				valid: true,
				errors: [],
			},
		]);
		expect(p.lastValidation).toEqual({ valid: true, errors: [], at: AT(2) });
	});
});

describe("project — lifecycle transitions", () => {
	it("DocumentRendered moves status to 'rendered'", () => {
		const p = project([
			{
				v: 1,
				t: "DocumentRendered",
				at: AT(1),
				renderRef: "blob://abc",
			},
		]);
		expect(p.status).toBe("rendered");
	});

	it("SessionAbandoned moves status to 'abandoned'", () => {
		const p = project([
			{
				v: 1,
				t: "SessionAbandoned",
				at: AT(1),
				by: USER,
			},
		]);
		expect(p.status).toBe("abandoned");
	});
});

describe("project — full scripted session", () => {
	it("end-to-end fold yields the expected final projection", () => {
		const events: SessionEvent[] = [
			{ v: 1, t: "SessionStarted", at: AT(0), by: SYSTEM, artifact: "pet" },
			{
				v: 1,
				t: "PrefillApplied",
				at: AT(1),
				by: SYSTEM,
				values: { "/owner": "Alice" },
				sources: { "/owner": "prefill" },
				lockedPaths: ["/owner"],
			},
			{
				v: 1,
				t: "FieldPresented",
				at: AT(2),
				by: AGENT,
				fieldPath: "/species",
				presentation: "rendered",
				turn: 1,
			},
			{
				v: 1,
				t: "FieldAnswered",
				at: AT(3),
				by: USER,
				fieldPath: "/species",
				value: "dog",
				source: "user",
			},
			{
				v: 1,
				t: "FieldPresented",
				at: AT(4),
				by: AGENT,
				fieldPath: "/weight",
				presentation: "rendered",
				turn: 2,
			},
			{
				v: 1,
				t: "FieldDeferred",
				at: AT(5),
				by: USER,
				fieldPath: "/weight",
			},
			{
				v: 1,
				t: "FieldPresented",
				at: AT(6),
				by: AGENT,
				fieldPath: "/color",
				presentation: "rendered",
				turn: 3,
			},
			{
				v: 1,
				t: "FieldSkipped",
				at: AT(7),
				by: USER,
				fieldPath: "/color",
			},
			{
				v: 1,
				t: "FieldAnswered",
				at: AT(8),
				by: USER,
				fieldPath: "/weight",
				value: 42,
				source: "user",
			},
			{
				v: 1,
				t: "ValidationRan",
				at: AT(9),
				valid: true,
				errors: [],
			},
		];
		const p = project(events);
		expect(p.eventCount).toBe(10);
		expect(p.status).toBe("active");
		expect(p.answers["/owner"]?.value).toBe("Alice");
		expect(p.answers["/species"]?.value).toBe("dog");
		expect(p.answers["/weight"]?.value).toBe(42);
		expect(p.answers["/color"]).toBeUndefined();
		expect(p.deferred.has("/weight")).toBe(false); // answered → cleared
		expect(p.skipped.has("/color")).toBe(true);
		expect(p.lockedPaths.has("/owner")).toBe(true);
		expect(p.currentTurn).toBe(3);
		expect(p.presentation).toHaveLength(3);
		expect(p.lastValidation?.valid).toBe(true);
	});
});

describe("project — purity", () => {
	it("does not mutate the input events array", () => {
		const events: SessionEvent[] = [
			{
				v: 1,
				t: "FieldAnswered",
				at: AT(1),
				by: USER,
				fieldPath: "/a",
				value: 1,
				source: "user",
			},
		];
		const snapshot = JSON.parse(JSON.stringify(events));
		project(events);
		expect(events).toEqual(snapshot);
	});

	it("two projections from the same log are deeply equal", () => {
		const events: SessionEvent[] = [
			{ v: 1, t: "SessionStarted", at: AT(0), by: SYSTEM, artifact: "x" },
			{
				v: 1,
				t: "FieldAnswered",
				at: AT(1),
				by: USER,
				fieldPath: "/a",
				value: 1,
				source: "user",
			},
			{
				v: 1,
				t: "FieldDeferred",
				at: AT(2),
				by: USER,
				fieldPath: "/b",
			},
		];
		const a = project(events);
		const b = project(events);
		// Sets serialize differently; compare via Array.from.
		expect(a.answers).toEqual(b.answers);
		expect(Array.from(a.deferred)).toEqual(Array.from(b.deferred));
		expect(Array.from(a.skipped)).toEqual(Array.from(b.skipped));
		expect(a.presentation).toEqual(b.presentation);
		expect(a.status).toBe(b.status);
		expect(a.eventCount).toBe(b.eventCount);
	});
});
