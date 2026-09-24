import { CANONICAL_SHAPES } from "@paradoc/core";
import { describe, expect, it } from "vitest";
import { ADDRESS_ALIASES } from "./coerce";
import { createParadocRuntime } from "./paradoc-runtime";

const fields = {
	count: { type: "number" },
	agree: { type: "boolean" },
	dob: { type: "date" },
	at: { type: "datetime" },
	opens: { type: "time" },
	colors: { type: "multiselect", enum: [{ value: "red" }, { value: "blue" }] },
	fee: { type: "money", currency: "EUR" },
	open: { type: "money" },
	tel: { type: "phone" },
	who: { type: "person" },
	org: { type: "organization" },
	home: { type: "address" },
	id: { type: "identification" },
};

function runtime(options?: Parameters<typeof createParadocRuntime>[1]) {
	return createParadocRuntime(
		{
			$schema: "https://schema.paradoc.dev/2026-09-24.json",
			kind: "form",
			name: "coerce",
			version: "1.0.0",
			title: "Coerce",
			parties: {},
			fields,
			layers: { composition: { kind: "file", mimeType: "text/plain", path: "c.txt" } },
			defaultLayer: "composition",
		},
		options,
	);
}

const address = { line1: "1 Main St", locality: "Springfield", region: "IL", postalCode: "62701", country: "US" };

describe("validateField coercion: accepted", () => {
	it.each<[string, unknown, unknown]>([
		["count", "36", 36],
		["count", " -20.5 ", -20.5],
		["count", "1,234,567.25", 1234567.25],
		["agree", "Yes", true],
		["agree", "n", false],
		["agree", "0", false],
		["dob", " 2025-03-04 ", "2025-03-04"],
		["at", "2025-03-04T10:00:00Z", "2025-03-04T10:00:00Z"],
		["opens", " 09:30:00 ", "09:30:00"],
		["colors", '["red","blue"]', ["red", "blue"]],
		["fee", 25, { amount: 25, currency: "EUR" }],
		["fee", "1,250.50", { amount: 1250.5, currency: "EUR" }],
		["fee", "25 eur", { amount: 25, currency: "EUR" }],
		["open", "GBP 25", { amount: 25, currency: "GBP" }],
		["open", '{"amount":3,"currency":"JPY"}', { amount: 3, currency: "JPY" }],
		["tel", "+1 (415) 555-2671", { number: "+14155552671" }],
		["tel", { number: "+44 20 7946 0958", type: "work" }, { number: "+442079460958", type: "work" }],
		["who", "Ada Lovelace", { name: "Ada Lovelace" }],
		["org", "Acme Inc", { name: "Acme Inc" }],
		["home", { street: "1 Main St", city: "Springfield", state: "IL", zip: "62701", country: "US" }, address],
		["home", JSON.stringify(address), address],
	])("%s: %j -> %j", (path, input, expected) => {
		expect(runtime().validateField(path, input)).toEqual({ ok: true, value: expected });
	});

	it("puts the caller's default calling code before a number without one", () => {
		expect(runtime({ defaultCallingCode: "+91" }).validateField("tel", "98765 43210")).toEqual({
			ok: true,
			value: { number: "+919876543210" },
		});
	});
});

describe("validateField coercion: left for the validator to reject", () => {
	it.each<[string, unknown]>([
		["count", "a few"],
		["count", "1e5"],
		["count", "0x10"],
		["count", "1,5"],
		["count", ""],
		["agree", "maybe"],
		["dob", "5"],
		["dob", "March 4, 2025"],
		["dob", "03/04/2025"],
		["dob", "2025-03-04T23:00:00-05:00"],
		["opens", "9am"],
		["colors", "red, blue"],
		["open", 25],
		["open", "25"],
		["fee", "$25"],
		["fee", "25 USD"],
		["fee", "EUR 25 USD"],
		["tel", "9876543210"],
		["tel", "020 7946 0958"],
		["tel", "15551234567"],
		["id", "D1234567"],
		["home", "1 Main St, Springfield"],
	])("%s: %j is rejected", (path, input) => {
		expect(runtime().validateField(path, input)).toMatchObject({ ok: false });
	});

	it("does not put a default calling code before a national number with a trunk 0", () => {
		expect(runtime({ defaultCallingCode: "+44" }).validateField("tel", "020 7946 0958")).toMatchObject({
			ok: false,
		});
	});

	it("refuses a malformed default calling code when the runtime is built", () => {
		expect(() => runtime({ defaultCallingCode: "1" })).toThrow(/defaultCallingCode/);
		expect(() => runtime({ defaultCallingCode: "+0" })).toThrow(/defaultCallingCode/);
	});
});

describe("address aliases", () => {
	it("map only onto members of core's address shape", () => {
		const shape = CANONICAL_SHAPES.address;
		const members = new Set([...shape.required, ...shape.optional].map((m) => m.name));
		for (const member of Object.values(ADDRESS_ALIASES)) expect(members).toContain(member);
	});

	it("keep a member the input already gives", () => {
		expect(runtime().validateField("home", { ...address, city: "Shelbyville" })).toMatchObject({ ok: false });
	});
});
