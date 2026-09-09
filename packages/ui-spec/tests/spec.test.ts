import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { fieldToSpec } from "../src/mapper.js";
import {
	assertConcreteFieldPath,
	classifyFieldTarget,
	resolveConcreteFieldPath,
	validateSpec,
} from "../src/spec.js";

describe("typed presentation contract", () => {
	it("accepts a mapped nested field family with explicit host addresses", () => {
		const spec = fieldToSpec(
			{
				type: "fieldset",
				fields: {
					contact: {
						type: "fieldset",
						fields: {
							name: { type: "text", default: "Ada" },
							age: { type: "number", default: 37 },
						},
					},
					items: {
						type: "list",
						item: {
							type: "fieldset",
							fields: { value: { type: "text" } },
						},
					},
				},
			},
			{ fieldPath: "profile" },
		);

		const parsed = validateSpec(spec);
		if (parsed.type !== "Fieldset") throw new Error("expected fieldset");
		expect(parsed.children.map((child) => child.fieldPath)).toEqual([
			"profile.contact",
			"profile.items",
		]);
		const list = parsed.children[1];
		if (!list) throw new Error("expected list child");
		expect(list.type).toBe("List");
		if (list.type === "List") {
			const item = list.children[0];
			if (!item) throw new Error("expected list template");
			expect(item.fieldPath).toBe("profile.items[]");
			if (item.type === "Fieldset") {
				const value = item.children[0];
				if (!value) throw new Error("expected list field");
				expect(value.fieldPath).toBe(
					"profile.items[].value",
				);
			}
		}
	});

	it("round-trips geographic canonical values without text coercion", () => {
		const coordinate = validateSpec(
			fieldToSpec({
				type: "coordinate",
				default: { lat: 40.7128, lon: -74.006 },
			}),
		);
		const bbox = validateSpec(
			fieldToSpec({
				type: "bbox",
				default: {
					southWest: { lat: 40.4, lon: -74.2 },
					northEast: { lat: 40.9, lon: -73.7 },
				},
			}),
		);
		if (coordinate.type !== "CoordinateInput") throw new Error("expected coordinate");
		expect(coordinate.props.default).toEqual({ lat: 40.7128, lon: -74.006 });
		if (bbox.type !== "BboxInput") throw new Error("expected bbox");
		expect(bbox.props.default).toEqual({
			southWest: { lat: 40.4, lon: -74.2 },
			northEast: { lat: 40.9, lon: -73.7 },
		});
	});

	it("keeps every descendant unbound when the mapper has no field path", () => {
		const spec = fieldToSpec({
			type: "fieldset",
			fields: {
				items: { type: "list", item: { type: "text" } },
			},
		});
		const parsed = validateSpec(spec);
		if (parsed.type !== "Fieldset") throw new Error("expected fieldset");
		const list = parsed.children[0];
		if (!list) throw new Error("expected list child");
		expect(list.fieldPath).toBeUndefined();
		if (list.type !== "List") throw new Error("expected list");
		const item = list.children[0];
		if (!item) throw new Error("expected list template");
		expect(item.fieldPath).toBeUndefined();
	});

	it("keeps nested list templates distinct from concrete item addresses", () => {
		const nested = validateSpec({
			type: "Fieldset",
			props: {},
			fieldPath: "profile",
			children: [
				{
					type: "List",
					props: {},
					fieldPath: "profile.items",
					children: [
						{
							type: "Fieldset",
							props: {},
							fieldPath: "profile.items[]",
							children: [
								{
									type: "List",
									props: {},
									fieldPath: "profile.items[].tags",
									children: [
										{
											type: "TextInput",
											props: {},
											fieldPath: "profile.items[].tags[]",
										},
									],
								},
							],
						},
					],
				},
			],
		});
		if (nested.type !== "Fieldset") throw new Error("expected fieldset");
		const list = nested.children[0];
		if (!list || list.type !== "List") throw new Error("expected list");
		const item = list.children[0];
		if (!item || item.type !== "Fieldset") throw new Error("expected item fieldset");
		const nestedList = item.children[0];
		if (!nestedList || nestedList.type !== "List") throw new Error("expected nested list");
		expect(classifyFieldTarget(list.fieldPath).kind).toBe("concrete");
		expect(classifyFieldTarget(item.fieldPath).kind).toBe("template");
		expect(classifyFieldTarget(nestedList.children[0].fieldPath).kind).toBe("template");

		expect(() =>
			validateSpec({
				type: "List",
				props: {},
				fieldPath: "profile.items",
				children: [{ type: "TextInput", props: {}, fieldPath: "profile.items[2]" }],
			}),
		).toThrow(/template addressing/);
		expect(() =>
			validateSpec({
				type: "Fieldset",
				props: {},
				children: [{ type: "TextInput", props: {}, fieldPath: "orphan" }],
			}),
		).toThrow(/remain unbound/);
	});

	it("rejects invalid defaults and missing enum options at the prop location", () => {
		expect(() =>
			validateSpec({
				type: "NumberInput",
				props: { default: "12" },
			}),
		).toThrow(/default/);
		expect(() =>
			validateSpec({
				type: "EnumPicker",
				props: { label: "Choose" },
			}),
		).toThrow(/options/);
	});

	it("rejects children on scalar nodes and invalid List cardinality", () => {
		const scalar = {
			type: "TextInput",
			props: {},
			children: [],
		};
		expect(() => validateSpec(scalar)).toThrow(/children/);
		expect(() =>
			validateSpec({ type: "List", props: {}, children: [] }),
		).toThrow(/exactly one/);
		expect(() =>
			validateSpec({
				type: "List",
				props: {},
				children: [{ type: "TextInput", props: {} }, { type: "TextInput", props: {} }],
			}),
		).toThrow(/exactly one/);
	});

	it("rejects unknown component and spec properties without throwing TypeError", () => {
		expect(() => validateSpec({ type: "NoSuchControl", props: {} })).toThrow(/type/);
		expect(() =>
			validateSpec({ type: "TextInput", props: {}, extra: true }),
		).toThrow(/extra/);
		expect(() =>
			validateSpec({ type: "TextInput", props: { unsupported: true } }),
		).toThrow(/props/);

		try {
			validateSpec({
				type: "Fieldset",
				props: {},
				children: [{ type: "TextInput", props: { unsupported: true } }],
			});
			throw new Error("expected nested unknown property to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(ZodError);
			expect((error as ZodError).issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						path: ["children", 0, "props", "unsupported"],
					}),
				]),
			);
		}

		try {
			validateSpec({
				type: "Fieldset",
				props: {},
				children: [{ type: "TextInput", props: {}, extra: true }],
			});
			throw new Error("expected nested unknown node property to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(ZodError);
			expect((error as ZodError).issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ path: ["children", 0] }),
				]),
			);
		}
	});

	it("distinguishes unbound, template, and concrete targets", () => {
		expect(classifyFieldTarget()).toEqual({ kind: "unbound" });
		expect(classifyFieldTarget("items[]")).toEqual({ kind: "template", path: "items[]" });
		expect(classifyFieldTarget("items[2].name")).toEqual({
			kind: "concrete",
			path: "items[2].name",
		});
		expect(resolveConcreteFieldPath("items[].entries[].name", [2, 4])).toBe(
			"items[2].entries[4].name",
		);
		expect(() => assertConcreteFieldPath()).toThrow(/unbound/);
		expect(() => assertConcreteFieldPath("items[]")).toThrow(/template/);
		expect(assertConcreteFieldPath("items[2].name")).toBe("items[2].name");
		expect(() => resolveConcreteFieldPath("items[].name", [])).toThrow(/index/);
	});
});
