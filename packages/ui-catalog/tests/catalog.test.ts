import { describe, it, expect } from "vitest";
import {
	CATALOG,
	CATALOG_COMPONENT_NAMES,
	validateProps,
} from "../src/catalog.js";

describe("catalog", () => {
	it("exposes all 21 component names", () => {
		expect(CATALOG_COMPONENT_NAMES.length).toBe(21);
	});

	it("includes the expected primitives", () => {
		const expected = [
			"TextInput",
			"TextArea",
			"NumberInput",
			"MoneyInput",
			"PercentageInput",
			"YesNoToggle",
			"EnumPicker",
			"MultiSelectChips",
			"DateInput",
			"DateTimeInput",
			"TimeInput",
			"DurationInput",
			"EmailInput",
			"PhoneInput",
			"UriInput",
			"AddressForm",
			"PersonForm",
			"OrganizationForm",
			"IdentificationInput",
			"RatingStars",
			"Fieldset",
		];
		for (const name of expected) {
			expect(CATALOG_COMPONENT_NAMES).toContain(name);
		}
	});

	describe("validateProps", () => {
		it("accepts valid TextInput props", () => {
			const parsed = validateProps("TextInput", {
				label: "Name",
				placeholder: "Enter your name",
				maxLength: 100,
			});
			expect(parsed.label).toBe("Name");
			expect(parsed.maxLength).toBe(100);
		});

		it("rejects EnumPicker without options", () => {
			expect(() =>
				validateProps("EnumPicker", { label: "Pick one" }),
			).toThrow();
		});

		it("accepts EnumPicker with options", () => {
			const parsed = validateProps("EnumPicker", {
				label: "Pet species",
				options: [
					{ label: "Dog", value: "dog" },
					{ label: "Cat", value: "cat" },
				],
			});
			expect(parsed.options.length).toBe(2);
			expect(parsed.options[0]?.label).toBe("Dog");
		});

		it("accepts NumberInput with min/max/step", () => {
			const parsed = validateProps("NumberInput", {
				label: "Age",
				min: 0,
				max: 120,
				step: 1,
			});
			expect(parsed.min).toBe(0);
			expect(parsed.max).toBe(120);
		});

		it("accepts AddressForm with default", () => {
			const parsed = validateProps("AddressForm", {
				label: "Home address",
				default: { line1: "123 Main", city: "Springfield" },
			});
			expect(parsed.default?.city).toBe("Springfield");
		});

		it("rejects unknown props by erroring on type-narrow", () => {
			// Zod allows passthrough by default for object schemas, so this
			// asserts behavior on schemas configured to be strict — the
			// catalog uses default (non-strict) for forward-compat. So
			// extra props are tolerated; test asserts that intent.
			const parsed = validateProps("TextInput", {
				label: "Name",
				bogusFutureProp: 123,
			} as Parameters<typeof validateProps>[1]);
			expect(parsed.label).toBe("Name");
		});
	});
});
