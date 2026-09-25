import { describe, expect, it } from "vitest";
import { fieldToSpec } from "../src/mapper.js";
import { validateSpec } from "../src/spec.js";

describe("paradoc-ui-spec-001: empty field paths are unbound", () => {
	it.each([
		{ type: "fieldset", fields: { name: { type: "text" } } },
		{ type: "list", item: { type: "text" } },
	])("maps and validates $type at the unbound root", (field) => {
		const spec = fieldToSpec(field as never, { fieldPath: "" });
		expect(spec.fieldPath).toBeUndefined();
		expect(() => validateSpec(spec)).not.toThrow();
	});
});
