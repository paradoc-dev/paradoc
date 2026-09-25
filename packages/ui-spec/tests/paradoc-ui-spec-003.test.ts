import { describe, expect, it } from "vitest";
import { validateSpec } from "../src/spec.js";

describe("paradoc-ui-spec-003: child paths derive from parent paths", () => {
	it.each([
		{ type: "List", props: {}, fieldPath: "items", children: [{ type: "TextInput", props: {}, fieldPath: "other[].x" }] },
		{ type: "List", props: {}, fieldPath: "items", children: [{ type: "TextInput", props: {} }] },
		{ type: "Fieldset", props: {}, fieldPath: "a", children: [{ type: "TextInput", props: {}, fieldPath: "a.b[]" }] },
		{ type: "Fieldset", props: {}, fieldPath: "a", children: [{ type: "TextInput", props: {}, fieldPath: "zzz" }] },
		{ type: "Fieldset", props: {}, fieldPath: "a", children: [{ type: "TextInput", props: {} }] },
	])("rejects a mismatched $type child", (node) => {
		expect(() => validateSpec(node)).toThrow();
	});

	it("rejects wildcard paths", () => {
		expect(() => validateSpec({ type: "TextInput", props: {}, fieldPath: "items.*.name" })).toThrow(/invalid character/);
	});
});
