import { describe, it, expect } from "vitest";
import type { FormField } from "@paradoc/types";
import { fieldToSpec } from "../src/mapper.js";

describe("fieldToSpec", () => {
	it("maps a text field to TextInput", () => {
		const field: FormField = {
			type: "text",
			label: "Full name",
			minLength: 1,
			maxLength: 100,
		};
		const spec = fieldToSpec(field, { fieldPath: "/name" });
		expect(spec.type).toBe("TextInput");
		expect(spec.props?.label).toBe("Full name");
		expect(spec.props?.minLength).toBe(1);
		expect(spec.props?.maxLength).toBe(100);
		expect(spec.fieldPath).toBe("/name");
	});

	it("maps a long text field (maxLength > 200) to TextArea", () => {
		const field: FormField = {
			type: "text",
			label: "Comments",
			maxLength: 1000,
		};
		const spec = fieldToSpec(field);
		expect(spec.type).toBe("TextArea");
	});

	it("maps a boolean field to YesNoToggle", () => {
		const field: FormField = {
			type: "boolean",
			label: "Accept terms",
			default: false,
		};
		const spec = fieldToSpec(field, { fieldPath: "/accept" });
		expect(spec.type).toBe("YesNoToggle");
		expect(spec.props?.default).toBe(false);
		expect(spec.fieldPath).toBe("/accept");
	});

	it("maps a number field to NumberInput with min/max", () => {
		const field: FormField = {
			type: "number",
			label: "Age",
			min: 18,
			max: 120,
			default: 21,
		};
		const spec = fieldToSpec(field);
		expect(spec.type).toBe("NumberInput");
		expect(spec.props?.min).toBe(18);
		expect(spec.props?.max).toBe(120);
		expect(spec.props?.default).toBe(21);
	});

	it("maps a money field to MoneyInput", () => {
		const field: FormField = {
			type: "money",
			label: "Salary",
			default: { amount: 50000, currency: "USD" },
		};
		const spec = fieldToSpec(field);
		expect(spec.type).toBe("MoneyInput");
		expect(spec.props?.default).toEqual({ amount: 50000, currency: "USD" });
	});

	it("maps a percentage field to PercentageInput", () => {
		const field: FormField = {
			type: "percentage",
			label: "Tax rate",
			min: 0,
			max: 100,
			precision: 2,
		};
		const spec = fieldToSpec(field);
		expect(spec.type).toBe("PercentageInput");
		expect(spec.props?.precision).toBe(2);
	});

	describe("enum", () => {
		it("renders ≤4 options as radio", () => {
			const field: FormField = {
				type: "enum",
				label: "Pet species",
				enum: ["dog", "cat", "fish"],
			};
			const spec = fieldToSpec(field, { fieldPath: "/pet/species" });
			expect(spec.type).toBe("EnumPicker");
			expect(spec.props?.display).toBe("radio");
			const options = spec.props?.options as Array<{ value: string; label: string }>;
			expect(options.length).toBe(3);
			expect(options[0]).toEqual({ label: "dog", value: "dog" });
		});

		it("renders >4 options as dropdown", () => {
			const field: FormField = {
				type: "enum",
				label: "State",
				enum: ["CA", "NY", "TX", "FL", "WA", "IL"],
			};
			const spec = fieldToSpec(field);
			expect(spec.props?.display).toBe("dropdown");
		});

		it("uses translateOption for labels when provided", () => {
			const field: FormField = {
				type: "enum",
				label: "Pet species",
				enum: ["dog", "cat", "fish"],
			};
			const spec = fieldToSpec(field, {
				language: "es",
				translateOption: (v) =>
					({ dog: "perro", cat: "gato", fish: "pez" })[v as string] ?? String(v),
			});
			const options = spec.props?.options as Array<{ value: string; label: string }>;
			expect(options[0]).toEqual({ label: "perro", value: "dog" });
			expect(options[1]).toEqual({ label: "gato", value: "cat" });
		});
	});

	it("maps a multiselect field to MultiSelectChips", () => {
		const field: FormField = {
			type: "multiselect",
			label: "Allergies",
			enum: ["peanut", "dairy", "gluten"],
			min: 0,
			max: 3,
		};
		const spec = fieldToSpec(field, { fieldPath: "/allergies" });
		expect(spec.type).toBe("MultiSelectChips");
		expect(spec.props?.min).toBe(0);
		expect(spec.props?.max).toBe(3);
	});

	it("maps a date field to DateInput", () => {
		const field: FormField = {
			type: "date",
			label: "Birth date",
			min: "1900-01-01",
			max: "2026-12-31",
		};
		const spec = fieldToSpec(field);
		expect(spec.type).toBe("DateInput");
		expect(spec.props?.min).toBe("1900-01-01");
	});

	it("maps a datetime field to DateTimeInput", () => {
		const field: FormField = {
			type: "datetime",
			label: "Appointment",
		};
		expect(fieldToSpec(field).type).toBe("DateTimeInput");
	});

	it("maps a time field to TimeInput", () => {
		const field: FormField = {
			type: "time",
			label: "Pickup time",
		};
		expect(fieldToSpec(field).type).toBe("TimeInput");
	});

	it("maps a duration field to DurationInput", () => {
		const field: FormField = {
			type: "duration",
			label: "Visit length",
		};
		expect(fieldToSpec(field).type).toBe("DurationInput");
	});

	it("maps an email field to EmailInput", () => {
		const field: FormField = {
			type: "email",
			label: "Contact email",
		};
		expect(fieldToSpec(field).type).toBe("EmailInput");
	});

	it("maps a phone field to PhoneInput", () => {
		const field: FormField = {
			type: "phone",
			label: "Phone",
		};
		expect(fieldToSpec(field).type).toBe("PhoneInput");
	});

	it("maps a uri field to UriInput", () => {
		const field: FormField = {
			type: "uri",
			label: "Website",
		};
		expect(fieldToSpec(field).type).toBe("UriInput");
	});

	it("maps a uuid field to TextInput with a UUID-shaped pattern", () => {
		const field: FormField = {
			type: "uuid",
			label: "Trace id",
		};
		const spec = fieldToSpec(field);
		expect(spec.type).toBe("TextInput");
		expect(spec.props?.pattern).toBeTruthy();
	});

	it("maps an address field to AddressForm", () => {
		const field: FormField = {
			type: "address",
			label: "Home address",
		};
		expect(fieldToSpec(field).type).toBe("AddressForm");
	});

	it("maps a person field to PersonForm", () => {
		const field: FormField = {
			type: "person",
			label: "Tenant",
		};
		expect(fieldToSpec(field).type).toBe("PersonForm");
	});

	it("maps an organization field to OrganizationForm", () => {
		const field: FormField = {
			type: "organization",
			label: "Employer",
		};
		expect(fieldToSpec(field).type).toBe("OrganizationForm");
	});

	it("maps an identification field to IdentificationInput with allowedTypes", () => {
		const field: FormField = {
			type: "identification",
			label: "ID",
			allowedTypes: ["passport", "drivers_license"],
		};
		const spec = fieldToSpec(field);
		expect(spec.type).toBe("IdentificationInput");
		expect(spec.props?.allowedTypes).toEqual(["passport", "drivers_license"]);
	});

	it("maps a rating field to RatingStars", () => {
		const field: FormField = {
			type: "rating",
			label: "Service quality",
			min: 1,
			max: 5,
		};
		expect(fieldToSpec(field).type).toBe("RatingStars");
	});

	it("maps a coordinate field to TextInput fallback with placeholder", () => {
		const field: FormField = {
			type: "coordinate",
			label: "Pin location",
		};
		const spec = fieldToSpec(field);
		expect(spec.type).toBe("TextInput");
		expect(spec.props?.placeholder).toContain("lat,lng");
	});

	it("maps a bbox field to TextInput fallback", () => {
		const field: FormField = {
			type: "bbox",
			label: "Region",
		};
		const spec = fieldToSpec(field);
		expect(spec.type).toBe("TextInput");
		expect(spec.props?.placeholder).toContain("minX");
	});

	describe("fieldset", () => {
		it("recurses into nested fields and produces a child SpecNode per field", () => {
			const field: FormField = {
				type: "fieldset",
				label: "Personal info",
				fields: {
					firstName: { type: "text", label: "First name" },
					age: { type: "number", label: "Age", min: 0 },
					likesDogs: { type: "boolean", label: "Likes dogs?" },
				},
			};
			const spec = fieldToSpec(field, { fieldPath: "/profile" });
			expect(spec.type).toBe("Fieldset");
			expect(spec.children?.length).toBe(3);
			const childMap: Record<string, NonNullable<(typeof spec)["children"]>[number]> = {};
			for (const child of spec.children ?? []) {
				if (child.fieldPath) childMap[child.fieldPath] = child;
			}
			expect(childMap["/profile/firstName"]?.type).toBe("TextInput");
			expect(childMap["/profile/age"]?.type).toBe("NumberInput");
			expect(childMap["/profile/likesDogs"]?.type).toBe("YesNoToggle");
		});

		it("recurses through nested fieldsets", () => {
			const field: FormField = {
				type: "fieldset",
				label: "Outer",
				fields: {
					inner: {
						type: "fieldset",
						label: "Inner",
						fields: {
							leaf: { type: "text", label: "Leaf" },
						},
					},
				},
			};
			const spec = fieldToSpec(field, { fieldPath: "/outer" });
			expect(spec.type).toBe("Fieldset");
			const innerSpec = spec.children?.[0];
			expect(innerSpec?.type).toBe("Fieldset");
			expect(innerSpec?.fieldPath).toBe("/outer/inner");
			const leafSpec = innerSpec?.children?.[0];
			expect(leafSpec?.type).toBe("TextInput");
			expect(leafSpec?.fieldPath).toBe("/outer/inner/leaf");
		});
	});

	describe("optional fieldPath", () => {
		it("omits fieldPath when not provided in context", () => {
			const field: FormField = { type: "text", label: "Test" };
			const spec = fieldToSpec(field);
			expect(spec.fieldPath).toBeUndefined();
		});

		it("attaches fieldPath when provided", () => {
			const field: FormField = { type: "text", label: "Test" };
			const spec = fieldToSpec(field, { fieldPath: "/foo" });
			expect(spec.fieldPath).toBe("/foo");
		});
	});

	describe("base props", () => {
		it("passes through label and description on every spec", () => {
			const field: FormField = {
				type: "number",
				label: "Score",
				description: "Out of 100",
			};
			const spec = fieldToSpec(field);
			expect(spec.props?.label).toBe("Score");
			expect(spec.props?.description).toBe("Out of 100");
		});

		it("passes through boolean required, ignores expression-typed required", () => {
			const required: FormField = {
				type: "text",
				label: "X",
				required: true,
			};
			expect(fieldToSpec(required).props?.required).toBe(true);

			const condRequired: FormField = {
				type: "text",
				label: "Y",
				required: "$state.parent.checked",
			};
			expect(fieldToSpec(condRequired).props?.required).toBeUndefined();
		});
	});
});
