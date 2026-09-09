import { describe, it, expect } from "vitest";
import {
	CATALOG,
	CATALOG_COMPONENT_NAMES,
	validateProps,
} from "../src/catalog.js";

describe("catalog", () => {
	it("exposes all 22 component names", () => {
		expect(CATALOG_COMPONENT_NAMES.length).toBe(24);
	});

	it("includes the expected primitives", () => {
		const expected = [
			"TextInput",
			"TextArea",
			"NumberInput",
			"MoneyInput",
			"PercentageInput",
			"CoordinateInput",
			"BboxInput",
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
			"List",
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

		it("preserves a complete canonical address default", () => {
			const address = {
				line1: "123 Main St",
				line2: "Suite 4",
				locality: "Springfield",
				region: "IL",
				postalCode: "62701",
				country: "US",
			};
			const parsed = validateProps("AddressForm", {
				label: "Home address",
				default: address,
			});
			expect(parsed.default).toEqual(address);
			expect(JSON.parse(JSON.stringify(parsed.default))).toEqual(address);
		});

		it("preserves the canonical Money default used as a control", () => {
			const money = { amount: 99.99, currency: "USD" };
			const parsed = validateProps("MoneyInput", { default: money });
			expect(parsed.default).toEqual(money);
			expect(JSON.parse(JSON.stringify(parsed.default))).toEqual(money);
		});

		it("distinguishes an absent optional line2 from an explicitly empty one", () => {
			const required = {
				line1: "123 Main St",
				locality: "Springfield",
				region: "IL",
				postalCode: "62701",
				country: "US",
			};
			const absent = JSON.parse(
				JSON.stringify(
					validateProps("AddressForm", { default: required }).default,
				),
			) as Record<string, unknown>;
			const empty = JSON.parse(
				JSON.stringify(
					validateProps("AddressForm", {
						default: { ...required, line2: "" },
					}).default,
				),
			) as Record<string, unknown>;
			expect(absent).not.toHaveProperty("line2");
			expect(empty).toHaveProperty("line2", "");
		});

		it("rejects incomplete or aliased address defaults", () => {
			expect(() =>
				validateProps("AddressForm", {
					default: { line1: "123 Main St", city: "Springfield" },
				}),
			).toThrow();
			expect(() =>
				validateProps("AddressForm", {
					default: {
						line1: "123 Main St",
						line2: "x".repeat(201),
						locality: "Springfield",
						region: "IL",
						postalCode: "62701",
						country: "US",
					},
				}),
			).toThrow();
		});

		it("preserves canonical duration strings and rejects object defaults", () => {
			for (const duration of ["P2W", "PT1.25S"]) {
				const parsed = validateProps("DurationInput", { default: duration });
				expect(parsed.default).toBe(duration);
				expect(JSON.parse(JSON.stringify(parsed))).toEqual({
					default: duration,
				});
			}
			expect(() =>
				validateProps("DurationInput", { default: { days: 2 } }),
			).toThrow();
		});

		it("preserves the complete canonical value family", () => {
			const values = {
				PersonForm: {
					name: "Dr. Jane Smith Jr.",
					title: "Dr.",
					firstName: "Jane",
					middleName: "Q",
					lastName: "Smith",
					suffix: "Jr.",
				},
				OrganizationForm: {
					name: "Acme",
					legalName: "Acme Corporation Inc.",
					domicile: "US",
					entityType: "corporation",
					entityId: "ACME-123",
					taxId: "12-3456789",
				},
				PhoneInput: {
					number: "+14155552671",
					type: "mobile",
					extension: "42",
				},
				IdentificationInput: {
					type: "passport",
					number: "AB1234567",
					issuer: "US",
					issueDate: "2020-01-15",
					expiryDate: "2030-01-14",
				},
			};

			for (const [component, value] of Object.entries(values)) {
				const parsed = validateProps(component as keyof typeof CATALOG, {
					default: value,
				});
				const parsedDefault = (parsed as { default?: unknown }).default;
				expect(parsedDefault).toEqual(value);
				expect(JSON.parse(JSON.stringify(parsedDefault))).toEqual(value);
			}
		});

		it("preserves minimal valid values for the canonical value family", () => {
			const values = {
				PersonForm: { name: "Jane Doe" },
				OrganizationForm: { name: "Acme" },
				PhoneInput: { number: "+14155552671" },
				IdentificationInput: { type: "passport", number: "AB1234567" },
			};

			for (const [component, value] of Object.entries(values)) {
				const parsed = validateProps(component as keyof typeof CATALOG, {
					default: value,
				});
				const parsedDefault = (parsed as { default?: unknown }).default;
				expect(JSON.parse(JSON.stringify(parsedDefault))).toEqual(value);
			}
		});

		it("rejects malformed canonical defaults", () => {
			expect(() =>
				validateProps("PersonForm", { default: { firstName: "Only" } }),
			).toThrow();
			expect(() =>
				validateProps("PhoneInput", { default: { number: "555-1212" } }),
			).toThrow();
			expect(() =>
				validateProps("IdentificationInput", { default: { type: "passport" } }),
			).toThrow();
			expect(() =>
				validateProps("PhoneInput", {
					default: { number: "+14155552671", countryCode: "+1" },
				}),
			).toThrow();
		});

		it("keeps text constraints on TextArea props", () => {
			const parsed = validateProps("TextArea", {
				minLength: 2,
				maxLength: 500,
				pattern: "^[A-Z]",
			});
			expect(parsed).toMatchObject({
				minLength: 2,
				maxLength: 500,
				pattern: "^[A-Z]",
			});
		});

		it("accepts bounded List props", () => {
			const parsed = validateProps("List", {
				label: "Line items",
				minItems: 1,
				maxItems: 20,
			});
			expect(parsed.minItems).toBe(1);
			expect(parsed.maxItems).toBe(20);
		});

		it("rejects unknown component props", () => {
			expect(() =>
				validateProps("TextInput", {
					label: "Name",
					bogusFutureProp: 123,
				} as Parameters<typeof validateProps>[1]),
			).toThrow(/bogusFutureProp/);
		});
	});
});
