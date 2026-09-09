/**
 * The projection from a session's log to an artifact payload.
 *
 * What a session records and what an artifact takes are two shapes, and this is
 * the only place that translates between them. A document rendered from a
 * half-filled session, a fill state core evaluates, and a draft handed to a
 * seal all read the same projection, so they cannot disagree about what has
 * been answered.
 */

import { describe, expect, it } from "vitest";
import type { ProjectedSession } from "../event-log/types";
import { payloadFields, payloadParties, sessionPayload, unflattenPaths } from "./payload";

/** A projection carrying exactly these answers and parties. */
function projected(
	answers: Record<string, unknown>,
	parties: Record<string, { roleId: string; index: number; party: unknown }> = {},
): ProjectedSession {
	const wrapped: ProjectedSession["answers"] = {};
	for (const [path, value] of Object.entries(answers)) {
		wrapped[path] = { value, source: "user", at: "1970-01-01T00:00:00.000Z", revisions: 0 };
	}
	const wrappedParties: ProjectedSession["parties"] = {};
	for (const [key, entry] of Object.entries(parties)) {
		wrappedParties[key] = { ...entry, source: "user", at: "1970-01-01T00:00:00.000Z" };
	}
	return {
		answers: wrapped,
		deferred: new Set(),
		skipped: new Set(),
		presentation: [],
		status: "active",
		eventCount: 0,
		currentTurn: 0,
		lockedPaths: new Set(),
		parties: wrappedParties,
	};
}

describe("unflattenPaths", () => {
	it("nests dotted paths", () => {
		expect(unflattenPaths({ "address.line1": "88 Wharf Road", "address.locality": "Oakland" })).toEqual({
			address: { line1: "88 Wharf Road", locality: "Oakland" },
		});
	});

	it("leaves an undotted path alone", () => {
		expect(unflattenPaths({ orderNumber: "PO-1" })).toEqual({ orderNumber: "PO-1" });
	});

	it("keeps a value that is itself an object or array whole", () => {
		const lineItems = [{ description: "Monitor", quantity: 2 }];
		expect(unflattenPaths({ lineItems, total: { amount: 1, currency: "USD" } })).toEqual({
			lineItems,
			total: { amount: 1, currency: "USD" },
		});
	});

	it("nests to any depth", () => {
		expect(unflattenPaths({ "a.b.c.d": 1 })).toEqual({ a: { b: { c: { d: 1 } } } });
	});

	it("rebuilds nested repeated paths as arrays", () => {
		expect(
			unflattenPaths({
				"items[1].contact.name": "Bea",
				"items[0].contact.name": "Ada",
				"items[0].active": false,
			}),
		).toEqual({
			items: [
				{ contact: { name: "Ada" }, active: false },
				{ contact: { name: "Bea" } },
			],
		});
	});

	it("copies a parent answer before overlaying an indexed child", () => {
		const parentAnswer = [{ members: [{}] }];
		expect(
			unflattenPaths({
				groups: parentAnswer,
				"groups[0].members[0].name": "Ada",
			}),
		).toEqual({
			groups: [{ members: [{ name: "Ada" }] }],
		});
		// The projection is derived data. Overlaying a later answer must not
		// rewrite the canonical parent value held by the event log.
		expect(parentAnswer).toEqual([{ members: [{}] }]);
	});
});

describe("payloadFields", () => {
	it("unwraps answers and nests them", () => {
		expect(payloadFields(projected({ orderNumber: "PO-1", "shipTo.locality": "Oakland" }))).toEqual({
			orderNumber: "PO-1",
			shipTo: { locality: "Oakland" },
		});
	});

	it("is valid part-way through a fill: an unanswered field is absent", () => {
		expect(payloadFields(projected({ orderNumber: "PO-1" }))).toEqual({ orderNumber: "PO-1" });
	});

	it("invents nothing for an empty session", () => {
		expect(payloadFields(projected({}))).toEqual({});
	});
});

describe("payloadParties", () => {
	it("keys a role filled once by the role alone", () => {
		const parties = payloadParties(
			projected({}, { "buyer#0": { roleId: "buyer", index: 0, party: { id: "buyer-0" } } }),
		);
		expect(parties).toEqual({ buyer: { id: "buyer-0" } });
	});

	it("gives a role filled more than once the array, in index order", () => {
		const parties = payloadParties(
			projected(
				{},
				{
					"witness#1": { roleId: "witness", index: 1, party: { id: "w-1" } },
					"witness#0": { roleId: "witness", index: 0, party: { id: "w-0" } },
				},
			),
		);
		expect(parties).toEqual({ witness: [{ id: "w-0" }, { id: "w-1" }] });
	});

	it("keeps roles apart", () => {
		const parties = payloadParties(
			projected(
				{},
				{
					"buyer#0": { roleId: "buyer", index: 0, party: { id: "b" } },
					"supplier#0": { roleId: "supplier", index: 0, party: { id: "s" } },
				},
			),
		);
		expect(parties).toEqual({ buyer: { id: "b" }, supplier: { id: "s" } });
	});
});

describe("sessionPayload", () => {
	it("is the two halves together", () => {
		const source = projected(
			{ orderNumber: "PO-1" },
			{ "buyer#0": { roleId: "buyer", index: 0, party: { id: "buyer-0" } } },
		);
		expect(sessionPayload(source)).toEqual({
			fields: { orderNumber: "PO-1" },
			parties: { buyer: { id: "buyer-0" } },
		});
	});
});
