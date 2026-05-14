import { describe, it, expect } from "vitest";
import { CATALOG_ACTION_TYPES } from "../src/actions.js";
import type {
	CatalogAction,
	SubmitFieldValueAction,
	DeferFieldAction,
	SkipFieldAction,
	DismissFieldAction,
	EditFilledFieldAction,
} from "../src/actions.js";

describe("actions", () => {
	it("exposes the five action types", () => {
		expect(CATALOG_ACTION_TYPES).toEqual([
			"submitFieldValue",
			"deferField",
			"skipField",
			"dismissField",
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

	it("typechecks DeferFieldAction shape", () => {
		const a: DeferFieldAction = {
			type: "deferField",
			fieldPath: "/foo",
			note: "later",
		};
		expect(a.type).toBe("deferField");
		expect(a.note).toBe("later");
	});

	it("typechecks SkipFieldAction shape", () => {
		const a: SkipFieldAction = {
			type: "skipField",
			fieldPath: "/foo",
		};
		expect(a.type).toBe("skipField");
	});

	it("typechecks DismissFieldAction shape", () => {
		const a: DismissFieldAction = {
			type: "dismissField",
			fieldPath: "/foo",
		};
		expect(a.type).toBe("dismissField");
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
			expect(action.value).toBe(42);
		} else {
			throw new Error("expected submitFieldValue branch");
		}
	});
});
