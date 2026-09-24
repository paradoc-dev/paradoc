/**
 * Commands, views, and the payload against the real @paradoc/core runtime.
 *
 * The fakes in `execute.test.ts` and `derive.test.ts` hold the engine's own
 * rules. These hold what only core decides: the index a party role accepts,
 * which items are open, and whether the payload the session builds is one core
 * resolves.
 */

import { describe, expect, it } from "vitest";
import { project } from "../event-log/projector";
import type { Actor } from "../event-log/types";
import { deriveView } from "./derive";
import { execute } from "./execute";
import { createParadocRuntime } from "./paradoc-runtime";
import { sessionPayload } from "./payload";
import type { ArtifactRuntime, Command, FormSession } from "./types";

const USER: Actor = { kind: "user" };

function artifact(extra: Record<string, unknown>): Record<string, unknown> {
	return {
		$schema: "https://schema.paradoc.dev/2026-09-24.json",
		kind: "form",
		name: "session-runtime",
		version: "1.0.0",
		title: "Session runtime",
		parties: {},
		fields: {},
		layers: { composition: { kind: "file", mimeType: "text/plain", path: "s.txt" } },
		defaultLayer: "composition",
		...extra,
	};
}

function emptySession(): FormSession {
	return {
		formSessionId: "fs",
		chatId: "c",
		artifactRef: { name: "session-runtime" },
		events: [],
		createdAt: "2026-01-01T00:00:00.000Z",
	};
}

/** Run commands in order; every one must succeed. */
function run(runtime: ArtifactRuntime, commands: Command[]): FormSession {
	let session = emptySession();
	for (const command of commands) {
		const result = execute(session, runtime, command, USER);
		if (!result.ok) throw new Error(`${command.kind}: ${result.code} ${result.reason}`);
		session = result.session;
	}
	return session;
}

const party = (roleId: string, name: string, index?: number): Command => ({
	kind: "answerParty",
	roleId,
	...(index !== undefined ? { index } : {}),
	value: { name },
	source: "user",
});

describe("answerParty", () => {
	const runtime = createParadocRuntime(
		artifact({
			parties: {
				signer: { label: "Signer", partyType: "person" },
				witness: { label: "Witness", partyType: "person", min: 0, max: 3, required: false },
			},
			fields: { name: { type: "text", required: true } },
		}),
	);

	it("answers a single role and sends it as one party", () => {
		const session = run(runtime, [party("signer", "Ada")]);
		const view = deriveView(session, runtime);
		expect(view.phase).toBe("collecting-required");
		expect(view.next?.fieldPath).toBe("name");
		expect(view.partyIndex.find((p) => p.roleId === "signer")).toMatchObject({
			status: "answered",
			max: 1,
			filled: 1,
		});
		expect(sessionPayload(view.projected, runtime).parties).toEqual({
			signer: { id: "signer-0", name: "Ada" },
		});
	});

	it("answers a repeatable role at index 0 and 1 and sends it as an array", () => {
		const session = run(runtime, [
			party("signer", "Ada"),
			party("witness", "W0", 0),
			party("witness", "W1", 1),
			{ kind: "answer", fieldPath: "name", value: "Form", source: "user" },
		]);
		const view = deriveView(session, runtime);
		expect(view.phase).toBe("ready");
		expect(view.partyIndex.find((p) => p.roleId === "witness")).toMatchObject({ max: 3, filled: 2 });
		expect(sessionPayload(view.projected, runtime).parties).toEqual({
			signer: { id: "signer-0", name: "Ada" },
			witness: [
				{ id: "witness-0", name: "W0" },
				{ id: "witness-1", name: "W1" },
			],
		});
	});

	it("replaces a party answered again at the same index", () => {
		const session = run(runtime, [party("witness", "W0", 0), party("witness", "Wx", 0)]);
		const view = deriveView(session, runtime);
		expect(view.phase).not.toBe("unresolved");
		expect(sessionPayload(view.projected, runtime).parties).toEqual({
			witness: [{ id: "witness-0", name: "Wx" }],
		});
	});

	it("rejects an index past the role's max", () => {
		const result = execute(emptySession(), runtime, party("witness", "W3", 3), USER);
		expect(result).toMatchObject({ ok: false, code: "invalid-value" });
		if (!result.ok) expect(result.reason).toContain("at most 3");
	});

	it("rejects an index other than 0 on a single role", () => {
		const result = execute(emptySession(), runtime, party("signer", "Ada", 1), USER);
		expect(result).toMatchObject({ ok: false, code: "invalid-value" });
	});

	it("rejects an index that leaves a gap", () => {
		const result = execute(emptySession(), runtime, party("witness", "W1", 1), USER);
		expect(result).toMatchObject({ ok: false, code: "party-index-out-of-order" });
	});

	it("rejects an unknown role", () => {
		const result = execute(emptySession(), runtime, party("notary", "N"), USER);
		expect(result).toMatchObject({ ok: false, code: "party-not-found" });
	});

	it("rejects a value that is not a party", () => {
		const result = execute(
			emptySession(),
			runtime,
			{ kind: "answerParty", roleId: "signer", value: "Ada", source: "user" },
			USER,
		);
		expect(result).toMatchObject({ ok: false, code: "invalid-value" });
	});
});

