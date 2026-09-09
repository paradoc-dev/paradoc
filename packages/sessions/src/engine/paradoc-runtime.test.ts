import { describe, expect, it } from "vitest";
import { createParadocRuntime } from "./paradoc-runtime";

describe("createParadocRuntime", () => {
	it("keeps a core expression failure unresolved instead of offering fallback state", () => {
		const runtime = createParadocRuntime({
			$schema: "https://schema.paradoc.dev/schema.json",
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
});
