import { describe, expect, it } from "vitest";
import { FormFieldSchema } from "@paradoc/schemas";
import { validateSpec } from "../src/spec.js";

const cases: Array<[string, unknown, unknown]> = [
	["negative/fractional counts", { type: "text", minLength: -5, maxLength: 1.5 }, { type: "TextInput", props: { minLength: -5, maxLength: 1.5 } }],
	["non-ISO date default", { type: "date", default: "not a date" }, { type: "DateInput", props: { default: "not a date" } }],
	["enum default not in options", { type: "enum", enum: [{ label: "A", value: "a" }], default: "zzz" }, { type: "EnumPicker", props: { options: [{ label: "A", value: "a" }], default: "zzz" } }],
	["list minItems above maxItems", { type: "list", item: { type: "text" }, minItems: 5, maxItems: 1 }, { type: "List", props: { minItems: 5, maxItems: 1 }, children: [{ type: "TextInput", props: {} }] }],
];

describe("paradoc-ui-spec-002: catalog props use field constraints", () => {
	it.each(cases)("rejects %s", (_name, field, node) => {
		expect(FormFieldSchema.safeParse(field).success).toBe(false);
		expect(() => validateSpec(node)).toThrow();
	});

	it("keeps email and URI defaults as plain strings", () => {
		expect(FormFieldSchema.safeParse({ type: "email", default: "not-an-email" }).success).toBe(true);
		expect(FormFieldSchema.safeParse({ type: "uri", default: "nope nope" }).success).toBe(true);
	});
});
