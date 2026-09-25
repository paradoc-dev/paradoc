import { describe, it, expect } from "vitest";
import {
	createSubmitFieldValueAction,
} from "../src/actions.js";
import type {
	SubmitFieldValueAction,
} from "../src/actions.js";

describe("actions", () => {
	it("typechecks SubmitFieldValueAction shape", () => {
		const a: SubmitFieldValueAction = {
			type: "submitFieldValue",
			fieldPath: "/pet/species",
			value: "cat",
		};
		expect(a.type).toBe("submitFieldValue");
		expect(a.fieldPath).toBe("/pet/species");
		expect(a.value).toBe("cat");
	});

	it("rejects unbound and template submissions at the action boundary", () => {
		expect(() => createSubmitFieldValueAction(undefined, "x")).toThrow(/unbound/);
		expect(() => createSubmitFieldValueAction("items[]", "x")).toThrow(/template/);
		expect(createSubmitFieldValueAction("items[2].name", "Ada")).toEqual({
			type: "submitFieldValue",
			fieldPath: "items[2].name",
			value: "Ada",
		});
	});
});