describe("annexes", () => {
	const runtime = createParadocRuntime(
		artifact({
			fields: { name: { type: "text", required: true } },
			annexes: {
				proof: { title: "Proof of address", required: true },
				extra: { title: "Supporting document" },
			},
		}),
	);
	const proof = { name: "proof.pdf", mimeType: "application/pdf" };

	it("keeps the session out of ready while a required annex is open", () => {
		const session = run(runtime, [{ kind: "answer", fieldPath: "name", value: "Ada", source: "user" }]);
		const view = deriveView(session, runtime);
		expect(view.phase).toBe("collecting-required");
		expect(view.next).toBeNull();
		expect(view.nextAnnex).toEqual({ annexId: "proof", label: "Proof of address" });
		expect(view.pendingAnnexes).toEqual([{ annexId: "proof", label: "Proof of address" }]);
		expect(view.annexIndex).toEqual([
			{ annexId: "proof", label: "Proof of address", status: "pending" },
			{ annexId: "extra", label: "Supporting document", status: "pending" },
		]);
	});

	it("is ready once the annex is attached, and carries it in the payload", () => {
		const session = run(runtime, [
			{ kind: "answer", fieldPath: "name", value: "Ada", source: "user" },
			{ kind: "answerAnnex", annexId: "proof", value: proof, source: "user" },
		]);
		const view = deriveView(session, runtime);
		expect(view.phase).toBe("ready");
		expect(view.annexIndex[0]).toMatchObject({ annexId: "proof", status: "answered" });
		expect(sessionPayload(view.projected, runtime)).toEqual({
			fields: { name: "Ada" },
			parties: {},
			annexes: { proof },
		});
	});

	it("reopens the annex when it is cleared", () => {
		const session = run(runtime, [
			{ kind: "answer", fieldPath: "name", value: "Ada", source: "user" },
			{ kind: "answerAnnex", annexId: "proof", value: proof, source: "user" },
			{ kind: "clearAnnex", annexId: "proof" },
		]);
		const view = deriveView(session, runtime);
		expect(view.nextAnnex?.annexId).toBe("proof");
		expect(sessionPayload(view.projected, runtime).annexes).toEqual({});
	});

	it("rejects an unknown annex, a value that is not an attachment, and clearing an empty slot", () => {
		const session = emptySession();
		expect(
			execute(session, runtime, { kind: "answerAnnex", annexId: "nope", value: proof, source: "user" }, USER),
		).toMatchObject({ ok: false, code: "annex-not-found" });
		expect(
			execute(session, runtime, { kind: "answerAnnex", annexId: "proof", value: { name: "x" }, source: "user" }, USER),
		).toMatchObject({ ok: false, code: "invalid-value" });
		expect(execute(session, runtime, { kind: "clearAnnex", annexId: "proof" }, USER)).toMatchObject({
			ok: false,
			code: "annex-not-answered",
		});
	});
});

describe("progress", () => {
	const runtime = createParadocRuntime(
		artifact({
			fields: {
				name: { type: "text", required: true },
				note: { type: "text" },
				dob: { type: "date" },
			},
		}),
	);

	it("counts an answered optional field as optional", () => {
		const session = run(runtime, [{ kind: "answer", fieldPath: "note", value: "hi", source: "user" }]);
		expect(deriveView(session, runtime).progress).toMatchObject({
			answered: 1,
			requiredTotal: 1,
			requiredRemaining: 1,
			optionalTotal: 2,
			optionalRemaining: 1,
		});
	});

	it("counts an answered required field as required", () => {
		const session = run(runtime, [{ kind: "answer", fieldPath: "name", value: "Ada", source: "user" }]);
		expect(deriveView(session, runtime).progress).toMatchObject({
			requiredTotal: 1,
			requiredRemaining: 0,
			optionalTotal: 2,
		});
	});
});

describe("fields", () => {
	const runtime = createParadocRuntime(
		artifact({
			fields: {
				age: { type: "number", required: true },
				items: {
					type: "list",
					item: { type: "fieldset", fields: { name: { type: "text" } } },
				},
				tags: { type: "list", item: { type: "text" } },
			},
		}),
	);

	it("lists list item paths as hasField accepts them", () => {
		expect(runtime.listFields().map((f) => f.fieldPath)).toEqual([
			"age",
			"items",
			"items[].name",
			"tags",
			"tags[]",
		]);
		expect(runtime.hasField("items[0].name")).toBe(true);
		expect(runtime.hasField("items[0].nope")).toBe(false);
	});

	it("gives a list item path the status of its rows", () => {
		const session = run(runtime, [
			{ kind: "answer", fieldPath: "items", value: [{}], source: "user" },
			{ kind: "answer", fieldPath: "items[0].name", value: "Ada", source: "user" },
		]);
		const entry = deriveView(session, runtime).fieldIndex.find((f) => f.fieldPath === "items[].name");
		expect(entry?.status).toBe("answered");
	});

	it("stores the value core validated", () => {
		const session = run(runtime, [{ kind: "answer", fieldPath: "age", value: "20", source: "user" }]);
		expect(project(session.events).answers.age?.value).toBe(20);
	});
});
