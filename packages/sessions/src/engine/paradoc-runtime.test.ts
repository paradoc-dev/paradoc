import { describe, expect, it } from "vitest";
import { createParadocRuntime } from "./paradoc-runtime";

describe("createParadocRuntime", () => {
	it("keeps a core expression failure unresolved instead of offering fallback state", () => {
		const runtime = createParadocRuntime({
			$schema: "https://schema.paradoc.dev/2026-09-24.json",
			kind: "form",
			name: "runtime-failure",
			version: "1.0.0",
			title: "Runtime failure",
			parties: {},
			fields: {
				gate: { type: "boolean", required: true },
				dependent: {
					type: "text",
					visible: "fields.gate ===",
					required: true,
				},
			},
			layers: {
				composition: {
					kind: "file",
					mimeType: "text/plain",
					path: "runtime-failure.txt",
				},
			},
			defaultLayer: "composition",
		});

		const state = runtime.getFillState({}, {});
		expect(state.resolved).toBe(false);
		expect(state.openRequired).toEqual([]);
		expect(state.openOptional).toEqual([]);
		expect(state.done).toEqual([]);
		expect(state.diagnostics?.length).toBeGreaterThan(0);
	});

	const pricedArtifact = () => ({
		$schema: "https://schema.paradoc.dev/2026-09-24.json",
		kind: "form",
		name: "priced",
		version: "1.0.0",
		title: "Priced",
		parties: {},
		fields: {
			quantity: { type: "number", required: true },
			divisor: { type: "number", required: true },
			note: { type: "text", required: true },
		},
		defs: {
			total: { type: "number", value: "fields.quantity * 2" },
			share: { type: "number", value: "fields.quantity / fields.divisor" },
		},
		layers: {
			composition: { kind: "file", mimeType: "text/plain", path: "priced.txt" },
		},
		defaultLayer: "composition",
	});

	it("keeps asking for required fields while computed values are missing their inputs", () => {
		const state = createParadocRuntime(pricedArtifact()).getFillState({}, {});
		expect(state.resolved).toBe(true);
		expect(state.diagnostics).toBeUndefined();
		expect(state.openRequired.map((field) => field.fieldPath)).toEqual(["quantity", "divisor", "note"]);
	});

	it("reports a failing computed value as a diagnostic and keeps asking for the rest", () => {
		const state = createParadocRuntime(pricedArtifact()).getFillState({ quantity: 3, divisor: 0 }, {});
		expect(state.resolved).toBe(true);
		expect(state.diagnostics).toEqual([expect.stringContaining("division-by-zero")]);
		expect(state.openRequired.map((field) => field.fieldPath)).toEqual(["note"]);
		expect(state.done.map((field) => field.fieldPath)).toEqual(["quantity", "divisor"]);
	});
});
