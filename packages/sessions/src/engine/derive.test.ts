import { describe, expect, it } from "vitest";
import type { Actor, SessionEvent } from "../event-log/types";
import { deriveView } from "./derive";
import type { ArtifactRuntime, FormSession } from "./types";

const USER: Actor = { kind: "user" };

function emptySession(events: SessionEvent[] = []): FormSession {
	return {
		formSessionId: "fs-1",
		chatId: "chat-1",
		artifactRef: { name: "test-form" },
		events,
		createdAt: "2026-01-01T00:00:00.000Z",
	};
}

function makeRuntime(opts: {
	fields: string[];
	required?: (fp: string, answers: Record<string, unknown>) => boolean;
	visible?: (fp: string, answers: Record<string, unknown>) => boolean;
}): ArtifactRuntime {
	const isRequired = opts.required ?? (() => true);
	const isVisible = opts.visible ?? (() => true);
	return {
		hasField: (fp) => opts.fields.includes(fp),
		hasParty: () => false,
		getFillState: (answers) => {
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
		validateField: (_fp, v) => ({ ok: true, value: v }),
		validateParty: (_roleId, value) => ({ ok: true, value }),
		listFields: () =>
			opts.fields.map((fp) => ({
				fieldPath: fp,
				required: isRequired(fp, {}),
			})),
		listParties: () => [],
	};
}

describe("deriveView — phase transitions", () => {
	it("starts in collecting-required when required fields are open", () => {
		const session = emptySession();
		const rt = makeRuntime({
			fields: ["/name", "/color"],
			required: (fp) => fp === "/name",
		});
		const view = deriveView(session, rt);
		expect(view.phase).toBe("collecting-required");
		expect(view.next).toEqual({
			fieldPath: "/name",
			required: true,
			deferred: false,
		});
	});

	it("moves to collecting-optional when all required answered", () => {
		const session = emptySession([
			{
				v: 1,
				t: "FieldAnswered",
				at: "t0",
				by: USER,
				fieldPath: "/name",
				value: "Toby",
				source: "user",
			},
		]);
		const rt = makeRuntime({
			fields: ["/name", "/color"],
			required: (fp) => fp === "/name",
		});
		const view = deriveView(session, rt);
		expect(view.phase).toBe("collecting-optional");
		expect(view.next).toEqual({
			fieldPath: "/color",
			required: false,
			deferred: false,
		});
	});

	it("moves to revisit-deferred when required is empty but a field is deferred", () => {
		const session = emptySession([
			{ v: 1, t: "FieldDeferred", at: "t0", by: USER, fieldPath: "/name" },
		]);
		const rt = makeRuntime({
			fields: ["/name"],
			required: () => true,
		});
		const view = deriveView(session, rt);
		expect(view.phase).toBe("revisit-deferred");
		expect(view.next).toEqual({
			fieldPath: "/name",
			required: true,
			deferred: true,
		});
	});

	it("moves to ready when nothing remains", () => {
		const session = emptySession([
			{
				v: 1,
				t: "FieldAnswered",
				at: "t0",
				by: USER,
				fieldPath: "/name",
				value: "Toby",
				source: "user",
			},
			{ v: 1, t: "FieldSkipped", at: "t1", by: USER, fieldPath: "/color" },
		]);
		const rt = makeRuntime({
			fields: ["/name", "/color"],
			required: (fp) => fp === "/name",
		});
		const view = deriveView(session, rt);
		expect(view.phase).toBe("ready");
		expect(view.next).toBeNull();
	});

	it("shows rendered phase after DocumentRendered", () => {
		const session = emptySession([
			{ v: 1, t: "DocumentRendered", at: "t0", renderRef: "blob://x" },
		]);
		const rt = makeRuntime({ fields: ["/x"] });
		const view = deriveView(session, rt);
		expect(view.phase).toBe("rendered");
		expect(view.next).toBeNull();
	});

	it("shows abandoned phase after SessionAbandoned", () => {
		const session = emptySession([
			{ v: 1, t: "SessionAbandoned", at: "t0", by: USER },
		]);
		const rt = makeRuntime({ fields: ["/x"] });
		const view = deriveView(session, rt);
		expect(view.phase).toBe("abandoned");
		expect(view.next).toBeNull();
	});
});

describe("deriveView — conditional visible/required", () => {
	it("hides driverLicense when age < 18", () => {
		const events: SessionEvent[] = [
			{
				v: 1,
				t: "FieldAnswered",
				at: "t0",
				by: USER,
				fieldPath: "/age",
				value: 15,
				source: "user",
			},
		];
		const rt = makeRuntime({
			fields: ["/age", "/driverLicense"],
			visible: (fp, ans) => {
				if (fp === "/driverLicense") return (ans["/age"] as number) >= 18;
				return true;
			},
		});
		const view = deriveView(emptySession(events), rt);
		// /driverLicense is invisible at age 15 → never appears as next
		expect(view.next).toBeNull();
		expect(view.phase).toBe("ready");
	});

	it("reveals driverLicense when age >= 18", () => {
		const events: SessionEvent[] = [
			{
				v: 1,
				t: "FieldAnswered",
				at: "t0",
				by: USER,
				fieldPath: "/age",
				value: 25,
				source: "user",
			},
		];
		const rt = makeRuntime({
			fields: ["/age", "/driverLicense"],
			visible: (fp, ans) => {
				if (fp === "/driverLicense") return (ans["/age"] as number) >= 18;
				return true;
			},
		});
		const view = deriveView(emptySession(events), rt);
		expect(view.next?.fieldPath).toBe("/driverLicense");
		expect(view.phase).toBe("collecting-required");
	});

	it("gender becomes required only when age >= 18", () => {
		const events: SessionEvent[] = [
			{
				v: 1,
				t: "FieldAnswered",
				at: "t0",
				by: USER,
				fieldPath: "/age",
				value: 30,
				source: "user",
			},
		];
		const rt = makeRuntime({
			fields: ["/age", "/gender"],
			required: (fp, ans) => {
				if (fp === "/gender") return (ans["/age"] as number) >= 18;
				return true;
			},
		});
		const view = deriveView(emptySession(events), rt);
		expect(view.next?.fieldPath).toBe("/gender");
		expect(view.next?.required).toBe(true);
	});
});

describe("deriveView — progress accounting", () => {
	it("counts answered required vs answered optional", () => {
		const events: SessionEvent[] = [
			{
				v: 1,
				t: "FieldAnswered",
				at: "t0",
				by: USER,
				fieldPath: "/name",
				value: "Toby",
				source: "user",
			},
		];
		const rt = makeRuntime({
			fields: ["/name", "/age", "/color"],
			required: (fp) => fp === "/name" || fp === "/age",
		});
		const view = deriveView(emptySession(events), rt);
		expect(view.progress.answered).toBe(1);
		expect(view.progress.requiredTotal).toBe(2);
		expect(view.progress.requiredRemaining).toBe(1);
		expect(view.progress.optionalTotal).toBe(1);
		expect(view.progress.optionalRemaining).toBe(1);
	});

	it("reports deferred and skipped counts", () => {
		const events: SessionEvent[] = [
			{ v: 1, t: "FieldDeferred", at: "t0", by: USER, fieldPath: "/a" },
			{ v: 1, t: "FieldDeferred", at: "t1", by: USER, fieldPath: "/b" },
			{ v: 1, t: "FieldSkipped", at: "t2", by: USER, fieldPath: "/c" },
		];
		const rt = makeRuntime({
			fields: ["/a", "/b", "/c"],
			required: (fp) => fp === "/a" || fp === "/b",
		});
		const view = deriveView(emptySession(events), rt);
		expect(view.progress.deferredCount).toBe(2);
		expect(view.progress.skippedCount).toBe(1);
	});
});

describe("deriveView — purity", () => {
	it("is deterministic across calls", () => {
		const events: SessionEvent[] = [
			{
				v: 1,
				t: "FieldAnswered",
				at: "t0",
				by: USER,
				fieldPath: "/a",
				value: 1,
				source: "user",
			},
		];
		const rt = makeRuntime({ fields: ["/a", "/b"] });
		const v1 = deriveView(emptySession(events), rt);
		const v2 = deriveView(emptySession(events), rt);
		expect(v1.phase).toBe(v2.phase);
		expect(v1.next).toEqual(v2.next);
		expect(v1.progress).toEqual(v2.progress);
	});
});
