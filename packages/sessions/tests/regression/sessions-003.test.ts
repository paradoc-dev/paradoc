// sessions-003: answered optional fields are counted as required in progress.
// Input: required `name`; optional `note`, `dob`, `fee`; answer `note`.
// Expected: requiredTotal 1, optionalTotal 3. Actual: requiredTotal 2, optionalTotal 2.
import { expect, it } from "vitest";
import { createParadocRuntime } from "../../src/engine/paradoc-runtime";
import type { FormSession } from "../../src/engine/types";
import { execute } from "../../src/engine/execute";
import { deriveView } from "../../src/engine/derive";

it("sessions-003: progress totals", () => {
  const runtime = createParadocRuntime(artifact({ fields: {
    name: { type: "text", required: true }, note: { type: "text" }, dob: { type: "date" }, fee: { type: "money" },
  } }));
  const r = execute(session(), runtime, { kind: "answer", fieldPath: "note", value: "hi", source: "user" }, { kind: "user" });
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  const p = deriveView(r.session, runtime).progress;
  expect({ requiredTotal: p.requiredTotal, optionalTotal: p.optionalTotal }).toEqual({ requiredTotal: 1, optionalTotal: 3 });
});

export function artifact(extra: Record<string, unknown>) {
  return {
    $schema: "https://schema.paradoc.dev/2026-09-24.json", kind: "form", name: "v", version: "1.0.0", title: "V",
    parties: {}, fields: {},
    layers: { composition: { kind: "file", mimeType: "text/plain", path: "v.txt" } }, defaultLayer: "composition",
    ...extra,
  };
}
export function session(): FormSession {
  return { formSessionId: "fs", chatId: "c", artifactRef: { name: "v" }, events: [], createdAt: "2026-01-01T00:00:00.000Z" };
}
