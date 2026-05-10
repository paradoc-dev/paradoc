import { describe, it, expect } from "vitest";
import { CATALOG_ACTION_TYPES } from "../src/actions.js";
import type {
	CatalogAction,
	SubmitFieldValueAction,
	CancelFieldAction,
	EditFilledFieldAction,
} from "../src/actions.js";

describe("actions", () => {
	it("exposes the three action types", () => {
		expect(CATALOG_ACTION_TYPES).toEqual([
			"submitFieldValue",
			"cancelField",
			"editFilledField",
		]);
	});

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

	it("typechecks CancelFieldAction shape", () => {
		const a: CancelFieldAction = {
			type: "cancelField",
			fieldPath: "/foo",
		};
		expect(a.type).toBe("cancelField");
	});

	it("typechecks EditFilledFieldAction shape", () => {
		const a: EditFilledFieldAction = {
			type: "editFilledField",
			fieldPath: "/foo",
		};
		expect(a.type).toBe("editFilledField");
	});

	it("CatalogAction discriminated union narrows by type", () => {
		const action: CatalogAction = {
			type: "submitFieldValue",
			fieldPath: "/x",
			value: 42,
		};

		if (action.type === "submitFieldValue") {
			// TS should infer `value: unknown` here, narrowed to SubmitFieldValueAction
			expect(action.value).toBe(42);
		} else {
			throw new Error("expected submitFieldValue branch");
		}
	});
});
